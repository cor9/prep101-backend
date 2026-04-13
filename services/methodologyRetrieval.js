const fs = require("fs");
const path = require("path");

const METHOD_DIR = path.join(process.cwd(), "methodology");

const BASE_WEIGHTS = {
  script: 0.25,
  behavior: 0.25,
  objective: 0.15,
  tactic: 0.15,
  archetype: 0.1,
  genre: 0.05,
  role: 0.05,
};

const PRODUCT_WEIGHTS = {
  prep101: { ...BASE_WEIGHTS },
  reader101: { ...BASE_WEIGHTS },
  boldchoices: { ...BASE_WEIGHTS },
};

const BOOSTS = {
  actionLanguage: 0.25,
  hagenMatch: 0.2,
  archetypeTagMatch: 0.15,
  physicality: 0.1,
};

const PENALTIES = {
  emotionOnly: 0.3,
  genericLanguage: 0.2,
  lowTacticValue: 0.15,
  crossRoleBleed: 0.15,
};

const ACTION_VERBS = [
  "interrogate",
  "deflect",
  "charm",
  "avoid",
  "interrupt",
  "withhold",
  "reveal",
  "corner",
  "pressure",
  "provoke",
  "disarm",
  "bait",
  "control",
  "test",
  "mirror",
  "redirect",
  "push",
  "pull",
  "seduce",
  "tease",
  "challenge",
  "negotiate",
  "guilt",
  "comfort",
  "attack",
  "protect",
  "ground",
];

const PHYSICALITY_TOKENS = [
  "eye contact",
  "eyes",
  "look away",
  "blink",
  "hands",
  "posture",
  "lean",
  "step",
  "stillness",
  "movement",
  "gesture",
  "prop",
  "space",
  "distance",
  "breath",
  "voice",
  "volume",
  "pace",
  "timing",
  "rhythm",
  "pause",
  "beat",
  "interrupt",
  "delivery",
];

const OBJECTIVE_TOKENS = [
  "want",
  "needs",
  "need to",
  "trying to",
  "tries to",
  "must",
  "have to",
  "get them to",
  "convince",
  "win",
  "protect",
  "survive",
  "prove",
  "hide",
  "escape",
];

const OBSTACLE_TOKENS = [
  "obstacle",
  "but",
  "however",
  "can't",
  "cannot",
  "won't",
  "refuse",
  "blocked",
  "resistance",
  "fear",
  "pressure",
  "stakes",
];

const GENERIC_PHRASES = [
  "connect to the emotion",
  "be authentic",
  "feel the moment",
  "just have fun with it",
  "practice makes perfect",
  "be yourself",
  "play angry",
  "play sad",
  "feel sad",
  "feel emotional",
];

const EMOTION_ONLY_PHRASES = [
  "be sad",
  "be angry",
  "be emotional",
  "feel the sadness",
  "feel the anger",
  "show emotion",
  "emotionally connected",
];

const PRODUCT_TOKENS = {
  prep101: [
    "prep101",
    "hagen",
    "objective",
    "obstacle",
    "tactic",
    "character",
    "subtext",
    "two-take",
  ],
  reader101: [
    "reader101",
    "reader",
    "timing",
    "contrast",
    "do not",
    "avoid",
    "stay grounded",
    "one beat behind",
    "protect the actor",
  ],
  boldchoices: [
    "bold choices",
    "choice",
    "take a",
    "take b",
    "take c",
    "camera",
    "physical behavior",
    "playable",
  ],
};

const READER101_ALLOWED_TOKENS = [
  "reader",
  "timing",
  "contrast",
  "neutral",
  "grounded",
  "one beat behind",
  "avoid",
  "do not",
  "delivery",
  "pacing",
  "volume",
  "restraint",
];

const READER101_BLOCKED_TOKENS = [
  "character psychology",
  "inner child",
  "trauma processing",
  "emotional substitution",
  "internal motivation",
];

