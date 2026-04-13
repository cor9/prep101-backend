/**
 * screenplayRepair.js
 *
 * Fixes common PDF extraction issues BEFORE parsing:
 * - Vertical stacking text
 * - Broken dialogue lines
 * - Split character names
 * - Footer/header junk
 */

function repairScreenplayText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  let text = rawText;

  // Normalize line endings early
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove obvious junk lines
  const JUNK_PATTERNS = [
    /^Sides by Breakdown Services/i,
    /^Actors Access/i,
    /^Page \d+/i,
    /^\d+\/\d+$/,
    /^option \d+/i,
    /^sc \d+ of \d+/i
  ];

  let lines = text.split("\n").map(l => l.trim());

  lines = lines.filter(line => {
    if (!line) return true;
    return !JUNK_PATTERNS.some(p => p.test(line));
  });

  // --- FIX 1: Vertical stacking (letters broken across lines) ---
  // Example:
  // A
  // L
  // I
  // C
  // E
  // -> ALICE

  const repairedLines = [];
  let buffer = [];

  function flushBuffer() {
    if (buffer.length > 1) {
      const joined = buffer.join("");
      repairedLines.push(joined);
    } else if (buffer.length === 1) {
      repairedLines.push(buffer[0]);
    }
    buffer = [];
  }

  for (let line of lines) {
    if (/^[A-Z]$/.test(line)) {
      buffer.push(line);
    } else {
      flushBuffer();
      repairedLines.push(line);
    }
  }
  flushBuffer();

  lines = repairedLines;

  // --- FIX 2: Merge broken dialogue lines ---
  // If a line ends without punctuation and next line is lowercase → merge

  const mergedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let current = lines[i];
    let next = lines[i + 1];

    if (
      current &&
      next &&
      !/[.!?:"-]$/.test(current) &&
      /^[a-z]/.test(next)
    ) {
      mergedLines.push(current + " " + next);
      i++;
    } else {
      mergedLines.push(current);
    }
  }

  lines = mergedLines;

  // --- FIX 3: Merge split character names ---
  // Example:
  // AL
  // ICE
  // -> ALICE

  const finalLines = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1];

    if (
      current &&
      next &&
      /^[A-Z]{1,3}$/.test(current) &&
      /^[A-Z]{2,}$/.test(next)
    ) {
      finalLines.push(current + next);
      i++;
    } else {
      finalLines.push(current);
    }
  }

  return finalLines.join("\n");
}

module.exports = { repairScreenplayText };
