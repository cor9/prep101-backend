const path = require("path");
const { repairScreenplayText } = require("./screenplayRepair");
const { parseScreenplayText } = require("./screenplayParser");
const { generateReaderGuide } = require("./readerGuideService");
const { generateActingGuideWithRAG } = require("./claudePdfGuidePipeline");
const { scrubWatermarks, assessQuality } = require("./textCleaner");
const { generateBoldChoices } = require("./boldChoicesService");
const {
  runAdminQuery,
  tables: supabaseTables,
} = require("../lib/supabaseAdmin");
const {
  getReader101ConsumptionUpdate,
  getPrep101ConsumptionUpdate,
} = require("./prep101EntitlementsService");

let GuideModel = null;
try {
  GuideModel = require("../models/Guide");
} catch (e) {
  // Model may not exist
}

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
    isReaderMode,
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

  await updateProgress(10, "Repairing and analyzing text...");
  const repairedText = repairScreenplayText(combinedSceneText);
  const parsedScreenplay = parseScreenplayText(repairedText, {
    actorCharacter: characterName ? characterName.trim() : null
  });

  const FORBIDDEN_READER_ROLES = new Set(["SHOT", "INSERT", "SECURITY CAM FOOTAGE", "CUT TO", "FLASHBACK", "ANGLE ON"]);
  function scoreCharacterLikelihood(name) {
    let score = 0;
    if (name.length <= 20) score += 1;
    if (/^[A-Z\s]+$/.test(name)) score += 1;
    if (!name.includes("SHOT")) score += 1;
    if (!name.includes("FOOTAGE")) score += 1;
    return score;
  }
  const sanitizedReaderRoles = parsedScreenplay.readerRoles.filter(role => {
    if (FORBIDDEN_READER_ROLES.has(role.trim().toUpperCase())) return false;
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
      fallbackMode: shouldForceReaderFallback,
    });
    
    guideId = `reader_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } else {
    await updateProgress(30, "Analyzing character and generating Prep101 guide...");
    
    const extractionMethod = uploadData && uploadData[0] ? uploadData[0].extractionMethod : "text";
    
    const guideContentRaw = await generateActingGuideWithRAG({
      sceneText: repairedText,
      characterName: characterName.trim(),
      productionTitle: productionTitle.trim(),
      productionType: productionType.trim(),
      genre: (genre || "").trim(),
      storyline: (storyline || "").trim(),
      extractionMethod: extractionMethod,
      hasFullScript: hasFullScript,
      fallbackMode: shouldForcePrepFallback,
      uploadData: uploadData,
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
