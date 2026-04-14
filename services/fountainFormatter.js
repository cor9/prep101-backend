"use strict";

function escapeLiteralText(text) {
  if (!text) return "";
  const trimmed = text.trimStart();
  if (
    trimmed.startsWith("!") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("=") ||
    trimmed.startsWith(">") ||
    trimmed.startsWith(".")
  ) {
    return "\\" + text;
  }
  return text;
}

function normalizeText(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatTitlePage(script) {
  const lines = [];
  if (script.title) lines.push(`Title: ${script.title}`);
  if (script.credit) lines.push(`Credit: ${script.credit}`);
  if (script.author) lines.push(`Author: ${script.author}`);
  if (script.source) lines.push(`Source: ${script.source}`);

  if (Array.isArray(script.notes) && script.notes.length > 0) {
    lines.push(`Notes: ${script.notes[0]}`);
    for (let i = 1; i < script.notes.length; i += 1) {
      lines.push(`    ${script.notes[i]}`);
    }
  }

  return lines.length ? `${lines.join("\n")}\n\n` : "";
}

function formatSceneHeading(text) {
  const value = normalizeText(text);
  if (!value) return "";
  const upper = value.toUpperCase();
  if (/^(INT\.|EXT\.|EST\.|INT\/EXT\.|I\/E\.)/.test(upper)) {
    return upper;
  }
  return `.${value}`;
}

function formatCharacter(text) {
  return normalizeText(text).toUpperCase();
}

function formatParenthetical(text) {
  const value = normalizeText(text);
  if (!value) return "";
  if (/^\(.*\)$/.test(value)) return value;
  return `(${value})`;
}

function formatCentered(text) {
  const value = normalizeText(text);
  if (!value) return "";
  return `> ${value} <`;
}

function formatTransition(text) {
  const value = normalizeText(text).toUpperCase();
  if (!value) return "";
  if (value.endsWith("TO:")) return value;
  return `${value}:`;
}

function formatSynopsis(text) {
  const value = normalizeText(text);
  if (!value) return "";
  return `= ${value}`;
}

function formatSection(text, depth = 1) {
  const value = normalizeText(text);
  if (!value) return "";
  const safeDepth = Math.max(1, Number.isInteger(depth) ? depth : 1);
  return `${"#".repeat(safeDepth)} ${value}`;
}

function formatElement(element) {
  if (!element || typeof element !== "object") return [];
  const type = element.type;
  const rawText = typeof element.text === "string" ? element.text : "";

  switch (type) {
    case "scene_heading":
      return [formatSceneHeading(rawText)];
    case "action":
      return [escapeLiteralText(normalizeText(rawText))];
    case "character":
      return [formatCharacter(rawText)];
    case "parenthetical":
      return [formatParenthetical(rawText)];
    case "dialogue":
      return [normalizeText(rawText)];
    case "transition":
      return [formatTransition(rawText)];
    case "centered":
      return [formatCentered(rawText)];
    case "synopsis":
      return [formatSynopsis(rawText)];
    case "section":
      return [formatSection(rawText, element.depth)];
    case "page_break":
      return ["==="];
    case "line_break":
      return [""];
    default:
      return [escapeLiteralText(normalizeText(rawText))];
  }
}

function formatFountain(script, options = {}) {
  if (!script || !Array.isArray(script.elements)) {
    throw new Error("formatFountain: script.elements must be an array");
  }

  const includeTitlePage = options.includeTitlePage !== false;
  const trimTrailingWhitespace = options.trimTrailingWhitespace !== false;
  const output = [];

  if (includeTitlePage) {
    output.push(formatTitlePage(script));
  }

  const elements = script.elements;
  for (let i = 0; i < elements.length; i += 1) {
    const current = elements[i];
    const prev = i > 0 ? elements[i - 1] : null;
    const next = i < elements.length - 1 ? elements[i + 1] : null;
    const lines = formatElement(current);
    if (!lines.length) continue;

    const currentType = current.type;
    const prevType = prev?.type;
    const nextType = next?.type;

    const isDialogueBlockType =
      currentType === "character" ||
      currentType === "parenthetical" ||
      currentType === "dialogue";
    const prevIsDialogueBlockType =
      prevType === "character" ||
      prevType === "parenthetical" ||
      prevType === "dialogue";
    const nextIsDialogueBlockType =
      nextType === "character" ||
      nextType === "parenthetical" ||
      nextType === "dialogue";

    if (
      output.length > 0 &&
      !prevIsDialogueBlockType &&
      currentType !== "line_break"
    ) {
      const lastChunk = output[output.length - 1];
      if (!String(lastChunk).endsWith("\n\n")) {
        output.push("\n");
      }
    }

    if (isDialogueBlockType && prevIsDialogueBlockType) {
      if (!String(output[output.length - 1]).endsWith("\n")) {
        output.push("\n");
      }
    }

    output.push(lines.join("\n"));

    if (isDialogueBlockType && !nextIsDialogueBlockType) {
      output.push("\n\n");
    } else if (currentType === "line_break") {
      output.push("\n");
    } else if (!isDialogueBlockType) {
      output.push("\n");
    }
  }

  let result = output.join("");
  if (trimTrailingWhitespace) {
    result = `${result
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()}\n`;
  }
  return result;
}

function writeFountainFile(fs, outputPath, script, options = {}) {
  const fountain = formatFountain(script, options);
  fs.writeFileSync(outputPath, fountain, "utf8");
}

module.exports = {
  formatFountain,
  writeFountainFile,
};
