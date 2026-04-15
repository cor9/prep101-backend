const { sendAnthropicMessage } = require("./anthropicClient");
const { processPdfExtractionJob } = require("./pdfExtractionJobProcessor");

const EXTRACTION_SYSTEM_PROMPT = `
You are a screenplay parser.

Extract clean, structured script text from the uploaded PDF.

Rules:
- Ignore watermarks, IDs, timestamps, and repeated footer/header artifacts.
- Ignore crossed-out/struck-through text.
- Preserve scene headings, action, character names, parentheticals, and dialogue.
- Preserve START/END audition markers if present.
- Keep (CONT'D) continuity across page breaks.
- Return only structured text (no commentary).
`.trim();

const GUIDE_SYSTEM_PROMPT = `
You are Corey Ralston's Prep101 coaching brain. Generate practical, actor-facing guidance that is playable in the room today.

DELIVERABLE STRUCTURE (KEEP THIS ORDER, ALL 10 REQUIRED):
1. Project Overview
2. Character Breakdown
3. Uta Hagen's 9 Questions (first-person voice; each answer grounded in script evidence)
4. Scene Action & Physicality (scene-by-scene, using actual scene headers/sluglines)
5. Subtext Translation Table
6. Character POV & Personalization
7. Bold Choices + Two-Take Submission Strategy
8. Moment Before & Button
9. Rehearsal Roadmap
10. Pre-Submission Checklist + Final Coach Note

COMPLETION ENFORCEMENT (NON-NEGOTIABLE):
- Complete every section fully before ending.
- Never end mid-sentence, mid-section, or mid-thought.
- If token pressure appears, compress earlier sections first.
- NEVER truncate these: Two-Take Submission Strategy, Pre-Submission Checklist, Final Coach Note.
- The Two-Take Strategy must include BOTH takes fully written.

MANDATORY CONTENT RULES:
- Do not invent script lines.
- Coaching voice, not academic analysis. Direction over observation.
- Convert explanation into playable instruction: "Do this", "Hold this beat", "Don't play X - play Y."
- Every scene analysis must include at least one coached pause/silence/stillness moment.

ARCHETYPE TRAP (MANDATORY STANDALONE BLOCK):
- In or immediately after Character Breakdown, add a clearly distinct block:
  "THE TRAP: DO NOT PLAY [archetype]"
- Explain why that archetype is wrong for this specific role.
- Give one concrete behavioral alternative.

SUBTEXT TABLE (STRICT FORMAT):
- Minimum 6 real lines from the sides.
- 3 columns exactly:
  Line | Surface Meaning | Subtext / Action

TWO-TAKE STRATEGY (REQUIRED):
- Include BOTH takes, fully written.
- For each take include:
  - Emotional engine
  - Primary tactic
  - What makes it different from the other take
  - One specific moment that lands differently

PRODUCTION STAKES INTEGRATION (IF PROVIDED):
- If metadata includes casting directors, showrunners/writers, or network/platform/studio/contract, weave those BY NAME into coaching language.
- Must appear in:
  1) Project Overview
  2) At least one note inside Bold Choices / strategy
  3) Final Coach Note

PRE-SUBMISSION CHECKLIST (REQUIRED):
- Framing / eyeline
- Lighting
- Background
- Sound
- File naming / takes
- One character-specific performance note (moment before or button)

FINAL COACH NOTE (REQUIRED):
- Name the specific project and stakes.
- Name casting directors by name if provided.
- Identify the one thing that books the role and cannot be faked.
- End with a direct send-off instruction, not generic encouragement.

OUTPUT:
- Return complete self-contained HTML only.
`.trim();

