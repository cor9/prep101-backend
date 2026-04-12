const fetch = require("node-fetch");
const { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS } = require("../../config/models");
const { scrubWatermarks } = require("../../services/textCleaner");

const CONTENT_SYSTEM_PROMPT = `You generate structured Reader101 guide content.

Return ONLY valid JSON.
Do not return markdown.
Do not return HTML.
Do not wrap the JSON in code fences.

Your job is to produce scene-specific reader coaching, not actor coaching.
Every bullet must be playable, specific, and written as one line.
Use consequence language often. Use "->" when it helps sharpen cause and effect.
Do not repeat the same note across sections.
Do not sanitize high-risk material. Keep it grounded and professional.`;

const SCHEMA_TEXT = `{
  "what_will_go_wrong": ["", "", ""],
  "why_it_matters": "",
  "performance_engine": {
    "drive_label": "",
    "drive_text": "",
    "drive_consequence": "",
    "fuel_label": "",
    "fuel_text": "",
    "fuel_consequence": ""
  },
  "scene_snapshot": [
    { "heading": "", "bullets": ["", ""] }
  ],
  "your_job": [""],
  "playing_multiple_characters": [""],
  "reader_fundamentals": [""],
  "key_beats": [""],
  "rhythm": [""],
  "do": [""],
  "avoid": [""],
  "connection": [""],
  "anchor_line": "",
  "tone_reference_anchor": [""],
  "quick_reset": [""],
  "intimacy_section": [],
  "emotional_arc_mapping": []
}`;

function countMeaningfulWords(text = "") {
  return (String(text || "").match(/\b[\w']+\b/g) || []).length;
}

function clipText(text = "", maxLength = 14000) {
  const cleaned = String(text || "").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}\n...[truncated]` : cleaned;
}

function parseJsonResponse(text = "") {
  const raw = String(text || "").trim();

  if (!raw) {
    throw new Error("Empty model response");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    }

    throw error;
  }
}

function validateStructuredContent(data = {}) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Response must be a JSON object."];
  }

  if (!Array.isArray(data.what_will_go_wrong) || data.what_will_go_wrong.length !== 3) {
    errors.push('"what_will_go_wrong" must be an array of exactly 3 strings.');
  }

  if (!data.why_it_matters || typeof data.why_it_matters !== "string") {
    errors.push('"why_it_matters" must be a string.');
  }

  if (!data.performance_engine || typeof data.performance_engine !== "object") {
    errors.push('"performance_engine" must be an object.');
  }

  const requiredArrays = [
    "scene_snapshot",
    "your_job",
    "playing_multiple_characters",
    "reader_fundamentals",
    "key_beats",
    "rhythm",
    "do",
    "avoid",
    "connection",
    "tone_reference_anchor",
    "quick_reset",
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(data[key]) || !data[key].length) {
      errors.push(`"${key}" must be a non-empty array.`);
    }
  }

  if (!data.anchor_line || typeof data.anchor_line !== "string") {
    errors.push('"anchor_line" must be a string.');
  }

  return errors;
}

function buildContentPrompt(meta = {}, validationFeedback = "") {
  const cleanedSceneText = scrubWatermarks(meta.sceneText || "").trim();
  const sceneWordCount = countMeaningfulWords(cleanedSceneText);
  const flags = Array.isArray(meta.flags) ? meta.flags : [];

  const metadataBlock = [
    meta.characterName ? `AUDITION ROLE: ${meta.characterName}` : "",
    meta.readerCharacterName ? `READER ROLE: ${meta.readerCharacterName}` : "",
    meta.actorAge ? `ACTOR AGE: ${meta.actorAge}` : "",
    meta.productionTitle ? `TITLE: ${meta.productionTitle}` : "",
    meta.productionType ? `FORMAT: ${meta.productionType}` : "",
    meta.genre ? `GENRE: ${meta.genre}` : "",
    meta.storyline ? `STORYLINE: ${meta.storyline}` : "",
    meta.templateStyle ? `TEMPLATE STYLE: ${meta.templateStyle}` : "",
    flags.length ? `FLAGS: ${flags.join(", ")}` : "",
    `FALLBACK MODE: ${meta.fallbackMode ? "true" : "false"}`,
    `MEANINGFUL WORDS: ${sceneWordCount}`,
  ]
    .filter(Boolean)
    .join("\n");

  const sceneBlock = meta.fallbackMode
    ? `SIDES STATUS:
- Treat the extracted sides as partial or unreliable.
- Use only clean metadata and any obviously readable story cues.
- Do not invent exact dialogue or fake line-specific beats.`
    : `READABLE SIDES:
${clipText(cleanedSceneText || "[No readable sides provided]")}`;

  const highRiskRules = flags.includes("high_risk")
    ? `HIGH-RISK RULES:
- Disable comedic framing.
- Force grounded realism.
- Increase consequence density.
- Fill "intimacy_section" with reader-facing directives only.
- Fill "emotional_arc_mapping" with shift-based action -> consequence bullets.
- The emotional progression is critical: curiosity -> participation -> awareness -> shame.
- If foster_style_scene is present, weight shame, stillness, neutrality, and containment heavily.`
    : `HIGH-RISK RULES:
- If the scene is not high-risk, return empty arrays for "intimacy_section" and "emotional_arc_mapping".`;

  return `Generate structured Reader101 content for the fixed HTML template system.

Return ONLY valid JSON that matches this schema exactly:
${SCHEMA_TEXT}

Global rules:
- Coach the reader on how to read the READER ROLE opposite the AUDITION ROLE.
- Never instruct the reader to "play" the audition character.
- If READER ROLE is present, treat that as the reader's character assignment throughout.
- Any character-specific vocal, physical, or behavioral note must refer to the READER ROLE, never the AUDITION ROLE.
- Every list item must be one line.
- Every list item must be a physical or vocal directive, never therapy language.
- "what_will_go_wrong" must contain exactly 3 bullets and each bullet must include a failure plus consequence.
- "your_job" must open by correcting the wrong instinct before the right move.
- "playing_multiple_characters" must contrast the reader roles clearly.
- "reader_fundamentals" is where readers quietly ruin auditions.
- "tone_reference_anchor" must start with consequence framing.
- Prefer direct lines from the sides when readable.
- If fallback mode is true, stay useful without pretending you saw clean lines.

${highRiskRules}

METADATA:
${metadataBlock}

${sceneBlock}

${validationFeedback ? `REVISION FEEDBACK:\n${validationFeedback}\n` : ""}

Return the JSON object now.`;
}

async function callAnthropic(prompt, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: Math.min(DEFAULT_CLAUDE_MAX_TOKENS, 3500),
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const text = payload?.content?.[0]?.text;

  if (!text) {
    throw new Error("Anthropic returned no text content.");
  }

  return text;
}

async function generateContent(meta = {}) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  let validationFeedback = "";
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const prompt = buildContentPrompt(meta, validationFeedback);
      const rawText = await callAnthropic(prompt, apiKey);
      const parsed = parseJsonResponse(rawText);
      const errors = validateStructuredContent(parsed);

      if (errors.length) {
        lastError = new Error(errors.join(" "));
        validationFeedback = errors.map((error) => `- ${error}`).join("\n");

        if (attempt < 2) {
          continue;
        }
      }

      return parsed;
    } catch (error) {
      lastError = error;

      if (attempt < 2) {
        validationFeedback = `- The previous response failed validation or JSON parsing.\n- ${error.message}`;
        continue;
      }
    }
  }

  throw lastError || new Error("Failed to generate structured Reader101 content");
}

module.exports = {
  buildContentPrompt,
  generateContent,
  validateStructuredContent,
};
