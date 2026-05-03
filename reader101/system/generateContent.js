const { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS } = require("../../config/models");
const { sendAnthropicMessage } = require("../../services/anthropicClient");
const { scrubWatermarks } = require("../../services/textCleaner");

const CONTENT_SYSTEM_PROMPT = `You are Corey Ralston creating a Reader101 guide.

Reader101 Rule:
You are not coaching the actor. You are coaching the reader.
If any part of your response describes how the actor should perform, it is wrong.

Return ONLY valid JSON.
Do not return markdown.
Do not return HTML.
Do not wrap the JSON in code fences.

Reader101 is an actor protection system.
Your job is to stop the reader from ruining THIS specific audition.

Hard rules:
- No generic writing. No blog tone.
- Every sentence must be specific to this script and these lines.
- Max total guide length: 1,000 words across all sections combined.
- No section may exceed 6 bullets.
- Do NOT repeat any consequence phrase across bullets. Each consequence must be unique and scene-specific.
- Banned generic consequences (do not use): "the actor loses the support they need", "the scene dies instantly", "the actor feels the drop immediately", "the scene loses its pulse", "the emotional turn disappears", "the scene drifts off target".
- Coach pacing, tone, timing, listening, restraint, and presence only.
- Do NOT coach the reader to build character psychology.
- Use direct, plain language. No pseudo-prestige framing.
- If the guide could apply to a different show, it has failed.`;

const SCHEMA_TEXT = `{
  "your_job_sentence": "",
  "mistakes": ["", "", ""],
  "how_to_read": [""],
  "key_reader_lines": [""],
  "silence_and_interruptions": [""],
  "timing": [""],
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

function collectStrings(value, bucket = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, bucket));
    return bucket;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, bucket));
    return bucket;
  }

  if (typeof value === "string") {
    bucket.push(value);
  }

  return bucket;
}

function countQuotedReferences(value) {
  return collectStrings(value)
    .map((item) => String(item || ""))
    .filter((item) => /["""][^"""]{2,}["""]|'[^'\n]{3,}'/.test(item))
    .length;
}

function validateStructuredContent(data = {}, meta = {}) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Response must be a JSON object."];
  }

  if (!data.your_job_sentence || typeof data.your_job_sentence !== "string") {
    errors.push('"your_job_sentence" must be a non-empty string — one sentence that captures the reader\'s single most important function.');
  }

  if (!Array.isArray(data.mistakes) || data.mistakes.length !== 3) {
    errors.push('"mistakes" must be an array of exactly 3 strings.');
  }

  const requiredArrays = [
    "how_to_read",
    "key_reader_lines",
    "silence_and_interruptions",
    "timing",
    "quick_reset",
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(data[key]) || !data[key].length) {
      errors.push(`"${key}" must be a non-empty array.`);
    }
  }

  if (Array.isArray(data.how_to_read) && (data.how_to_read.length < 2 || data.how_to_read.length > 5)) {
    errors.push('"how_to_read" must contain 2 to 5 bullets.');
  }

  if (Array.isArray(data.key_reader_lines) && (data.key_reader_lines.length < 2 || data.key_reader_lines.length > 6)) {
    errors.push('"key_reader_lines" must contain 2 to 6 bullets.');
  }

  if (Array.isArray(data.silence_and_interruptions) && (data.silence_and_interruptions.length < 2 || data.silence_and_interruptions.length > 5)) {
    errors.push('"silence_and_interruptions" must contain 2 to 5 bullets.');
  }

  if (Array.isArray(data.timing) && (data.timing.length < 2 || data.timing.length > 5)) {
    errors.push('"timing" must contain 2 to 5 bullets.');
  }

  if (Array.isArray(data.quick_reset) && (data.quick_reset.length < 2 || data.quick_reset.length > 4)) {
    errors.push('"quick_reset" must contain 2 to 4 bullets.');
  }

  if (!meta.fallbackMode) {
    const keyLinesQuoteCount = countQuotedReferences(data.key_reader_lines);
    if (keyLinesQuoteCount < 2) {
      errors.push('"key_reader_lines" must quote at least 2 specific lines from the sides using quotation marks.');
    }

    const totalQuotes = countQuotedReferences([
      data.mistakes,
      data.how_to_read,
      data.key_reader_lines,
      data.silence_and_interruptions,
      data.timing,
    ]);
    if (totalQuotes < 6) {
      errors.push('You must quote at least 6 specific lines from the sides across the guide. No quote = no bullet.');
    }
  }

  return errors;
}

function buildContentPrompt(meta = {}, validationFeedback = "") {
  const cleanedSceneText = scrubWatermarks(meta.sceneText || "").trim();
  const sceneWordCount = countMeaningfulWords(cleanedSceneText);
  const flags = Array.isArray(meta.flags) ? meta.flags : [];
  const genreMode = String(meta.genreMode || "drama").toLowerCase();
  const childFocused = Boolean(meta.childFocused);
  const methodologyContext = String(meta.methodologyContext || "").trim();
  const retrievalSignals = meta.retrievalSignals || {};

  const readerCharacterNames = Array.isArray(meta.readerCharacterNames) ? meta.readerCharacterNames : [];
  const multipleReaders = readerCharacterNames.length > 1;

  const metadataBlock = [
    meta.characterName ? `AUDITION ROLE: ${meta.characterName}` : "",
    meta.readerCharacterName ? `READER ROLE: ${meta.readerCharacterName}` : "",
    multipleReaders ? `READER ROLES: ${readerCharacterNames.join(", ")}` : "",
    meta.actorAge ? `ACTOR AGE: ${meta.actorAge}` : "",
    meta.productionTitle ? `TITLE: ${meta.productionTitle}` : "",
    meta.productionType ? `FORMAT: ${meta.productionType}` : "",
    meta.genre ? `GENRE: ${meta.genre}` : "",
    meta.storyline ? `STORYLINE: ${meta.storyline}` : "",
    meta.genreMode ? `GENRE MODE: ${meta.genreMode}` : "",
    `CHILD FOCUSED: ${childFocused ? "true" : "false"}`,
    `MULTIPLE READER ROLES: ${multipleReaders ? "true" : "false"}`,
    flags.length ? `FLAGS: ${flags.join(", ")}` : "",
    `FALLBACK MODE: ${meta.fallbackMode ? "true" : "false"}`,
    `MEANINGFUL WORDS: ${sceneWordCount}`,
    meta.structure ? `SCENE PACE: ${meta.structure.pace}` : "",
    meta.structure ? `BEAT COUNT: ${meta.structure.beat_count}` : "",
    meta.structure ? `INTERRUPTIONS: ${meta.structure.interruption_count}` : ""
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

  const methodologyBlock = methodologyContext
    ? `RANKED METHODOLOGY MEMORY (READER101 FILTERED):