const GUIDE_COMPLETION_REPAIR_PROMPT = `
You are repairing an incomplete Prep101 guide draft.

Task:
- Preserve the strongest existing content.
- Fix completion and quality gaps.
- Ensure all 10 required sections exist in the correct order.
- Fully complete the Two-Take Strategy (both takes), Pre-Submission Checklist, and Final Coach Note.
- Ensure the Archetype Trap standalone block exists after Character Breakdown.
- Ensure the Subtext table has at least 6 real lines and 3 columns:
  Line | Surface Meaning | Subtext / Action
- Ensure actor-facing directive coaching language.
- Return final, complete HTML only.
`.trim();

function getAnthropicText(data = {}) {
  const content = Array.isArray(data?.content) ? data.content : [];
  return content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function stripHtml(input = "") {
  return String(input || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hasRequiredGuideSections(html = "") {
  const checks = [
    /Project Overview/i,
    /Character Breakdown/i,
    /Uta Hagen/i,
    /Scene Action/i,
    /Subtext/i,
    /Character POV|Personalization/i,
    /Bold Choices/i,
    /Two-?Take/i,
    /Moment Before/i,
    /Rehearsal Roadmap/i,
    /Pre-Submission Checklist/i,
    /Final Coach Note/i,
    /THE TRAP:\s*DO NOT PLAY/i,
  ];
  return checks.every((pattern) => pattern.test(html));
}

function hasMinimumSubtextRows(html = "") {
  const quotedLines = (html.match(/"[^"\n]{3,}"/g) || []).length;
  return quotedLines >= 6;
}

function appearsTruncated(html = "") {
  const trimmed = String(html || "").trim();
  if (!trimmed) return true;
  const plain = stripHtml(trimmed);
  if (!/[.!?]$/.test(plain)) return true;
  if (/<html[\s>]/i.test(trimmed) && !/<\/html>\s*$/i.test(trimmed)) return true;
  return false;
}

function needsRepairPass(html = "") {
  return (
    appearsTruncated(html) ||
    !hasRequiredGuideSections(html) ||
    !hasMinimumSubtextRows(html)
  );
}

async function extractScreenplayFromPdf({
  pdfBuffer,
  role = "",
  preferredModel,
  apiKey,
}) {
  const { data, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel,
    maxTokens: 6000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: `Extract screenplay text for role "${role || "Unknown"}".`,
          },
        ],
      },
    ],
  });

  const screenplayText = getAnthropicText(data);
  return { screenplayText, model };
}

