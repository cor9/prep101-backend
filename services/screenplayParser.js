/**
 * screenplayParser.js
 *
 * Drop-in parser for screenplay-style PDF extracted text.
 * Fixed character detection logic to strictly require dialogue.
 */

const NON_CHARACTER_PATTERNS = [
  "SHOT",
  "ANGLE",
  "INSERT",
  "CUT TO",
  "FADE",
  "CAMERA",
  "FOOTAGE",
  "MONTAGE",
  "WIDE",
  "CLOSE ON",
  "POV",
  "INTERCUT"
];

function normalizeText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function upperRatio(str) {
  if (!str) return 0;
  const letters = str.replace(/[^A-Za-z]/g, "");
  if (!letters.length) return 0;
  const uppers = letters.replace(/[^A-Z]/g, "").length;
  return uppers / letters.length;
}

function isAllCaps(line) {
  return upperRatio(line) >= 0.85;
}

function isSceneHeading(line) {
  return /^(INT\.|EXT\.|INT\/EXT\.|INT\.\/EXT\.|CUT TO|FADE IN|FADE OUT)/i.test(line);
}

function isDialogue(line) {
  if (!line) return false;
  if (isSceneHeading(line)) return false;
  if (isAllCaps(line)) return false;

  // If it starts with parentheses but ONLY has parentheses, it's not a normal dialogue line (it's pure parenthetical).
  // But if it has text after the closing parenthesis, like "(sighs) Yes.", it IS dialogue!
  if (line.startsWith('(')) {
    const afterParenMatch = line.match(/\)(.+)$/);
    if (!afterParenMatch || !afterParenMatch[1].trim()) {
      return false;
    }
  }

  return true;
}

function findNextDialogueLine(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // skip PURE parentheticals
    if (line.startsWith('(')) {
      const afterParenMatch = line.match(/\)(.+)$/);
      if (!afterParenMatch || !afterParenMatch[1].trim()) {
        continue;
      }
    }
    return line;
  }
  return null;
}

function isCharacterCue(line, lines, nextIndex) {
  if (!isAllCaps(line)) return false;
  const nextLine = findNextDialogueLine(lines, nextIndex);
  if (!nextLine) return false;
  return isDialogue(nextLine);
}

