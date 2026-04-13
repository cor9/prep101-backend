/**
 * screenplayParser.js
 *
 * Drop-in parser for screenplay-style PDF extracted text.
 * Designed to:
 * 1. Identify real speaking characters
 * 2. Reclassify editorial labels like SHOT / INSERT / SECURITY CAM FOOTAGE as stage directions
 * 3. Produce structured scene data for Prep101 / Reader101 / Bold Choices
 */

const DEFAULT_NON_CHARACTER_LABELS = new Set([
  "SHOT",
  "SHOTS",
  "INSERT",
  "INSERTS",
  "CUT TO",
  "CUT TO:",
  "DISSOLVE TO",
  "FADE IN",
  "FADE OUT",
  "ANGLE ON",
  "ANGLES ON",
  "WIDE",
  "WIDE SHOT",
  "CLOSE ON",
  "CLOSE-UP",
  "CLOSE UP",
  "POV",
  "O.S.",
  "O.S",
  "OFF SCREEN",
  "OFF-SCREEN",
  "V.O.",
  "V.O",
  "VOICE OVER",
  "VOICE-OVER",
  "MONTAGE",
  "SERIES OF SHOTS",
  "SECURITY CAM FOOTAGE",
  "SURVEILLANCE FOOTAGE",
  "CAM FOOTAGE",
  "PHONE VIDEO",
  "VIDEO FOOTAGE",
  "ARCHIVAL FOOTAGE",
  "HOME VIDEO",
  "FLASHBACK",
  "FLASHBACK TO",
  "INTERCUT",
  "INTERCUT WITH",
  "CONTINUOUS",
  "LATER",
  "MOMENTS LATER",
  "SAME",
  "END",
  "START"
]);

const DEFAULT_SCENE_HEADING_PREFIXES = [
  "INT.",
  "EXT.",
  "INT/EXT.",
  "INT./EXT.",
  "EXT./INT."
];

function normalizeText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Fix common PDF junk / OCR issues
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    // Remove common breakdown services footer junk lines later, but normalize first
    .replace(/\t/g, " ")
    // Collapse weird repeated spaces
    .replace(/[ ]{2,}/g, " ")
    // Remove lines that are just page numbers / broken counters
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function isSceneHeading(line) {
  const trimmed = line.trim();
  return DEFAULT_SCENE_HEADING_PREFIXES.some((prefix) =>
    trimmed.startsWith(prefix)
  );
}

function isLikelyParenthetical(line) {
  const trimmed = line.trim();
  return /^\(.+\)$/.test(trimmed);
}

function cleanSpeakerLabel(line) {
  return line
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\(CONT'D\)|\(CONTD\)|\(CONT’D\)/gi, "")
    .replace(/:+$/, "")
    .trim();
}

function upperRatio(str) {
  if (!str) return 0;
  const letters = str.replace(/[^A-Za-z]/g, "");
  if (!letters.length) return 0;
  const uppers = letters.replace(/[^A-Z]/g, "").length;
  return uppers / letters.length;
}

function isMostlyUppercase(line) {
  return upperRatio(line) >= 0.85;
}

function looksLikeEditorialLabel(line, nonCharacterLabels) {
  const cleaned = cleanSpeakerLabel(line).toUpperCase();

  if (nonCharacterLabels.has(cleaned)) return true;

  // Common colon-based editorial labels
  if (
    cleaned.endsWith(":") &&
    nonCharacterLabels.has(cleaned.slice(0, -1).trim())
  ) {
    return true;
  }

  // If it contains obvious editorial phrases
  const editorialFragments = [
    "SHOT",
    "FOOTAGE",
    "INSERT",
    "ANGLE ON",
    "CUT TO",
    "FLASHBACK",
    "MONTAGE",
    "INTERCUT",
    "CLOSE ON",
    "WIDE",
    "POV"
  ];

  return editorialFragments.some((frag) => cleaned.includes(frag));
}

function looksLikeSpeakerLabel(line, nonCharacterLabels) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 40) return false;
  if (isSceneHeading(trimmed)) return false;
  if (isLikelyParenthetical(trimmed)) return false;
  if (looksLikeEditorialLabel(trimmed, nonCharacterLabels)) return false;

  const cleaned = cleanSpeakerLabel(trimmed);

  // Typical screenplay speaker lines are mostly uppercase
  if (!isMostlyUppercase(cleaned)) return false;

  // Avoid lines that are obviously descriptive/action
  if (/[.!?]/.test(cleaned)) return false;

  // Avoid isolated page/footer fragments
  if (/^SIDES BY /i.test(cleaned)) return false;
  if (/^OPTION \d+/i.test(cleaned)) return false;
  if (/^\d+\/\d+$/.test(cleaned)) return false;
  if (/^\d+\.$/.test(cleaned)) return false;

  // Usually 1-4 tokens
  const words = cleaned.split(/\s+/);
  if (words.length > 5) return false;

  return true;
}

function isGarbageLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  return (
    /^Sides by Breakdown Services/i.test(trimmed) ||
    /^Actors Access/i.test(trimmed) ||
    /^\d+\.$/.test(trimmed) ||
    /^\d+\/\d+$/.test(trimmed) ||
    /^option \d+/i.test(trimmed) ||
    /^sc \d+ of \d+/i.test(trimmed) ||
    /^START$/i.test(trimmed) ||
    /^END$/i.test(trimmed)
  );
}