async function generateGuideHtmlFromScreenplay({
  screenplayText,
  metadata,
  preferredModel,
  apiKey,
  startTime,
}) {
  const metaBlock = [
    `ROLE: ${metadata.characterName}`,
    `PROJECT TITLE: ${metadata.productionTitle}`,
    `PROJECT TYPE: ${metadata.productionType}`,
    metadata.genre ? `GENRE: ${metadata.genre}` : null,
    metadata.actorAge ? `ACTOR AGE: ${metadata.actorAge}` : null,
    metadata.castingDirectors
      ? `CASTING DIRECTORS: ${metadata.castingDirectors}`
      : null,
    metadata.showrunners ? `SHOWRUNNERS / WRITERS: ${metadata.showrunners}` : null,
    metadata.network ? `NETWORK / PLATFORM: ${metadata.network}` : null,
    metadata.studio ? `STUDIO: ${metadata.studio}` : null,
    metadata.contractType ? `CONTRACT TYPE: ${metadata.contractType}` : null,
    metadata.characterBreakdown
      ? `CHARACTER BREAKDOWN:\n${metadata.characterBreakdown}`
      : null,
    metadata.callbackNotes ? `CALLBACK NOTES:\n${metadata.callbackNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel,
    maxTokens: 12000,
    system: GUIDE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate the full Prep101 HTML guide.\n\n${metaBlock}\n\nSCRIPT:\n${screenplayText}`,
      },
    ],
  });

  // Only run the repair pass if we have enough wall-clock budget remaining.
  // The Vercel function has a hard 300s limit. Call 1 (extraction) + Call 2 (guide)
  // can take 150-220s combined. A repair pass costs another 60-120s. If we're
  // already past 220s, skip the repair and return what we have — a partial guide
  // is far better than a FUNCTION_INVOCATION_TIMEOUT with nothing.
  const elapsedSeconds = startTime ? (Date.now() - startTime) / 1000 : 0;
  const REPAIR_BUDGET_SECONDS = 220;

  const html = getAnthropicText(data);
  if (!needsRepairPass(html)) {
    return { html, model };
  }

  if (elapsedSeconds > REPAIR_BUDGET_SECONDS) {
    console.warn(
      `[Pipeline] Skipping repair pass — elapsed ${Math.round(elapsedSeconds)}s exceeds ${REPAIR_BUDGET_SECONDS}s budget. Returning first-pass output.`
    );
    return { html, model, repairSkipped: true };
  }

  const repair = await sendAnthropicMessage({
    apiKey,
    preferredModel,
    maxTokens: 10000,
    system: GUIDE_COMPLETION_REPAIR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Repair this guide draft using the same script/metadata context.\n\nMETADATA:\n${metaBlock}\n\nSCRIPT:\n${screenplayText}\n\nDRAFT HTML:\n${html}`,
      },
    ],
  });

  const repairedHtml = getAnthropicText(repair.data);
  return { html: repairedHtml || html, model: repair.model || model };
}

async function generateGuideFromPdfTwoCall({
  pdfBuffer,
  characterName,
  productionTitle,
  productionType,
  genre,
  actorAge,
  castingDirectors,
  showrunners,
  network,
  studio,
  contractType,
  characterBreakdown,
  callbackNotes,
  apiKey,
}) {
  // Record wall-clock start so nested functions can make budget decisions
  const startTime = Date.now();

  const extraction = await extractScreenplayFromPdf({
    pdfBuffer,
    role: characterName,
    apiKey,
  });

  let screenplayText = extraction.screenplayText || "";
  let wordCount = (screenplayText.match(/\b[\w']+\b/g) || []).length;
  let extractionMethod = "claude_document";

  // If Claude document extraction is too thin, automatically fall back
  // to the OCR pipeline on the same uploaded PDF before hard-stopping.
  if (wordCount < 80) {
    try {
      const ocrFallback = await processPdfExtractionJob({
        filename: "upload.pdf",
        pdfBase64: pdfBuffer.toString("base64"),
      });
      const sections = ocrFallback?.mapped?.sections || [];
      const recovered = sections
        .map((section) => String(section?.text || "").trim())
        .filter(Boolean)
        .filter((line) => line.length > 1)
        .filter((line) => !/Sides by Breakdown Services/i.test(line))
        .join("\n");
      const recoveredWordCount = (recovered.match(/\b[\w']+\b/g) || []).length;
      if (recoveredWordCount > wordCount) {
        screenplayText = recovered;
        wordCount = recoveredWordCount;
        extractionMethod = `ocr_fallback:${ocrFallback.provider || "unknown"}`;
      }
    } catch (_fallbackError) {
      // Preserve original hard-stop behavior only after fallback attempt.
    }
  }

  if (wordCount < 80) {
    throw new Error(
      "I was unable to read the uploaded sides. Please re-upload the PDF or paste the scene text directly. I cannot generate a useful preparation guide without the actual script."
    );
  }

  const guide = await generateGuideHtmlFromScreenplay({
    screenplayText,
    apiKey,
    startTime,
    metadata: {
      characterName,
      productionTitle,
      productionType,
      genre,
      actorAge,
      castingDirectors,
      showrunners,
      network,
      studio,
      contractType,
      characterBreakdown,
      callbackNotes,
    },
  });

  return {
    screenplayText,
    screenplayWordCount: wordCount,
    htmlGuide: guide.html,
    extractionModel: extraction.model,
    extractionMethod,
    guideModel: guide.model,
  };
}

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  GUIDE_SYSTEM_PROMPT,
  generateGuideFromPdfTwoCall,
};
