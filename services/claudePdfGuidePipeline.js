const { sendAnthropicMessage } = require("./anthropicClient");

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
You are an elite acting coach and generate practical, actor-facing Prep101 audition guides.

Write a complete HTML guide with:
1. Project Overview
2. Character Breakdown
3. Uta Hagen's 9 Questions (first-person character voice, grounded in script moments)
4. Scene Action & Physicality (scene-by-scene, specific)
5. Subtext Translation Table (at least 6 exact script lines)
6. Character POV & Personalization
7. Bold Choices (specific moments) + Two-Take Submission Strategy
8. Moment Before & Button
9. Rehearsal Roadmap (10+ specific takes)
10. Pre-Submission Checklist

Hard rules:
- Do not invent script lines.
- Coaching voice, not academic analysis.
- Output complete self-contained HTML only.
`.trim();

function getAnthropicText(data = {}) {
  const content = Array.isArray(data?.content) ? data.content : [];
  return content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
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
}) {
  const metaBlock = [
    `ROLE: ${metadata.characterName}`,
    `PROJECT TITLE: ${metadata.productionTitle}`,
    `PROJECT TYPE: ${metadata.productionType}`,
    metadata.genre ? `GENRE: ${metadata.genre}` : null,
    metadata.actorAge ? `ACTOR AGE: ${metadata.actorAge}` : null,
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
    maxTokens: 14000,
    system: GUIDE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate the full Prep101 HTML guide.\n\n${metaBlock}\n\nSCRIPT:\n${screenplayText}`,
      },
    ],
  });

  const html = getAnthropicText(data);
  return { html, model };
}

async function generateGuideFromPdfTwoCall({
  pdfBuffer,
  characterName,
  productionTitle,
  productionType,
  genre,
  actorAge,
  characterBreakdown,
  callbackNotes,
  apiKey,
}) {
  const extraction = await extractScreenplayFromPdf({
    pdfBuffer,
    role: characterName,
    apiKey,
  });

  const wordCount = (extraction.screenplayText.match(/\b[\w']+\b/g) || []).length;
  if (wordCount < 80) {
    throw new Error(
      "I was unable to read the uploaded sides. Please re-upload the PDF or paste the scene text directly. I cannot generate a useful preparation guide without the actual script."
    );
  }

  const guide = await generateGuideHtmlFromScreenplay({
    screenplayText: extraction.screenplayText,
    apiKey,
    metadata: {
      characterName,
      productionTitle,
      productionType,
      genre,
      actorAge,
      characterBreakdown,
      callbackNotes,
    },
  });

  return {
    screenplayText: extraction.screenplayText,
    screenplayWordCount: wordCount,
    htmlGuide: guide.html,
    extractionModel: extraction.model,
    guideModel: guide.model,
  };
}

module.exports = {
  EXTRACTION_SYSTEM_PROMPT,
  GUIDE_SYSTEM_PROMPT,
  generateGuideFromPdfTwoCall,
};

