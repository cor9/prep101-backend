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

OUTPUT SEQUENCING — TRUNCATION PREVENTION:

This guide must be COMPLETE. It must never end mid-sentence, mid-section, or mid-instruction.

The most important sections for real-world actor use come at the END of the guide. These sections are mandatory and must always be fully delivered:

1. Two-Take Strategy (both takes, fully written)
2. Pre-Submission Checklist
3. Closing Coach's Note
4. Final physical/button instruction for Scene 3

If output length becomes a risk, compress earlier sections FIRST in this exact order:

1. Character POV & Personalization
2. Rehearsal Roadmap (reduce from 10 takes to 6)
3. Scene Action & Physicality (reduce to key beats only)
4. Project Overview (condense comps and context)

DO NOT compress or remove:
- Two-Take Strategy
- Pre-Submission Checklist
- Closing Coach's Note
- Final Scene 3 physical/button instruction

If full completion is impossible within the output limit:
- Do NOT silently truncate
- Do NOT end mid-sentence
- Do NOT omit end sections without notice

Instead output this visible warning block:

⚠ GUIDE INCOMPLETE DUE TO OUTPUT LIMIT
Missing sections:
- [list exact missing sections]

Then stop cleanly.

SECTION PRESENCE CHECK — REQUIRED BEFORE FINAL OUTPUT:

Before delivering the guide, verify that all of the following are present:
- Project Overview
- Character Breakdown
- Uta Hagen's 9 Questions
- Scene Action & Physicality
- Subtext Translation Table
- Character POV & Personalization
- Bold Choices
- Two-Take Strategy
- Moment Before & Button
- Rehearsal Roadmap
- Pre-Submission Checklist
- Closing Coach's Note

If any required section is missing, the output is invalid and must be rewritten shorter until all required sections fit.

COACHING VOICE PRIORITY:

When shortening for length, remove explanation before removing direction.
Keep playable instructions.
Cut analysis first, not tactics.

TWO-PHASE GENERATION (INTERNAL):

Build the guide in two internal phases:
Phase 1: Project Overview, Character Breakdown, Uta Hagen's 9 Questions, Scene Action & Physicality, Subtext Translation Table, Character POV & Personalization
Phase 2 (MUST COMPLETE FULLY): Bold Choices, Two-Take Strategy, Moment Before & Button, Rehearsal Roadmap, Pre-Submission Checklist, Closing Coach's Note

Reserve output budget explicitly for Phase 2.
Do not let Phase 1 sections consume the entire response budget.
If Phase 1 is running long, cut it short. Phase 2 must always be complete.

OUTPUT PRIORITY ORDER:

You must generate sections in this exact order:

1. Project Overview
2. Character Breakdown
3. Bold Choices
4. Two-Take Strategy
5. Moment Before & Button
6. Rehearsal Roadmap
7. Pre-Submission Checklist
8. Final Coach Note

CRITICAL RULES:

- The guide MUST NOT end before "Final Coach Note"
- If token pressure occurs, COMPRESS earlier sections
- NEVER truncate:
  - Two-Take Strategy
  - Checklist
  - Final Coach Note
  - Final Scene 3 physical instruction

If you cannot complete the guide:
OUTPUT:
"TRUNCATED — REQUEST PART 2"

OUTPUT:
- Return complete self-contained HTML only.
`.trim();

const ANALYSIS_SYSTEM_PROMPT = `
You are an audition coach creating structured analysis for downstream generation.

Output plain text only.

Include ONLY these sections:
1. Character Breakdown
2. Hagen Questions
3. Scene Action
4. Subtext
5. POV