${clipText(methodologyContext, 4000)}

RETRIEVAL SIGNALS:
- Primary Archetype: ${retrievalSignals.primaryArchetype || "general"}
- Secondary Archetype: ${retrievalSignals.secondaryArchetype || "none"}
- Hagen Want: ${Array.isArray(retrievalSignals.hagen?.want) ? retrievalSignals.hagen.want.join(" | ") || "not clear" : "not clear"}
`
    : `RANKED METHODOLOGY MEMORY:
- No retrieval chunks available. Stay script-faithful and role-locked.`;

  const highRiskRules = flags.includes("high_risk")
    ? `HIGH-RISK RULES:
- Disable comedic framing.
- Force grounded realism.
- Fill "intimacy_section" with reader-facing directives only.
- Fill "emotional_arc_mapping" with shift-based action -> consequence bullets.`
    : `HIGH-RISK RULES:
- If the scene is not high-risk, return empty arrays for "intimacy_section" and "emotional_arc_mapping".`;

  const roleLockBlock = `ROLE LOCK:
- Reader101 mode. You are coaching the reader, not the actor.
- Do NOT analyze character psychology.
- DO focus on timing, delivery, listening, and restraint.`;

  const ACTOR_ROLE = meta.characterName ? meta.characterName.trim() : "the actor";
  const guardrail = `
ACTOR ROLE: ${ACTOR_ROLE}
READER ROLE(S): ${readerCharacterNames.join(", ") || meta.readerCharacterName || "scene partner"}

You are ONLY coaching the reader on how to support ${ACTOR_ROLE}.
Do NOT give direction for ${ACTOR_ROLE}'s performance.
Every instruction must answer: "What must the reader NOT mess up?"

INTERNAL TRANSLATION RULE (MANDATORY):
Before outputting any instruction, convert ALL actor insight into reader responsibility.
"${ACTOR_ROLE} needs resistance" → "If you soften here, ${ACTOR_ROLE} loses the wall they need."
"${ACTOR_ROLE} should play this angry" → "Do not pacify the scene; your neutrality is what ${ACTOR_ROLE} has to fight against."
`;

  const multipleCharactersNote = multipleReaders
    ? `MULTIPLE READER ROLES NOTE:
The reader plays ${readerCharacterNames.join(" and ")}. In "how_to_read", briefly distinguish the register difference between these roles in ONE bullet. Keep it surgical — one line per contrast. Do not write a full separate section for this.`
    : `SINGLE READER ROLE NOTE:
There is one reader character. Do not invent or imply multiple roles. Do not add multi-character contrast notes.`;

  const genreModeNote = `GENRE MODE: ${genreMode.toUpperCase()}