const BOLD_ALLOWED_TOKENS = [
  "physical",
  "camera",
  "specific",
  "playable",
  "take a",
  "take b",
  "take c",
  "behavior",
  "gesture",
  "eye",
  "posture",
];

const BOLD_BLOCKED_TOKENS = [
  "long analysis",
  "character essay",
  "deep psychological explanation",
  "theoretical breakdown",
];

const ARCHETYPE_MAP = [
  { name: "tiny ceo", terms: ["tiny ceo", "in charge", "bossy", "command", "authority"] },
  { name: "truth bomb", terms: ["truth bomb", "brutally honest", "matter of fact", "unfiltered"] },
  { name: "wounded teen", terms: ["wounded teen", "guarded", "walls", "defensive"] },
  { name: "comic relief", terms: ["comic", "joke", "funny", "chaotic", "laugh"] },
  { name: "observer", terms: ["observer", "watching", "quiet", "contained", "stillness"] },
  { name: "old soul", terms: ["old soul", "deadpan", "mature", "underplay"] },
  { name: "golden retriever", terms: ["golden retriever", "joy", "bouncy", "heart-first"] },
  { name: "mini detective", terms: ["detective", "questions", "analyze", "clues"] },
  { name: "young rebel", terms: ["rebel", "defiant", "pushback", "protective"] },
  { name: "fish out of water", terms: ["fish out of water", "misplaced", "wrong room"] },
];

const cache = {
  loaded: false,
  files: [],
  chunks: [],
  loadedAt: null,
};

function normalize(value = "") {
  return String(value || "").toLowerCase();
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function tokenize(value = "") {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length > 2);
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function overlapScore(aTokens = [], bTokens = []) {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return clamp(overlap / Math.max(Math.sqrt(a.size * b.size), 1));
}

function determineFileType(filename = "") {
  const name = normalize(filename);
  if (name === "methodology.md" || name.includes("core_methodology")) return "core-methodology";
  if (name.includes("reader")) return "reader-methodology";
  if (name.includes("bold")) return "bold-methodology";
  if (name.includes("character")) return "character-development";
  if (name.includes("scene")) return "scene-work";
  if (name.includes("comedy")) return "comedy";
  if (name.includes("guide") || name.includes("example")) return "example-guide";
  return "general-methodology";
}

function extractKeywords(filename = "", content = "") {
  const keywords = [];
  const name = normalize(filename);
  const body = normalize(content);

  if (name.includes("character")) keywords.push("character", "archetype");
  if (name.includes("scene")) keywords.push("scene", "beats", "timing");
  if (name.includes("reader")) keywords.push("reader", "support", "timing", "contrast");
  if (name.includes("bold")) keywords.push("bold choices", "behavior", "risk", "playable");
  if (name.includes("methodology")) keywords.push("methodology", "rules", "coaching");

  if (body.includes("objective")) keywords.push("objective");
  if (body.includes("obstacle")) keywords.push("obstacle");
  if (body.includes("tactic")) keywords.push("tactic");
  if (body.includes("physical")) keywords.push("physicality");
  if (body.includes("uta hagen")) keywords.push("uta hagen");
  if (body.includes("behavior")) keywords.push("behavior");
  if (body.includes("reader")) keywords.push("reader");

  return unique(keywords);
}

function parseTags(text = "") {
  const tags = {
    archetype: [],
    rule: [],
    product: [],
  };

  const regex = /\[(ARCHETYPE|RULE|PRODUCT)\s*:\s*([^\]]+)\]/gi;
  let match = regex.exec(text);
  while (match) {
    const key = normalize(match[1]);
    const value = String(match[2] || "").trim();
    if (key === "archetype") tags.archetype.push(value);
    if (key === "rule") tags.rule.push(value);
    if (key === "product") tags.product.push(normalize(value));
    match = regex.exec(text);
  }

  tags.archetype = unique(tags.archetype);
  tags.rule = unique(tags.rule);
  tags.product = unique(tags.product);
  return tags;
}