Rules:
- NO HTML
- NO checklist
- NO coach note
- NO two-take strategy
- Keep the analysis grounded in provided script text and metadata.
`.trim();

const EXTRACT_MAX_TOKENS = 6000;
const ANALYSIS_MAX_TOKENS = 6000;
const SUMMARY_MAX_TOKENS = 800;
const GUIDE_MAX_TOKENS = 8000;

function getAnthropicText(data = {}) {
  const content = Array.isArray(data?.content) ? data.content : [];
  return content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function buildMetadataBlock(metadata = {}) {
  return [
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
}

function logTokenUsage(step, data, model, maxTokens) {
  const usage = data?.usage || {};
  console.log(
    `[ClaudePipeline] ${step} tokens -> model=${model} input=${usage.input_tokens ?? "n/a"} output=${usage.output_tokens ?? "n/a"} max=${maxTokens}`
  );
}

function recoverScreenplayFromFallback(ocrFallback = {}) {
  const sections = ocrFallback?.mapped?.sections || [];
  return sections
    .map((section) => String(section?.text || "").trim())
    .filter(Boolean)
    .filter((line) => line.length > 1)
    .filter((line) => !/Sides by Breakdown Services/i.test(line))
    .join("\n");
}

function markExtractionFailure(error) {
  const message = error?.message || "Unknown extraction failure";
  const wrapped = new Error(`EXTRACTION_FAILED: ${message}`);
  wrapped.cause = error;
  return wrapped;
}

function isExtractionFailure(error) {
  return /^EXTRACTION_FAILED:/i.test(String(error?.message || ""));
}

async function extractScreenplay({
  pdfBuffer,
  role = "",
  preferredModel,
  apiKey,
}) {
  const { data, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel,
    maxTokens: EXTRACT_MAX_TOKENS,
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
  logTokenUsage("extractScreenplay", data, model, EXTRACT_MAX_TOKENS);
  return { screenplayText, model, usage: data?.usage };
}

async function generateAnalysis({
  screenplayText,
  metadata,
  preferredModel,
  apiKey,
}) {
  const metaBlock = buildMetadataBlock(metadata);

  const { data, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel,
    maxTokens: ANALYSIS_MAX_TOKENS,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate a structured analysis from this screenplay and metadata.\n\n${metaBlock}\n\nSCREENPLAY:\n${screenplayText}`,
      },
    ],
  });

  const analysis = getAnthropicText(data);
  logTokenUsage("generateAnalysis", data, model, ANALYSIS_MAX_TOKENS);
  return { analysis, model, usage: data?.usage };
}

async function summarizeAnalysis({
  analysis,
  preferredModel,
  apiKey,
}) {
  const summaryMessage = {
    role: 'user',
    content: `From the analysis above, extract a concise summary (max 300 words).

Include ONLY:
- Character core conflict
- Scene-by-scene emotional arc (Scene 1, 2, 3)
- Key physicality anchors
- Central dramatic question

Rules:
- Plain text only (no HTML, no formatting)
- No explanation, no extra commentary
- No repetition of full analysis
- Keep it tight and usable as input for the next generation step`
  };

  const { data, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel,
    maxTokens: SUMMARY_MAX_TOKENS,
    messages: [
      {
        role: "assistant",
        content: analysis,
      },
      summaryMessage,
    ],
  });

  const summary = getAnthropicText(data);
  logTokenUsage("summarizeAnalysis", data, model, SUMMARY_MAX_TOKENS);
  return { summary, model, usage: data?.usage };
}

