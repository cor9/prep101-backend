const START_MARKER_RE = /^\*?\s*START\s*\*?$/i;
const END_MARKER_RE = /^\*?\s*END\s*\*?$/i;
const CONTD_RE = /\(CONT'?D\)/i;
const { formatFountain } = require("./fountainFormatter");

function normalizeX(block = {}) {
  const pageWidth = block.pageWidth || block.width || 1;
  const xMin = block?.bbox?.x || 0;
  return pageWidth > 0 ? xMin / pageWidth : 0;
}

function byPageThenYThenX(a, b) {
  if ((a.page || 1) !== (b.page || 1)) return (a.page || 1) - (b.page || 1);
  const ay = a?.bbox?.y || 0;
  const by = b?.bbox?.y || 0;
  if (Math.abs(ay - by) > 2) return ay - by;
  return (a?.bbox?.x || 0) - (b?.bbox?.x || 0);
}

function clusterLines(blocks = []) {
  const sorted = [...blocks].sort(byPageThenYThenX);
  const lines = [];
  const yTolerance = 14;

  for (const block of sorted) {
    const y = block?.bbox?.y || 0;
    const page = block.page || 1;
    const existing = lines.find(
      (line) => line.page === page && Math.abs(line.y - y) <= yTolerance
    );

    if (existing) {
      existing.blocks.push(block);
      existing.y = (existing.y + y) / 2;
    } else {
      lines.push({ page, y, blocks: [block] });
    }
  }

  return lines.map((line) => {
    const ordered = line.blocks.sort((a, b) => (a?.bbox?.x || 0) - (b?.bbox?.x || 0));
    const text = ordered.map((b) => (b.text || "").trim()).filter(Boolean).join(" ");
    const first = ordered[0] || {};
    return {
      page: line.page,
      y: line.y,
      text,
      blocks: ordered,
      xNormalized: normalizeX(first),
    };
  });
}

function classifyLine(line = {}) {
  const x = line.xNormalized;
  const text = (line.text || "").trim();

  if (START_MARKER_RE.test(text)) return "MarkerStart";
  if (END_MARKER_RE.test(text)) return "MarkerEnd";
  if (x >= 0.37 && x <= 0.45) return "CharacterName";
  if (x >= 0.28 && x <= 0.33) return "Parenthetical";
  if (x >= 0.22 && x <= 0.28) return "Dialogue";
  if (x >= 0.12 && x <= 0.18) {
    if (/^(INT|EXT|INT\/EXT)\./i.test(text)) return "SceneHeading";
    return "Action";
  }
  return "Action";
}

function linkContdDialogues(lines = []) {
  const linked = [];
  let pendingCharacter = null;

  for (const line of lines) {
    const type = line.type;
    if (type === "CharacterName") {
      pendingCharacter = line.text;
      linked.push(line);
      continue;
    }

    if (type === "Dialogue" && pendingCharacter) {
      linked.push({ ...line, speaker: pendingCharacter });
      continue;
    }

    if (type === "Action" && CONTD_RE.test(line.text) && pendingCharacter) {
      linked.push({ ...line, type: "ContinuationMarker", speaker: pendingCharacter });
      continue;
    }

    if (type !== "Parenthetical" && type !== "Dialogue") {
      pendingCharacter = null;
    }
    linked.push(line);
  }

  return linked;
}

function buildScreenplayDocument(lines = []) {
  const typed = lines.map((line) => ({ ...line, type: classifyLine(line) }));
  const linked = linkContdDialogues(typed);
  const sections = linked.map((line) => ({
    page: line.page,
    y: line.y,
    type: line.type,
    xNormalized: Number(line.xNormalized.toFixed(4)),
    text: line.text,
    speaker: line.speaker || null,
    marker:
      line.type === "MarkerStart" ? "START" : line.type === "MarkerEnd" ? "END" : null,
  }));

  const elements = sections
    .filter((item) => item.text)
    .map((item) => {
      if (item.type === "SceneHeading") {
        return { type: "scene_heading", text: item.text };
      }
      if (item.type === "CharacterName") {
        return { type: "character", text: item.text };
      }
      if (item.type === "Parenthetical") {
        return { type: "parenthetical", text: item.text };
      }
      if (item.type === "Dialogue") {
        return { type: "dialogue", text: item.text };
      }
      if (item.type === "MarkerStart" || item.type === "MarkerEnd") {
        return { type: "action", text: item.text };
      }
      if (/\bTO:\s*$/i.test(item.text) || /^(CUT TO|MATCH CUT|SMASH CUT)/i.test(item.text)) {
        return { type: "transition", text: item.text };
      }
      return { type: "action", text: item.text };
    });

  const screenplay = {
    title: "Recovered Audition Sides",
    credit: "Automated Extraction",
    author: "Prep101 Pipeline",
    notes: [
      "Generated from OCR coordinates.",
      "Review dialogue continuity before final submission.",
    ],
    elements,
  };

  return {
    sections,
    screenplay,
    fountain: formatFountain(screenplay, { includeTitlePage: true }),
  };
}

function mapOcrBlocksToScreenplay(blocks = []) {
  const lines = clusterLines(blocks);
  return buildScreenplayDocument(lines);
}

module.exports = {
  mapOcrBlocksToScreenplay,
  normalizeX,
  clusterLines,
  classifyLine,
};
