const { sendAnthropicMessage } = require("./anthropicClient");
const { DEFAULT_CLAUDE_MODEL } = require("../config/models");

// LineCue / Scene Rehearsal: turn extracted sides text into an ordered array of
// dialogue lines, each with a display version (what the actor reads) and a
// TTS version (what the scene partner voice speaks).

const REHEARSAL_MODEL = process.env.REHEARSAL_CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
const REHEARSAL_MAX_TOKENS = parseInt(
  process.env.REHEARSAL_CLAUDE_MAX_TOKENS || "16000",
  10
);
// Sides are a handful of pages. Anything this large is almost certainly a full
// screenplay, which we reject rather than silently truncate.
const MAX_SCRIPT_CHARS = 200000;

const EMOTIONS = ["anger", "sadness", "surprise", "neutral"];

const EXTRACT_SCENE_DIALOGUE_TOOL = {
  name: "extract_scene_dialogue",
  description:
    "Extracts dialogue and prepares optimized text-to-speech (TTS) output.",
  // strict: the API guarantees the tool input validates against the schema,
  // which requires additionalProperties: false on every object.
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      dialogue_lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "integer" },
            character: { type: "string" },
            display_text: { type: "string" },
            emotion: { type: "string", enum: EMOTIONS },
            tts_text: {
              type: "string",
              description:
                "Phonetically optimized for TTS. Replace rhetorical '?' with '.', replace '--' with '...', and remove bracketed action lines.",
            },
          },
          required: ["id", "character", "display_text", "emotion", "tts_text"],
          additionalProperties: false,
        },
      },
    },
    required: ["dialogue_lines"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You prepare audition sides for LineCue, a rehearsal tool where a child or teen actor runs lines against a synthesized scene partner.

Call the extract_scene_dialogue tool exactly once with every spoken line in the scene, in script order. Do not reply with prose.

Rules:
- One entry per continuous speech by one character. Number ids from 1 with no gaps.
- character: the speaker's name in uppercase as written in the script, without extensions like (V.O.), (O.S.), or (CONT'D).
- display_text: the line as the actor should read it, with the script's wording and punctuation. Keep short parentheticals such as (beat) or (whispering) here.
- tts_text: the same words prepared for a speech engine. Remove anything in brackets or parentheses and any action description. Replace "--" with "...". Turn rhetorical questions (ones that do not expect an answer) into statements ending in "."; keep genuine questions as "?". Spell out symbols a voice would stumble on.
- emotion: the dominant delivery for the line, one of anger, sadness, surprise, neutral. Use neutral when unsure.
- Skip scene headings, action lines, transitions, page headers, watermarks, and production notes. They are not dialogue.
- If the text contains no dialogue, call the tool with an empty dialogue_lines array.`;

class RehearsalExtractionError extends Error {
  constructor(message, { code = "REHEARSAL_EXTRACTION_FAILED", status = 502 } = {}) {
    super(message);
    this.name = "RehearsalExtractionError";
    this.code = code;
    this.status = status;
  }
}

// Deterministic safety net for the TTS rules the model was asked to follow.
// Rhetorical-question handling is left to the model; it needs to read context.
function sanitizeTtsText(text = "") {
  return String(text)
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*(?:--|—)\s*/g, "... ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeDialogueLines(rawLines) {
  if (!Array.isArray(rawLines)) {
    throw new RehearsalExtractionError(
      "Claude returned dialogue_lines that is not an array."
    );
  }

  return rawLines
    .filter((line) => line && typeof line === "object")
    .map((line) => ({
      character: String(line.character || "").trim().toUpperCase(),
      display_text: String(line.display_text || "").trim(),
      emotion: EMOTIONS.includes(line.emotion) ? line.emotion : "neutral",
      tts_text: sanitizeTtsText(line.tts_text || line.display_text),
    }))
    .filter((line) => line.character && line.display_text && line.tts_text)
    .map((line, index) => ({ id: index + 1, ...line }));
}

async function extractStructuredRehearsalScript(extractedPdfText, { signal } = {}) {
  const scriptText = String(extractedPdfText || "").trim();
  if (!scriptText) {
    throw new RehearsalExtractionError("No script text to extract dialogue from.", {
      code: "EMPTY_SCRIPT",
      status: 422,
    });
  }
  if (scriptText.length > MAX_SCRIPT_CHARS) {
    throw new RehearsalExtractionError(
      "This script is too long for rehearsal mode. Upload just the audition sides.",
      { code: "SCRIPT_TOO_LONG", status: 413 }
    );
  }

  // tool_choice stays "auto": forced tool choice ({type: "tool"}) is rejected
  // by newer models (Sonnet 5.5 / Opus 5.5), and REHEARSAL_CLAUDE_MODEL may
  // point at one. The system prompt requires the call and we verify it below.
  const result = await sendAnthropicMessage({
    apiKey: (process.env.ANTHROPIC_API_KEY || "").trim(),
    preferredModel: REHEARSAL_MODEL,
    maxTokens: REHEARSAL_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_SCENE_DIALOGUE_TOOL],
    toolChoice: { type: "auto", disable_parallel_tool_use: true },
    messages: [
      {
        role: "user",
        content: `<script>\n${scriptText}\n</script>`,
      },
    ],
    signal,
  });

  const { data, model, stopReason } = result;

  if (stopReason === "refusal") {
    throw new RehearsalExtractionError(
      "Claude declined to process this script.",
      { code: "MODEL_REFUSAL", status: 422 }
    );
  }
  if (stopReason === "max_tokens") {
    throw new RehearsalExtractionError(
      "The scene is too long to extract in one pass. Try uploading fewer pages.",
      { code: "OUTPUT_TRUNCATED", status: 413 }
    );
  }

  const toolUse = (Array.isArray(data?.content) ? data.content : []).find(
    (block) =>
      block?.type === "tool_use" && block?.name === EXTRACT_SCENE_DIALOGUE_TOOL.name
  );
  if (!toolUse) {
    throw new RehearsalExtractionError(
      `Claude did not return structured dialogue (stop_reason=${stopReason}, model=${model}).`
    );
  }

  const dialogueLines = normalizeDialogueLines(toolUse.input?.dialogue_lines);

  return {
    dialogueLines,
    characters: [...new Set(dialogueLines.map((line) => line.character))],
    model,
    usage: data?.usage || null,
  };
}

module.exports = {
  EXTRACT_SCENE_DIALOGUE_TOOL,
  RehearsalExtractionError,
  extractStructuredRehearsalScript,
  __private: { normalizeDialogueLines, sanitizeTtsText },
};