function splitIntoChunks(content = "", maxChars = 1200) {
  const sections = String(content || "")
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = "";
  for (const section of sections) {
    if (!buffer) {
      buffer = section;
      continue;
    }
    if (buffer.length + section.length + 2 <= maxChars) {
      buffer += `\n\n${section}`;
    } else {
      chunks.push(buffer);
      buffer = section;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.filter((chunk) => chunk.length > 80);
}

function extractScriptPhrases(script = "") {
  return String(script || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && line.length <= 110)
    .slice(0, 35);
}

function extractHagenContext(context = {}) {
  const rawScript = String(context.script || "");
  const script = normalize(rawScript);
  const lines = rawScript.split("\n").map((line) => line.trim()).filter(Boolean);
  const slugs = lines.filter((line) => /^(int|ext)\.?[\s\-]/i.test(line)).slice(0, 3);

  const whenSignals = [
    "morning",
    "afternoon",
    "evening",
    "night",
    "today",
    "tomorrow",
    "yesterday",
    "midnight",
    "dawn",
  ].filter((token) => script.includes(token));

  const relationshipSignals = [
    "mom",
    "mother",
    "dad",
    "father",
    "sister",
    "brother",
    "friend",
    "teacher",
    "coach",
    "sheriff",
  ].filter((token) => script.includes(token));

  const wantPhrases = [];
  const obstaclePhrases = [];
  const tacticPhrases = [];

  const sentenceParts = rawScript
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 6);

  for (const part of sentenceParts) {
    const lower = normalize(part);
    if (OBJECTIVE_TOKENS.some((token) => lower.includes(token))) wantPhrases.push(part);
    if (OBSTACLE_TOKENS.some((token) => lower.includes(token))) obstaclePhrases.push(part);
    if (ACTION_VERBS.some((token) => lower.includes(token))) tacticPhrases.push(part);
  }

  const who = [context.characterName, context.activeActorName].filter(Boolean).join(" / ");
  const where = slugs[0] || context.where || "";
  const when = whenSignals.join(", ");
  const relationships = unique(relationshipSignals);
  const circumstances = sentenceParts.slice(0, 3);
  const want = unique(wantPhrases).slice(0, 4);
  const obstacle = unique(obstaclePhrases).slice(0, 4);
  const tactics = unique(tacticPhrases).slice(0, 6);

  return {
    who,
    where,
    when,
    relationships,
    circumstances,
    want,
    obstacle,
    tactics,
  };
}

function detectArchetypes(context = {}) {
  const haystack = normalize(
    [
      context.archetype,
      context.characterName,
      context.genre,
      context.productionType,
      context.storyline,
      context.script,
    ]
      .filter(Boolean)
      .join("\n")
  );

  const scored = ARCHETYPE_MAP.map((entry) => {
    let score = 0;
    for (const term of entry.terms) {
      if (haystack.includes(term)) score += 1;
    }
    return {
      name: entry.name,
      score,
    };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    primary: scored[0]?.name || "general",
    secondary: scored[1]?.name || "",
  };
}

function hasAnyPhrase(text = "", phrases = []) {
  const value = normalize(text);
  return phrases.some((phrase) => value.includes(normalize(phrase)));
}

function countSignals(text = "", tokens = []) {
  const value = normalize(text);
  let count = 0;
  for (const token of tokens) {
    if (value.includes(token)) count += 1;
  }
  return count;
}

function behavioralSpecificityScore(chunkText = "") {
  const signals = countSignals(chunkText, PHYSICALITY_TOKENS);
  return clamp(signals / 8);
}

function objectiveClarityScore(chunkText = "", context = {}) {
  const objectiveSignals = countSignals(chunkText, OBJECTIVE_TOKENS);
  const hagenWantTokens = tokenize((context.hagen?.want || []).join(" "));
  const overlap = overlapScore(hagenWantTokens, tokenize(chunkText));
  return clamp(objectiveSignals / 6 + overlap * 0.35);
}

function tacticStrengthScore(chunkText = "", context = {}) {
  const tacticSignals = countSignals(chunkText, ACTION_VERBS);
  const hagenTacticTokens = tokenize((context.hagen?.tactics || []).join(" "));
  const overlap = overlapScore(hagenTacticTokens, tokenize(chunkText));
  return clamp(tacticSignals / 6 + overlap * 0.35);
}

function scriptRelevanceScore(chunkText = "", context = {}) {
  const chunkTokens = tokenize(chunkText);
  const scriptTokens = tokenize(context.script || "");
  const base = overlapScore(scriptTokens, chunkTokens);
  const wantOverlap = overlapScore(tokenize((context.hagen?.want || []).join(" ")), chunkTokens);
  const obstacleOverlap = overlapScore(
    tokenize((context.hagen?.obstacle || []).join(" ")),
    chunkTokens
  );
  const tacticOverlap = overlapScore(tokenize((context.hagen?.tactics || []).join(" ")), chunkTokens);
  return clamp(base * 0.55 + wantOverlap * 0.2 + obstacleOverlap * 0.1 + tacticOverlap * 0.15);
}

function archetypeAlignmentScore(chunk, context = {}) {
  const chunkText = normalize(chunk.text || "");
  const primary = normalize(context.primaryArchetype || "");
  const secondary = normalize(context.secondaryArchetype || "");
  let score = 0;

  if (primary && chunkText.includes(primary)) score += 0.5;
  if (secondary && chunkText.includes(secondary)) score += 0.25;

  if (
    primary &&
    chunk.tags.archetype.some((tag) => normalize(tag).includes(primary))
  ) {
    score += 0.45;
  }
  if (
    secondary &&
    chunk.tags.archetype.some((tag) => normalize(tag).includes(secondary))
  ) {
    score += 0.2;
  }

  return clamp(score || overlapScore(tokenize(primary), tokenize(chunk.text || "")));
}

function genreAlignmentScore(chunkText = "", context = {}) {
  return overlapScore(
    tokenize([context.genre, context.productionType, context.genreMode].filter(Boolean).join(" ")),
    tokenize(chunkText)
  );
}

function rolePriorityScore(chunk, context = {}) {
  const product = normalize(context.product || "prep101");
  const tokens = PRODUCT_TOKENS[product] || [];
  let score = overlapScore(tokenize(tokens.join(" ")), tokenize(chunk.text || ""));
  if (chunk.tags.product.includes(product)) score += 0.45;
  if (product === "reader101" && hasAnyPhrase(chunk.text, READER101_ALLOWED_TOKENS)) {
    score += 0.2;
  }
  if (product === "boldchoices" && hasAnyPhrase(chunk.text, BOLD_ALLOWED_TOKENS)) {
    score += 0.2;
  }
  return clamp(score);
}

function applyProductFilters(product = "prep101", chunkText = "", score = 0) {
  let adjusted = score;
  if (product === "reader101") {
    const blocked = hasAnyPhrase(chunkText, READER101_BLOCKED_TOKENS);
    const allowed = hasAnyPhrase(chunkText, READER101_ALLOWED_TOKENS);
    if (blocked && !allowed) adjusted -= 0.2;
    if (allowed) adjusted += 0.08;
  }

  if (product === "boldchoices") {
    const allowed = hasAnyPhrase(chunkText, BOLD_ALLOWED_TOKENS);
    const blocked = hasAnyPhrase(chunkText, BOLD_BLOCKED_TOKENS);
    if (allowed) adjusted += 0.12;
    if (blocked) adjusted -= 0.12;
  }

  return adjusted;
}

function scoreChunk(chunk, context = {}) {
  const product = normalize(context.product || "prep101");
  const weights = PRODUCT_WEIGHTS[product] || BASE_WEIGHTS;
  const chunkText = normalize(chunk.text || "");
  const scriptPhrases = Array.isArray(context.scriptPhrases) ? context.scriptPhrases : [];

  const scriptRelevance = scriptRelevanceScore(chunkText, context);
  const behaviorScore = behavioralSpecificityScore(chunkText);
  const objectiveScore = objectiveClarityScore(chunkText, context);
  const tacticScore = tacticStrengthScore(chunkText, context);
  const archetypeScore = archetypeAlignmentScore(chunk, context);
  const genreScore = genreAlignmentScore(chunkText, context);
  const roleScore = rolePriorityScore(chunk, context);

  let score =
    weights.script * scriptRelevance +
    weights.behavior * behaviorScore +
    weights.objective * objectiveScore +
    weights.tactic * tacticScore +
    weights.archetype * archetypeScore +
    weights.genre * genreScore +
    weights.role * roleScore;

  const hasActionLanguage = ACTION_VERBS.some((token) => chunkText.includes(token));
  if (hasActionLanguage) score += BOOSTS.actionLanguage;

  const hagenMatch = Boolean(
    overlapScore(tokenize((context.hagen?.want || []).join(" ")), tokenize(chunkText)) >= 0.12 ||
      overlapScore(tokenize((context.hagen?.obstacle || []).join(" ")), tokenize(chunkText)) >= 0.12 ||
      overlapScore(tokenize((context.hagen?.tactics || []).join(" ")), tokenize(chunkText)) >= 0.12
  );
  if (hagenMatch) score += BOOSTS.hagenMatch;

  const archetypeTagMatch = chunk.tags.archetype.length > 0;
  if (archetypeTagMatch) score += BOOSTS.archetypeTagMatch;

  const hasPhysicality = PHYSICALITY_TOKENS.some((token) => chunkText.includes(token));
  if (hasPhysicality) score += BOOSTS.physicality;

  const emotionOnlyLanguage = EMOTION_ONLY_PHRASES.some((phrase) => chunkText.includes(phrase));
  if (emotionOnlyLanguage) score -= PENALTIES.emotionOnly;

  const genericLanguage = GENERIC_PHRASES.some((phrase) => chunkText.includes(phrase));
  if (genericLanguage) score -= PENALTIES.genericLanguage;

  const lowTacticValue = countSignals(chunkText, ACTION_VERBS) < 1;
  if (lowTacticValue) score -= PENALTIES.lowTacticValue;

  const otherProducts = Object.keys(PRODUCT_TOKENS).filter((key) => key !== product);
  const crossRoleBleed = otherProducts.some((key) =>
    PRODUCT_TOKENS[key].some((token) => chunkText.includes(normalize(token)))
  );
  if (crossRoleBleed && roleScore < 0.25) score -= PENALTIES.crossRoleBleed;

  const phraseMatch = scriptPhrases.some((phrase) => chunkText.includes(normalize(phrase)));
  if (phraseMatch) score += 0.08;

  score = applyProductFilters(product, chunkText, score);

  return {
    ...chunk,
    product,
    score: Number(score.toFixed(6)),
    components: {
      scriptRelevance,
      behavioralSpecificity: behaviorScore,
      objectiveClarity: objectiveScore,
      tacticStrength: tacticScore,
      archetypeAlignment: archetypeScore,
      genreAlignment: genreScore,
      rolePriority: roleScore,
      hasActionLanguage,
      hagenMatch,
      archetypeTagMatch,
      hasPhysicality,
      emotionOnlyLanguage,
      genericLanguage,
      lowTacticValue,
      crossRoleBleed,
    },
  };
}

function uniqueById(items = []) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    output.push(item);
  }
  return output;
}