${genreMode === "multicam"
    ? "Fast pacing, hard cuts, reader stays grounded while actor escalates. No joke signaling."
    : genreMode === "singlecam_comedy"
      ? "Natural pace, subtle reversals, reader slightly reactive but never anticipates."
      : genreMode === "thriller_horror"
        ? "Reader is pressure source. Tension over warmth, loaded silence."
        : genreMode === "teen_drama"
          ? "Controlled emotional mirroring. Keep stakes large, avoid melodrama."
          : "Slower pacing, silence matters, reader as container."
}`;

  const userPrompt = `Generate a Reader101 guide. Return ONLY valid JSON matching this schema exactly:
${SCHEMA_TEXT}

FIELD INSTRUCTIONS:

"your_job_sentence": ONE sentence. The single most important thing the reader must do in this specific scene. Not general advice — anchor it to the scene's central dynamic.

"mistakes": Exactly 3 bullets. Each bullet = one specific reader failure + what specifically breaks in THIS scene (not a generic phrase). Quote the relevant line where possible.

"how_to_read": 2–5 bullets. Practical behavior for the reader reading ${meta.readerCharacterName || "the reader role"} opposite ${ACTOR_ROLE}. Cover tone, emotional register, energy level, and any key contrast needed. If multiple reader roles exist, one bullet may note the register difference.

"key_reader_lines": 2–6 bullets. Each bullet MUST open with a direct quote from the sides in quotation marks, then the specific delivery note. No quote = no bullet.

"silence_and_interruptions": 2–5 bullets. Cover: (a) when to hold silence and let the actor work, (b) how to handle interruption beats, (c) stage directions like "(beat)" or "Long beat" that the reader must honor. Specific to THIS scene's actual beats.

"timing": 2–5 bullets. Scene-specific notes on pacing, energy shifts, where the scene speeds up or slows down, and how to read the opening vs. closing exchange. No generic pacing advice.

"quick_reset": 2–4 bullets. Live self-tape rescue notes — if something went wrong in the previous take, what to fix on the next one. Each bullet should start with the problem ("If you rushed..." / "If it felt flat...").

GLOBAL RULES:
- SCRIPT-FAITHFUL: Only use character names explicitly in the provided sides.
- CITATION RULE: Every bullet in "key_reader_lines" must open with a quoted line. Other sections should quote lines where possible.
- MAX 1,000 WORDS total across all sections.
- No repeated consequence phrases. Each bullet has a unique, scene-specific consequence.
- No pseudo-prestige language. Plain, direct, usable.
- If fallback mode is true, stay useful without pretending you saw clean lines.

${multipleCharactersNote}
${genreModeNote}
${highRiskRules}
${roleLockBlock}

METADATA:
${metadataBlock}

${sceneBlock}
${methodologyBlock}

${validationFeedback ? `REVISION FEEDBACK:\n${validationFeedback}\n` : ""}

Return the JSON object now.`;

  return guardrail + "\n\n" + userPrompt;
}

function invalidReaderOutput(output, actorRole) {
  if (!output || !actorRole) return false;
  const lower = String(output).toLowerCase();
  const role = String(actorRole).toLowerCase().trim();

  return (
    lower.includes(`play ${role}`) ||
    lower.includes(`${role} should`) ||
    lower.includes(`for ${role}'s performance`) ||
    lower.includes(`the actor playing ${role}`)
  );
}

async function callAnthropic(prompt, apiKey, signal) {
  const { data: payload, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel: DEFAULT_CLAUDE_MODEL,
    maxTokens: Math.min(DEFAULT_CLAUDE_MAX_TOKENS, 2500),
    system: CONTENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    signal,
  });

  const text = payload?.content?.[0]?.text;

  if (!text) {
    throw new Error("Anthropic returned no text content.");
  }

  if (model !== DEFAULT_CLAUDE_MODEL) {
    console.warn(
      `[Reader101] Used fallback model ${model} (primary ${DEFAULT_CLAUDE_MODEL} unavailable)`
    );
  }

  return text;
}

async function generateContent(meta = {}, options = {}) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
  const signal = options.signal;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  let validationFeedback = "";
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const prompt = buildContentPrompt(meta, validationFeedback);
      const rawText = await callAnthropic(prompt, apiKey, signal);
      const parsed = parseJsonResponse(rawText);
      const errors = validateStructuredContent(parsed, meta);

      const ACTOR_ROLE = meta.characterName ? meta.characterName.trim() : "";
      if (ACTOR_ROLE && invalidReaderOutput(rawText, ACTOR_ROLE)) {
        errors.push("You incorrectly gave actor coaching. Fix it. You are ONLY coaching the reader.");
      }

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
