const { repairScreenplayText } = require("./screenplayRepair");
const { parseScreenplayText } = require("./screenplayParser");
const { generateReaderGuide } = require("./readerGuideService");
const {
  generateAnalysis,
  generateGuideHTML,
} = require("./claudePdfGuidePipeline");
const {
  DEFAULT_CLAUDE_MODEL,
} = require("../config/models");
const { assessQuality } = require("./textCleaner");
const { generateBoldChoices } = require("./boldChoicesService");
const { retrieveMethodologyChunks } = require("./ragRetrieval");

function assessContentQuality(text, wordCount, isUpload = false) {
  const assessment = assessQuality(text, wordCount);
  if (isUpload) {
    if (assessment.quality === "empty") {
      return { quality: "poor", reason: "insufficient_content" };
    }
    return { quality: "good", reason: "sufficient_content" };
  }
  return {
    quality: assessment.quality,
    reason: assessment.reason,
    repetitiveRatio: assessment.ratio || 0,
    usable: assessment.usable,
  };
}

// Below this, a PDF deep-read is worth attempting to enrich thin extractions.
const DEEP_READ_TRIGGER_WORDS = 80;
// Below this, there is not enough script to build a guide from at all.
// Kept in step with the per-product route validators.
const MIN_USABLE_WORDS = 20;