function ensureCoverage(ranked = [], selected = []) {
  if (!ranked.length) return selected;
  const result = [...selected];

  const hasCoreMethod = result.some(
    (chunk) => chunk.fileType === "core-methodology" || chunk.tags.rule.length
  );
  if (!hasCoreMethod) {
    const core = ranked.find(
      (chunk) => chunk.fileType === "core-methodology" || chunk.tags.rule.length
    );
    if (core) {
      if (result.length) result[result.length - 1] = core;
      else result.push(core);
    }
  }

  const hasArchetypeChunk = result.some(
    (chunk) => chunk.components.archetypeAlignment >= 0.25 || chunk.tags.archetype.length
  );
  if (!hasArchetypeChunk) {
    const candidate = ranked.find(
      (chunk) => chunk.components.archetypeAlignment >= 0.25 || chunk.tags.archetype.length
    );
    if (candidate && !result.some((item) => item.id === candidate.id)) {
      result.push(candidate);
    }
  }

  return uniqueById(result).slice(0, 8);
}

function buildIndex(force = false) {
  if (cache.loaded && !force) return cache;

  const files = [];
  const chunks = [];

  if (!fs.existsSync(METHOD_DIR)) {
    cache.loaded = true;
    cache.files = [];
    cache.chunks = [];
    cache.loadedAt = new Date().toISOString();
    return cache;
  }

  const filenames = fs.readdirSync(METHOD_DIR).filter(Boolean);
  for (const filename of filenames) {
    const filePath = path.join(METHOD_DIR, filename);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const content = fs.readFileSync(filePath, "utf8");
    const fileType = determineFileType(filename);
    const keywords = extractKeywords(filename, content);
    const fileTags = parseTags(content);

    files.push({
      id: filename,
      filename,
      filePath,
      fileType,
      size: content.length,
      keywords,
      tags: fileTags,
      content,
    });

    const chunkTexts = splitIntoChunks(content);
    chunkTexts.forEach((text, idx) => {
      chunks.push({
        id: `${filename}#${idx + 1}`,
        filename,
        fileType,
        keywords,
        tags: parseTags(text),
        text,
      });
    });
  }

  cache.loaded = true;
  cache.files = files;
  cache.chunks = chunks;
  cache.loadedAt = new Date().toISOString();
  return cache;
}