async function generateGuideHTML({
  summary,
  metadata,
  preferredModel,
  apiKey,
}) {
  const metaBlock = buildMetadataBlock(metadata);

  const { data, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel,
    maxTokens: GUIDE_MAX_TOKENS,
    system: GUIDE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate the full Prep101 HTML guide.

${metaBlock}

SUMMARY OF CHARACTER & SCENES:
${summary}`,
      },
    ],
  });

  const html = getAnthropicText(data);
  logTokenUsage("generateGuideHTML", data, model, GUIDE_MAX_TOKENS);

  if (!html.includes("Final Coach Note")) {
    throw new Error("Guide truncated — retry with compression");
  }
  if (!html.includes("Take A") || !html.includes("Take B")) {
    throw new Error("Missing Two-Take Strategy");
  }
  if (!/Pre-Submission Checklist/i.test(html)) {
    throw new Error("Missing checklist");
  }
  if (html.includes("TRUNCATED — REQUEST PART 2")) {
    throw new Error("Guide truncated — retry with compression");
  }

  return { html, model, usage: data?.usage };
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
  const metadata = {
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
  };

  const claudePipeline = async () => {
    let extraction;
    try {
      extraction = await extractScreenplay({
        pdfBuffer,
        role: characterName,
        apiKey,
      });
    } catch (error) {
      throw markExtractionFailure(error);
    }

    const screenplayText = extraction.screenplayText || "";
    const screenplayWordCount = (screenplayText.match(/\b[\w']+\b/g) || []).length;
    if (screenplayWordCount < 80) {
      throw markExtractionFailure(
        new Error("Claude extraction too thin for reliable guide generation")
      );
    }

    const analysisStep = await generateAnalysis({
      screenplayText,
      metadata,
      apiKey,
    });
    const summaryStep = await summarizeAnalysis({
      analysis: analysisStep.analysis,
      apiKey,
    });
    const guideStep = await generateGuideHTML({
      summary: summaryStep.summary,
      metadata,
      apiKey,
    });

    return {
      screenplayText,
      screenplayWordCount,
      analysisText: analysisStep.analysis,
      analysisSummary: summaryStep.summary,
      htmlGuide: guideStep.html,
      extractionModel: extraction.model,
      extractionMethod: "claude_document",
      analysisModel: analysisStep.model,
      summaryModel: summaryStep.model,
      guideModel: guideStep.model,
      tokenUsage: {
        extraction: extraction.usage || null,
        analysis: analysisStep.usage || null,
        summary: summaryStep.usage || null,
        guide: guideStep.usage || null,
      },
    };
  };

  const fallbackPipeline = async () => {
    const ocrFallback = await processPdfExtractionJob({
      filename: "upload.pdf",
      pdfBase64: pdfBuffer.toString("base64"),
    });

    const screenplayText = recoverScreenplayFromFallback(ocrFallback);
    const screenplayWordCount = (screenplayText.match(/\b[\w']+\b/g) || []).length;
    if (screenplayWordCount < 80) {
      throw new Error(
        "I was unable to read the uploaded sides. Please re-upload the PDF or paste the scene text directly. I cannot generate a useful preparation guide without the actual script."
      );
    }

    const analysisStep = await generateAnalysis({
      screenplayText,
      metadata,
      apiKey,
    });
    const summaryStep = await summarizeAnalysis({
      analysis: analysisStep.analysis,
      apiKey,
    });
    const guideStep = await generateGuideHTML({
      summary: summaryStep.summary,
      metadata,
      apiKey,
    });

    return {
      screenplayText,
      screenplayWordCount,
      analysisText: analysisStep.analysis,
      analysisSummary: summaryStep.summary,
      htmlGuide: guideStep.html,
      extractionModel: ocrFallback?.provider || "ocr_fallback",
      extractionMethod: `ocr_fallback:${ocrFallback?.provider || "unknown"}`,
      analysisModel: analysisStep.model,
      summaryModel: summaryStep.model,
      guideModel: guideStep.model,
      tokenUsage: {
        extraction: null,
        analysis: analysisStep.usage || null,
        summary: summaryStep.usage || null,
        guide: guideStep.usage || null,
      },
    };
  };

  try {
    return await claudePipeline();
  } catch (e) {
    if (!isExtractionFailure(e)) {
      throw e;
    }
    console.warn(
      `[ClaudePipeline] Primary pipeline failed: ${e.message}. Attempting OCR fallback pipeline.`
    );
    return fallbackPipeline();
  }
}

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  ANALYSIS_SYSTEM_PROMPT,
  GUIDE_SYSTEM_PROMPT,
  extractScreenplay,
  generateAnalysis,
  summarizeAnalysis,
  generateGuideHTML,
  generateGuideFromPdfTwoCall,
};