function isDialogueContentLine(line, nonCharacterLabels) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isSceneHeading(trimmed)) return false;
  if (looksLikeSpeakerLabel(trimmed, nonCharacterLabels)) return false;
  if (looksLikeEditorialLabel(trimmed, nonCharacterLabels)) return false;
  if (isGarbageLine(trimmed)) return false;

  return true;
}

function parseScreenplayText(rawText, options = {}) {
  const {
    actorCharacter = null,
    nonCharacterLabels = DEFAULT_NON_CHARACTER_LABELS
  } = options;

  const text = normalizeText(rawText);
  const lines = text.split("\n");

  const sceneHeadings = [];
  const stageDirections = [];
  const dialogueBlocks = [];
  const characters = new Set();
  const nonCharacterLabelsFound = new Set();

  let currentScene = null;
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] || "";
    const line = rawLine.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (isGarbageLine(line)) {
      i += 1;
      continue;
    }

    if (isSceneHeading(line)) {
      currentScene = line;
      sceneHeadings.push({
        scene: line,
        lineIndex: i
      });
      i += 1;
      continue;
    }

    // Reclassify fake "speaker" labels as stage directions
    if (looksLikeEditorialLabel(line, nonCharacterLabels)) {
      nonCharacterLabelsFound.add(cleanSpeakerLabel(line).toUpperCase());

      const editorialBlock = [line];
      let j = i + 1;

      while (j < lines.length) {
        const next = (lines[j] || "").trim();
        if (!next) {
          j += 1;
          break;
        }
        if (
          isSceneHeading(next) ||
          looksLikeSpeakerLabel(next, nonCharacterLabels) ||
          looksLikeEditorialLabel(next, nonCharacterLabels)
        ) {
          break;
        }
        if (isGarbageLine(next)) {
          j += 1;
          continue;
        }
        editorialBlock.push(next);
        j += 1;
      }

      stageDirections.push({
        type: "editorial",
        scene: currentScene,
        content: editorialBlock.join(" "),
        lineIndex: i
      });

      i = j;
      continue;
    }

    // Real dialogue speaker
    if (looksLikeSpeakerLabel(line, nonCharacterLabels)) {
      const speaker = cleanSpeakerLabel(line);
      characters.add(speaker);

      let parenthetical = null;
      const contentLines = [];
      let j = i + 1;

      // Optional immediate parenthetical
      if (j < lines.length && isLikelyParenthetical((lines[j] || "").trim())) {
        parenthetical = (lines[j] || "").trim();
        j += 1;
      }

      while (j < lines.length) {
        const next = (lines[j] || "").trim();

        if (!next) {
          if (contentLines.length > 0) {
            j += 1;
            break;
          }
          j += 1;
          continue;
        }

        if (isGarbageLine(next)) {
          j += 1;
          continue;
        }

        if (
          isSceneHeading(next) ||
          looksLikeSpeakerLabel(next, nonCharacterLabels) ||
          looksLikeEditorialLabel(next, nonCharacterLabels)
        ) {
          break;
        }

        // Parenthetical mid-dialogue
        if (isLikelyParenthetical(next) && contentLines.length === 0 && !parenthetical) {
          parenthetical = next;
          j += 1;
          continue;
        }

        if (isDialogueContentLine(next, nonCharacterLabels)) {
          contentLines.push(next);
          j += 1;
          continue;
        }

        break;
      }

      dialogueBlocks.push({
        type: "dialogue",
        scene: currentScene,
        speaker,
        parenthetical,
        text: contentLines.join(" ").trim(),
        lineIndex: i
      });

      i = j;
      continue;
    }

    // Everything else = stage direction / action
    const actionBlock = [line];
    let j = i + 1;

    while (j < lines.length) {
      const next = (lines[j] || "").trim();
      if (!next) {
        j += 1;
        break;
      }
      if (
        isSceneHeading(next) ||
        looksLikeSpeakerLabel(next, nonCharacterLabels) ||
        looksLikeEditorialLabel(next, nonCharacterLabels)
      ) {
        break;
      }
      if (isGarbageLine(next)) {
        j += 1;
        continue;
      }
      actionBlock.push(next);
      j += 1;
    }

    stageDirections.push({
      type: "action",
      scene: currentScene,
      content: actionBlock.join(" "),
      lineIndex: i
    });

    i = j;
  }

  // Filter out actor character from reader roles
  const allCharacters = Array.from(characters);
  const readerRoles = actorCharacter
    ? allCharacters.filter(
        (name) => name.toUpperCase() !== actorCharacter.trim().toUpperCase()
      )
    : allCharacters;

  return {
    actorCharacter,
    characters: allCharacters,
    readerRoles,
    sceneHeadings,
    dialogueBlocks,
    stageDirections,
    nonCharacterLabelsFound: Array.from(nonCharacterLabelsFound)
  };
}

module.exports = {
  parseScreenplayText,
  normalizeText,
  looksLikeSpeakerLabel,
  looksLikeEditorialLabel
};