function retrieveMethodologyContext(context = {}, options = {}) {
  buildIndex(Boolean(options.forceReload));

  const product = normalize(context.product || "prep101");
  const topK = Math.max(5, Math.min(8, Number(options.topK) || 8));
  const scriptPhrases = extractScriptPhrases(context.script || "");
  const hagen = extractHagenContext(context);
  const archetypes = detectArchetypes(context);

  const enrichedContext = {
    ...context,
    product,
    scriptPhrases,
    hagen,
    primaryArchetype: context.primaryArchetype || archetypes.primary,
    secondaryArchetype: context.secondaryArchetype || archetypes.secondary,
  };

  const ranked = cache.chunks
    .map((chunk) => scoreChunk(chunk, enrichedContext))
    .sort((a, b) => b.score - a.score);

  const selectedRaw = ranked.slice(0, topK);
  const selected = ensureCoverage(ranked, selectedRaw);

  return {
    product,
    weights: PRODUCT_WEIGHTS[product] || BASE_WEIGHTS,
    hagen,
    primaryArchetype: enrichedContext.primaryArchetype,
    secondaryArchetype: enrichedContext.secondaryArchetype,
    selectedChunks: selected,
    availableChunks: cache.chunks.length,
    loadedAt: cache.loadedAt,
  };
}

function summarizeLoadedFiles() {
  buildIndex(false);
  return cache.files.map((file) => ({
    filename: file.filename,
    type: file.fileType,
    size: file.size,
    keywords: file.keywords,
  }));
}

module.exports = {
  buildIndex,
  retrieveMethodologyContext,
  summarizeLoadedFiles,
  extractHagenContext,
};