// Strip the trailing modifiers a cue can carry so "EVIE (CONT'D)" still counts
// as EVIE, while "EVIE BIKES DOWN CARMODY ROAD" (an action line the parser
// mistook for a cue) correctly does not.
function normalizeSpeaker(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s*\((?:CONT'?D|O\.?S\.?|O\.?C\.?|V\.?O\.?)\)\s*$/i, "")
    .trim();
}

/**
 * How many dialogue blocks the parser can attribute to this character.
 * Zero means the extraction lost its speaker cues: the lines are all there,
 * but nothing says which of them the actor is reading.
 */
function countAttributedLines(text, characterName) {
  const target = normalizeSpeaker(characterName);
  if (!target || !text) return 0;
  try {
    const parsed = parseScreenplayText(repairScreenplayText(text), {
      actorCharacter: String(characterName).trim(),
    });
    return (parsed.dialogueBlocks || []).filter(
      (block) => normalizeSpeaker(block?.speaker) === target
    ).length;
  } catch (error) {
    console.warn("[JobProcessor] Could not assess speaker attribution:", error.message);
    return 0;
  }
}

function getMeaningfulWordCount(text = "") {
  return (text.match(/\b[\w']+\b/g) || []).length;
}

function wrapGuideHtml(rawHtml, guide = {}) {
  const content = String(rawHtml || "");
  if (content.includes("<html") && content.includes("</html>")) {
    return content;
  }
  const titleBits = [guide.characterName, guide.productionTitle].filter(Boolean);
  const title = titleBits.length ? titleBits.join(" • ") : "Child Actor 101 Guide";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body>
${content}
</body>
</html>`;
}

function buildPrep101Metadata(payload = {}) {
  return {
    characterName: payload.characterName || "",
    actorAge: payload.actorAge || "",
    productionTitle: payload.productionTitle || "",
    productionType: payload.productionType || "",
    roleSize: payload.roleSize || "",
    genre: payload.genre || "",
    storyline: payload.storyline || "",
    characterBreakdown: payload.characterBreakdown || "",
    callbackNotes: payload.callbackNotes || "",
    focusArea: payload.focusArea || "",
    extractionMethod:
      payload.uploadData && payload.uploadData[0]
        ? payload.uploadData[0].extractionMethod || payload.uploadData[0].source || "text"
        : "text",
    hasFullScript: Boolean(payload.hasFullScript),
  };
}

async function generatePrep101GuideFromText(payload = {}) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const metadata = buildPrep101Metadata(payload);
  const screenplayText = payload.repairedText || payload.combinedSceneText || "";
  const analysisStep = await generateAnalysis({
    screenplayText,
    metadata,
    preferredModel: DEFAULT_CLAUDE_MODEL,
    apiKey,
  });
  const methodologyContext = await retrieveMethodologyChunks({
    metadata,
    screenplayText,
  });
  const guideStep = await generateGuideHTML({
    analysis: analysisStep.analysis,
    screenplayText,
    metadata,
    methodologyContext,
    preferredModel: DEFAULT_CLAUDE_MODEL,
    apiKey,
  });

  return wrapGuideHtml(guideStep.html, metadata);
}

// Stub implementation since we can't easily import everything from simple-backend-rag.js
// In a real refactor, these DB operations would be moved to their own service.
async function processGuideJob(payload, jobInstance = null) {
  const updateProgress = async (prog, status) => {
    if (jobInstance?.updateProgress) {
      await jobInstance.updateProgress({ percent: prog, status });
    }
  };

  const {
    userId,
    isReaderMode: payloadIsReaderMode,
    combinedSceneText,
    characterName,
    actorAge,
    productionTitle,
    productionType,
    genre,
    storyline,
    roleSize,
    characterBreakdown,
    callbackNotes,
    focusArea,
    childGuideRequested,
    uploadData,
    hasFullScript,
    shouldForceReaderFallback,
    shouldForcePrepFallback,
    combinedWordCount,
  } = payload;
  // These may be reset below if OCR recovery succeeds
  let effectiveReaderFallback = Boolean(shouldForceReaderFallback);
  let effectivePrepFallback = Boolean(shouldForcePrepFallback);
  const isReaderMode =
    payloadIsReaderMode === true ||
    payload.jobType === "reader101" ||
    payload.mode === "reader_support" ||
    payload.product === "reader101";

  await updateProgress(10, "Repairing and analyzing text...");
  let finalCombinedText = combinedSceneText || payload.sceneText || "";
  let finalCombinedWordCount = getMeaningfulWordCount(finalCombinedText);

  // A PDF can extract plenty of words and still be useless: when the layout-aware
  // extractors time out, the text stage flattens the page and every speaker cue
  // is lost, so no line can be attributed to the actor. Word count alone cannot
  // see that, which is why structure is checked separately.
  let attributedLines = countAttributedLines(finalCombinedText, characterName);
  const extractionLooksLimited = Boolean(
    payload.fallbackMode ||
      payload.shouldForcePrepFallback ||
      payload.shouldForceReaderFallback ||
      payload.extractionConfidence === "low"
  );
  const lostSpeakerAttribution =
    extractionLooksLimited && Boolean(characterName) && attributedLines === 0;

  // ── Universal PDF deep-read: fires for ALL guide types when text is thin ──
  // This is a best-effort enhancement, not a gate. Short sides (a half-page
  // scene, a single monologue) legitimately land under DEEP_READ_TRIGGER_WORDS,
  // and a failed OCR pass must never discard text we already have.
  if (
    payload.pdfBase64 &&
    (finalCombinedWordCount < DEEP_READ_TRIGGER_WORDS || lostSpeakerAttribution)
  ) {
    if (lostSpeakerAttribution) {
      console.log(
        `[JobProcessor] ${finalCombinedWordCount} words extracted but no lines attributable to "${characterName}" — running deep read to recover speaker cues.`
      );
    }
    await updateProgress(15, "Running deep PDF read (OCR recovery)...");
    try {
      const { processPdfExtractionJob } = require("./pdfExtractionJobProcessor");
      const { recoverScreenplayFromFallback } = require("./claudePdfGuidePipeline");
      
      const ocrFallback = await processPdfExtractionJob({
        filename: payload.filename || "upload.pdf",
        pdfBase64: payload.pdfBase64,
      });

      const recoveredText = recoverScreenplayFromFallback(ocrFallback);
      const recoveredWordCount = getMeaningfulWordCount(recoveredText);
      const recoveredAttributed = countAttributedLines(recoveredText, characterName);

      // A spatially-mapped read can be slightly shorter than the flattened one
      // yet far more useful, because it puts the speaker cues back. Accept that
      // trade, but not a recovery that drops most of the script to get there.
      const improvesWordCount = recoveredWordCount > finalCombinedWordCount;
      const restoresAttribution =
        lostSpeakerAttribution &&
        recoveredAttributed > 0 &&
        recoveredWordCount >= Math.floor(finalCombinedWordCount * 0.6);

      if (improvesWordCount || restoresAttribution) {
        if (restoresAttribution && !improvesWordCount) {
          console.log(
            `[JobProcessor] Deep read recovered ${recoveredAttributed} attributed lines for "${characterName}" (${recoveredWordCount} words vs ${finalCombinedWordCount}); taking the structured text.`
          );
        }
        finalCombinedText = recoveredText;
        finalCombinedWordCount = recoveredWordCount;
        attributedLines = recoveredAttributed;
        // Inject recovered text back so ALL downstream generators see it
        payload.sceneText = recoveredText;
        payload.combinedSceneText = recoveredText;

        if (recoveredWordCount >= DEEP_READ_TRIGGER_WORDS) {
          // Full recovery — clear fallback flags so generators receive real text mode
          // Also clear on the payload object itself (bold_choices passes payload directly)
          payload.fallbackMode = false;
          payload.shouldForceReaderFallback = false;
          payload.shouldForcePrepFallback = false;
          effectiveReaderFallback = false;
          effectivePrepFallback = false;
          console.log(`[JobProcessor] Deep PDF read succeeded: ${recoveredWordCount} words recovered. All fallback flags cleared.`);
        } else {
          console.log(`[JobProcessor] Deep PDF read improved text to ${recoveredWordCount} words; staying in fallback mode.`);
        }
      } else {
        console.log(`[JobProcessor] Deep PDF read added nothing (${recoveredWordCount} vs ${finalCombinedWordCount} words); keeping upload-stage text.`);
      }
    } catch (err) {
      // Recovery is optional. Fall through on the text we already extracted.
      console.warn("[JobProcessor] Deep PDF read failed, continuing with upload-stage text:", err.message);
    }

    // Only give up once there is genuinely nothing to build a guide from.
    if (finalCombinedWordCount < MIN_USABLE_WORDS) {
      throw new Error("We weren't able to read this PDF. Please re-upload a clearer version or paste the sides text directly.");
    }
  }

  const repairedText = repairScreenplayText(finalCombinedText);
  const parsedScreenplay = parseScreenplayText(repairedText, {
    actorCharacter: characterName ? characterName.trim() : null
  });

  const FORBIDDEN_READER_ROLES = new Set([
    "SHOT",
    "INSERT",
    "SECURITY CAM FOOTAGE",
    "CUT TO",
    "FLASHBACK",
    "ANGLE ON",
    "SCRIPT TITLE",
    "PROJECT TITLE",
    "TITLE",
    "IN THEIR EYES",
    "IN HIS EYES",
    "IN HER EYES",
    "IN ITS EYES",
  ]);
  function scoreCharacterLikelihood(name) {
    let score = 0;
    if (name.length <= 20) score += 1;
    if (/^[A-Z\s]+$/.test(name)) score += 1;
    if (!name.includes("SHOT")) score += 1;
    if (!name.includes("FOOTAGE")) score += 1;
    return score;
  }
  const sanitizedReaderRoles = parsedScreenplay.readerRoles.filter(role => {
    const upperRole = String(role || "").trim().toUpperCase();
    if (!upperRole || FORBIDDEN_READER_ROLES.has(upperRole)) return false;
    if (/\bCONT(?:['’]?D)?\b/.test(upperRole)) return false;
    if (/\b(EYES|LOOKS?|STARES?|WATCHES|SEES)\b/.test(upperRole)) return false;
    return scoreCharacterLikelihood(role) >= 3;
  });

  if (payload.jobType === "bold_choices") {
    await updateProgress(20, "Generating bold choices...");
    const guideData = await generateBoldChoices(payload);
    
    function isValidGuideData(data) {
      return (
        data &&
        data.pov &&
        typeof data.pov.summary === "string" &&
        Array.isArray(data.choices) &&
        data.choices.length >= 3 &&
        Array.isArray(data.moments) &&
        data.moments.length >= 1
      );
    }

    if (!isValidGuideData(guideData)) {
      console.warn("[BoldChoices] Schema guard failed — retrying with stricter instruction");
      payload._schemaRetry = true;
      const retryData = await generateBoldChoices(payload);
      if (!isValidGuideData(retryData)) {
        throw new Error("Generated guide was malformed. Please try again.");
      }
      Object.assign(guideData, retryData);
    }
    
    // Pass everything back for the polling endpoint to save
    await updateProgress(100, "Completed");
    return {
      guideData,
      jobType: "bold_choices",
      inputData: payload,
    };
  }

  let generatedHtml = "";
  let guideId = "";

  if (isReaderMode) {
    await updateProgress(30, "Drafting Reader Support guide...");
    generatedHtml = await generateReaderGuide({
      sceneText: repairedText,
      characterName: characterName.trim(),
      characterNames: sanitizedReaderRoles,
      structure: parsedScreenplay.structure,
      actorAge: actorAge || "",
      productionTitle: productionTitle.trim(),
      productionType: productionType.trim(),
      genre: genre || "",
      storyline: storyline || "",
      fallbackMode: effectiveReaderFallback,
    });
    
    guideId = `reader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } else {
    await updateProgress(30, "Analyzing character and generating Prep101 guide...");
    
    const extractionMethod = uploadData && uploadData[0] ? uploadData[0].extractionMethod : "text";
    
    const guideContentRaw = await generatePrep101GuideFromText({
      ...payload,
      repairedText,
      characterName: characterName.trim(),
      productionTitle: productionTitle.trim(),
      productionType: productionType.trim(),
      genre: (genre || "").trim(),
      storyline: (storyline || "").trim(),
      extractionMethod,
      hasFullScript,
      fallbackMode: effectivePrepFallback,
      uploadData,
    });

    generatedHtml = wrapGuideHtml(guideContentRaw, {
      characterName: characterName.trim(),
      productionTitle: productionTitle.trim(),
      productionType: productionType.trim(),
    });
    
    guideId = `corey_rag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  await updateProgress(80, "Finalizing and saving...");

  const guidePayload = {
    guideId,
    userId,
    characterName: characterName.trim(),
    productionTitle: productionTitle.trim(),
    productionType: productionType.trim(),
    roleSize: roleSize || "Supporting",
    genre: genre || "Drama",
    storyline: storyline || "",
    characterBreakdown: characterBreakdown || "",
    callbackNotes: callbackNotes || "",
    focusArea: isReaderMode ? "reader_support" : (focusArea || ""),
    sceneText: repairedText,
    generatedHtml,
    childGuideRequested: childGuideRequested || false,
    childGuideCompleted: false,
    guideType: isReaderMode ? 'reader101' : 'prep101',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Skip actual DB saving in the job processor for now to avoid circular dependencies with auth/billing,
  // we will just return the payload so the polling endpoint can save it, OR we just do minimal DB save.
  // Actually, to fully solve the timeout, the saving MUST happen in the background or during polling.
  // We'll return the complete guide data, and when the frontend fetches the completed job, it will trigger the save/deduct logic if needed, OR we do it here.

  await updateProgress(100, "Completed");
  
  return {
    guidePayload,
    isReaderMode,
    combinedWordCount,
  };
}

module.exports = {
  processGuideJob,
};