function cleanCharacterName(name) {
  return name
    .replace(/\(.*?\)/g, '')   // remove (O.S.), (V.O.)
    .replace(/CONT'?D/gi, '')
    .replace(/CONT’D/gi, '')
    .trim();
}

function isValidCharacter(name) {
  const upper = name.toUpperCase();
  return !NON_CHARACTER_PATTERNS.some(p => upper.includes(p));
}

function detectBeats(text) {
  if (!text) return 0;
  return (text.match(/\(beat\)|\.\.\./gi) || []).length;
}

function detectInterruptions(text) {
  if (!text) return 0;
  return (text.match(/—|-{2,}/g) || []).length;
}

function getLineLengthType(dialogueBlocks) {
  const lengths = dialogueBlocks.map(b => b.text.split(' ').length);
  if (!lengths.length) return 'mixed';
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (avg < 6) return 'short';
  if (avg > 15) return 'long';
  return 'mixed';
}

function detectPace(dialogueBlocks) {
  let interruptions = 0;
  let ellipses = 0;

  dialogueBlocks.forEach(b => {
    interruptions += detectInterruptions(b.text);
    ellipses += (b.text.match(/\.\.\./g) || []).length;
  });

  if (interruptions > 5) return 'fast';
  if (ellipses > 5) return 'hesitant';

  return 'natural';
}

function detectTone(dialogueBlocks) {
  const shortLines = dialogueBlocks.filter(b => b.text.split(' ').length < 6).length;
  const interruptions = dialogueBlocks.reduce((sum, b) => sum + detectInterruptions(b.text), 0);

  if (shortLines > 10 && interruptions > 5) {
    return 'multicam';
  }

  return 'singlecam';
}

function buildStructure(dialogueBlocks, stageDirections) {
  let totalBeats = 0;
  let totalInterruptions = 0;
  
  dialogueBlocks.forEach(b => {
    totalBeats += detectBeats(b.text);
    if (b.parenthetical) totalBeats += detectBeats(b.parenthetical);
    totalInterruptions += detectInterruptions(b.text);
  });
  
  stageDirections.forEach(b => {
    totalBeats += detectBeats(b.content);
    totalInterruptions += detectInterruptions(b.content);
  });

  return {
    dialogue_blocks: dialogueBlocks,
    beats: [],
    interruptions: [],
    pace: detectPace(dialogueBlocks),
    tone_bias: detectTone(dialogueBlocks),
    beat_count: totalBeats,
    interruption_count: totalInterruptions
  };
}

function parseScreenplayText(rawText, options = {}) {
  const { actorCharacter = "" } = options;

  const text = normalizeText(rawText);
  const rawLines = text.split("\n");
  
  // Strip garbage lines entirely
  const lines = rawLines.map(l => l.trim()).filter(line => {
    if (/^Sides by Breakdown Services/i.test(line)) return false;
    if (/^Actors Access/i.test(line)) return false;
    if (/^\d+\.$/.test(line)) return false;
    if (/^\d+\/\d+$/.test(line)) return false;
    if (/^option \d+/i.test(line)) return false;
    if (/^sc \d+ of \d+/i.test(line)) return false;
    if (/^START$/i.test(line)) return false;
    if (/^END$/i.test(line)) return false;
    return true;
  });

  const characters = new Set();
  const dialogueBlocks = [];
  const stageDirections = [];
  const sceneHeadings = [];
  
  const characterDialogueCounts = new Map();

  let currentScene = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line) {
      i++;
      continue;
    }

    if (isSceneHeading(line)) {
      currentScene = line;
      sceneHeadings.push({
        scene: line,
        lineIndex: i
      });
      i++;
      continue;
    }

    // Is it a speaking character?
    if (isCharacterCue(line, lines, i + 1)) {
      const name = cleanCharacterName(line);

      if (isValidCharacter(name) && name.length > 0 && name.length <= 40) {
        characters.add(name);
        
        let parenthetical = null;
        const contentLines = [];
        let j = i + 1;

        // Skip to find the dialogue block
        while (j < lines.length) {
          const next = lines[j];
          if (!next) {
            j++;
            continue;
          }
          
          if (isSceneHeading(next) || isCharacterCue(next, lines, j + 1)) {
            break;
          }
          
          if (next.startsWith('(') && contentLines.length === 0 && !parenthetical) {
            parenthetical = next;
            j++;
            continue;
          }

          if (isDialogue(next) || next.startsWith('(')) {
            contentLines.push(next);
            j++;
            continue;
          }

          break; // Action/stage direction interrupts
        }

        const dialogueText = contentLines.join(" ").trim();
        if (dialogueText.length > 0) {
          dialogueBlocks.push({
            type: "dialogue",
            scene: currentScene,
            speaker: name,
            parenthetical,
            text: dialogueText,
            lineIndex: i
          });
          
          characterDialogueCounts.set(name, (characterDialogueCounts.get(name) || 0) + 1);
        }

        i = j;
        continue;
      }
    }

    // Treat as stage direction / action
    const actionBlock = [line];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (!next) {
        j++;
        break;
      }
      if (isSceneHeading(next) || isCharacterCue(next, lines, j + 1)) {
        break;
      }
      actionBlock.push(next);
      j++;
    }

    stageDirections.push({
      type: "action",
      scene: currentScene,
      content: actionBlock.join(" "),
      lineIndex: i
    });

    i = j;
  }

  // Remove anything that never actually speaks
  const activeCharacters = [];
  for (const name of characters) {
    if (characterDialogueCounts.get(name) > 0) {
      activeCharacters.push(name);
    }
  }

  const actor = actorCharacter ? actorCharacter.toUpperCase().trim() : "";
  const readerRoles = activeCharacters.filter(
    c => c.toUpperCase() !== actor
  );

  const structure = buildStructure(dialogueBlocks, stageDirections);

  return {
    actor: actor,
    actorCharacter,
    reader_characters: readerRoles,
    characters: activeCharacters,
    readerRoles,
    sceneHeadings,
    dialogueBlocks,
    stageDirections,
    structure
  };
}

module.exports = {
  parseScreenplayText,
  normalizeText,
  isCharacterCue,
  isDialogue,
  isSceneHeading,
  cleanCharacterName,
  isValidCharacter,
  detectBeats,
  detectInterruptions,
  detectPace,
  detectTone,
  buildStructure
};
