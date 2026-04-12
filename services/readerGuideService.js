/**
 * Reader101 guide service
 * ─────────────────────────────────────────────────────────────────────────────
 * Public wrapper that keeps the existing generateReaderGuide() contract stable
 * while routing generation through the fixed-template Reader101 system.
 */

const { buildGuide } = require("../reader101/system/buildGuide");

const REQUIRED_SECTION_TITLES = [
  "What Will Go Wrong",
  "Why This Matters",
  "Performance Engine",
  "Scene Snapshot",
  "Your Job",
  "Playing Multiple Characters",
  "Reader Fundamentals",
  "Key Beats",
  "Rhythm, Pace & Energy",
  "Do This / Avoid This",
  "Connection",
  "Tone & Reference Anchor",
  "Quick Reset",
];

const HIGH_RISK_TRIGGERS = [
  "sex",
  "porn",
  "orgasm",
  "horny",
  "naked",
  "sexual",
  "make out",
  "making out",
  "arousal",
  "straddle",
  "thrust",
  "power imbalance",
  "older man",
  "older woman",
  "teacher",
  "coach",
  "boss",
  "superior",
  "subordinate",
  "inappropriate",
  "crosses a boundary",
  "boundary violation",
  "grooming",
  "coercive",
  "pressures",
  "forced to",
];

const EXPLICIT_INTIMACY_TRIGGERS = [
  "porn",
  "sex",
  "horny",
  "naked",
  "orgasm",
  "arousal",
  "make out",
  "making out",
  "moan",
  "moaning",
  "sexual",
  "foreplay",
  "straddle",
  "thrust",
];

const AMBIGUOUS_INTIMACY_TRIGGERS = [
  "touches",
  "touching",
  "kissing",
  "kisses",
  "kiss",
  "bed",
  "watching",
  "intimate",
  "physical proximity",
  "leans in",
  "pulls in",
];

const ROMANTIC_CONTEXT_TRIGGERS = [
  "boyfriend",
  "girlfriend",
  "date",
  "dating",
  "flirting",
  "romantic",
  "attraction",
  "desire",
  "crush",
  "lover",
  "hookup",
];

const FAMILY_RELATIONSHIP_TRIGGERS = [
  "mom",
  "mother",
  "dad",
  "daddy",
  "father",
  "daughter",
  "son",
  "child",
  "kid",
  "little girl",
  "little boy",
  "parent",
];

const FAMILY_COMFORT_TRIGGERS = [
  "draws her into a hug",
  "draws him into a hug",
  "pulls her into a hug",
  "pulls him into a hug",
  "hugs her",
  "hugs him",
  "hugging her",
  "hugging him",
  "kissing her head",
  "kissing his head",
  "kisses her head",
  "kisses his head",
  "kissing her forehead",
  "kissing his forehead",
  "kisses her forehead",
  "kisses his forehead",
  "holds her",
  "holds him",
];

const INTIMACY_ESCALATION_TRIGGERS = [
  "closer",
  "harder",
  "faster",
  "pulls in",
  "leans in",
  "can't stop",
  "wants more",
  "breathless",
  "escalates",
];

const INTIMACY_AFTERMATH_TRIGGERS = [
  "shame",
  "ashamed",
  "embarrassed",
  "exit",
  "leaves",
  "walks away",
  "gets up",
  "afterward",
  "aftermath",
  "silence after",
  "exposed",
];

const MORAL_CONTRADICTION_TRIGGERS = [
  "lies",
  "lying",
  "betrays",
  "betrayal",
  "hides",
  "secret",
  "ashamed",
  "guilty",
  "guilt",
  "wrong",
  "crossed a line",
];

const POWER_IMBALANCE_TRIGGERS = [
  "teacher",
  "coach",
  "principal",
  "boss",
  "manager",
  "older",
  "senior",
  "authority",
  "in charge",
  "controls",
  "pressures",
];

function normalize(value = "") {
  return String(value || "").toLowerCase();
}

function normalizeCharacterLabel(value = "") {
  return String(value || "")
    .replace(/\(CONT['’]?D\)/gi, "")
    .replace(/\bCONT['’]?D\b/gi, "")
    .replace(/\bSIDES\s+\d+\.?\b/gi, "")
    .replace(/\bSIDES\b/gi, "")
    .replace(/[^A-Za-z0-9 .'\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text = "", needles = []) {
  const normalized = normalize(text);
  return needles.some((needle) => normalized.includes(needle));
}

const NON_CHARACTER_CUES = new Set([
  "INT",
  "EXT",
  "INT.",
  "EXT.",
  "CUT TO",
  "FADE IN",
  "FADE OUT",
  "DISSOLVE TO",
  "ANGLE ON",
  "CLOSE ON",
  "CONTINUED",
  "CONT D",
  "CONT'D",
]);

function extractCharacterCues(sceneText = "") {
  const lines = String(sceneText || "").split("\n");
  const counts = new Map();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length > 40) continue;
    if (!/[A-Z]/.test(line) || /[a-z]/.test(line)) continue;
    if (/^(INT|EXT)[ .]/.test(line)) continue;
    if (/\bSIDES\b/i.test(line)) continue;
    if (/\bCONT['’]?D\b/i.test(line)) continue;
    if (/\d+\.$/.test(line)) continue;

    const normalized = normalizeCharacterLabel(line);
    if (!normalized) continue;
    if (NON_CHARACTER_CUES.has(normalized.toUpperCase())) continue;
    if (/\bSIDES\b/i.test(normalized)) continue;

    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

function inferReaderCharacterNames({
  auditionCharacterName = "",
  sceneText = "",
  characterNames = [],
} = {}) {
  const normalizedAudition = normalizeCharacterLabel(auditionCharacterName);
  const candidates = [
    ...characterNames.map(normalizeCharacterLabel),
    ...extractCharacterCues(sceneText),
  ].filter(Boolean);

  const seen = new Set();
  const uniqueCandidates = candidates.filter((name) => {
    const key = normalize(name);
    if (!key || seen.has(key) || key === normalize(normalizedAudition)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return uniqueCandidates;
}

function formatReaderRoleSummary(readerCharacterNames = []) {
  const roles = (Array.isArray(readerCharacterNames) ? readerCharacterNames : [])
    .map(normalizeCharacterLabel)
    .filter(Boolean);

  if (!roles.length) return "Scene Partner";
  if (roles.length === 1) return roles[0];
  if (roles.length === 2) return `${roles[0]} / ${roles[1]}`;
  return `${roles[0]} + ${roles.length - 1} more roles`;
}

function resolveReaderRoleContext(data = {}) {
  const auditionCharacterName = normalizeCharacterLabel(data.characterName || "");
  const explicitReaderRole = normalizeCharacterLabel(data.readerCharacterName || "");
  const inferredReaderCharacterNames = inferReaderCharacterNames({
    auditionCharacterName,
    sceneText: data.sceneText || "",
    characterNames: Array.isArray(data.characterNames) ? data.characterNames : [],
  });
  const readerCharacterNames = explicitReaderRole
    ? [explicitReaderRole, ...inferredReaderCharacterNames.filter((name) => normalize(name) !== normalize(explicitReaderRole))]
    : inferredReaderCharacterNames;
  const readerCharacterName = readerCharacterNames[0] || "";

  return {
    auditionCharacterName,
    readerCharacterName,
    readerCharacterNames,
    displayReaderCharacterName: formatReaderRoleSummary(readerCharacterNames),
  };
}

function detectFamilyContext(content = "", actorAge = null) {
  return hasAny(content, FAMILY_RELATIONSHIP_TRIGGERS) || (!!actorAge && actorAge < 18);
}

function detectFamilyComfort(content = "", actorAge = null) {
  return (
    detectFamilyContext(content, actorAge) &&
    hasAny(content, FAMILY_COMFORT_TRIGGERS) &&
    !hasAny(content, EXPLICIT_INTIMACY_TRIGGERS)
  );
}

function detectIntimacy(content = "", actorAge = null) {
  const explicitIntimacy = hasAny(content, EXPLICIT_INTIMACY_TRIGGERS);
  const ambiguousIntimacy = hasAny(content, AMBIGUOUS_INTIMACY_TRIGGERS);
  const romanticContext = hasAny(content, ROMANTIC_CONTEXT_TRIGGERS);
  const familyComfort = detectFamilyComfort(content, actorAge);

  if (familyComfort) {
    return false;
  }

  return explicitIntimacy || (ambiguousIntimacy && romanticContext);
}

function detectIntimacyArc(content = "") {
  return (
    hasAny(content, INTIMACY_ESCALATION_TRIGGERS) &&
    hasAny(content, INTIMACY_AFTERMATH_TRIGGERS)
  );
}

function isHighRiskScene(content = "") {
  return hasAny(content, HIGH_RISK_TRIGGERS);
}

function buildReaderModeContext(data = {}) {
  const combinedContent = [
    data.sceneText || "",
    data.storyline || "",
    data.genre || "",
    data.productionTitle || "",
    data.productionType || "",
    data.characterName || "",
  ]
    .filter(Boolean)
    .join("\n");

  const actorAge = Number.parseInt(data.actorAge, 10);
  const parsedActorAge = Number.isNaN(actorAge) ? null : actorAge;
  const intimacyMode = detectIntimacy(combinedContent, parsedActorAge);
  const shameTransition =
    /shame|ashamed|embarrassed|exposed/i.test(combinedContent) ||
    detectIntimacyArc(combinedContent);
  const moralContradiction = hasAny(combinedContent, MORAL_CONTRADICTION_TRIGGERS);
  const powerImbalance = hasAny(combinedContent, POWER_IMBALANCE_TRIGGERS);
  const explicitHighRiskSignal =
    isHighRiskScene(combinedContent) || intimacyMode;
  const compoundedBoundaryRisk =
    powerImbalance &&
    (explicitHighRiskSignal ||
      hasAny(combinedContent, ROMANTIC_CONTEXT_TRIGGERS) ||
      hasAny(combinedContent, AMBIGUOUS_INTIMACY_TRIGGERS));
  const highRiskSignal = explicitHighRiskSignal || compoundedBoundaryRisk;

  return {
    mode: highRiskSignal ? "HIGH_RISK" : "STANDARD",
    highRiskScene: highRiskSignal,
    intimacyMode,
    intimacyArc: intimacyMode && detectIntimacyArc(combinedContent),
    actorAge: parsedActorAge,
    parentContext:
      /parent/i.test(combinedContent) || (!!parsedActorAge && parsedActorAge < 18),
    moralContradiction,
    powerImbalance,
    shameTransition: shameTransition && highRiskSignal,
    fosterStyleScene:
      /foster/i.test(combinedContent) &&
      (highRiskSignal || intimacyMode || shameTransition),
  };
}

function buildFlags(modeContext = {}) {
  const flags = [];

  if (modeContext.highRiskScene) flags.push("high_risk");
  if (modeContext.intimacyMode) flags.push("intimacy");
  if (modeContext.parentContext) flags.push("parent_context");
  if (modeContext.moralContradiction) flags.push("moral_contradiction");
  if (modeContext.powerImbalance) flags.push("power_imbalance");
  if (modeContext.shameTransition) flags.push("shame_transition");
  if (modeContext.fosterStyleScene) flags.push("foster_style_scene");

  return flags;
}

function validateReaderGuideOutput(html = "", modeContext = {}) {
  const errors = [];
  const content = String(html || "");
  const comparableContent = content.replace(/&amp;/g, "&");

  if (!/<html[\s>]/i.test(content) || !/<\/html>/i.test(content)) {
    errors.push("Guide output must be a complete HTML document.");
  }

  if (/{{[A-Z_]+}}/.test(content)) {
    errors.push("Guide output still contains unresolved template placeholders.");
  }

  for (const title of REQUIRED_SECTION_TITLES) {
    if (!comparableContent.includes(title)) {
      errors.push(`Missing required section: ${title}.`);
    }
  }

  if (modeContext.highRiskScene) {
    const hasHighRiskHeading =
      content.includes("When the Scene Crosses Into Intimacy") ||
      content.includes("Handling High-Risk Material");

    if (!hasHighRiskHeading) {
      errors.push(
        "Missing required high-risk heading: expected either \"When the Scene Crosses Into Intimacy\" or \"Handling High-Risk Material\"."
      );
    }

    const requiredHighRiskLines = [
      "Emotional Arc Mapping",
      "Reader does NOT simulate physical behavior.",
      "Reader provides emotional grounding only.",
      "This scene contains behavior that may cause reader discomfort. That discomfort must NOT affect delivery.",
      "Your job is not to make this comfortable. Your job is to make it playable.",
      "This moment may feel uncomfortable. Do not adjust your performance to avoid that discomfort.",
    ];

    for (const line of requiredHighRiskLines) {
      if (!content.includes(line)) {
        errors.push(`Missing required high-risk line: ${line}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

async function generateReaderGuide(data = {}) {
  const roleContext = resolveReaderRoleContext(data);
  const modeContext = buildReaderModeContext({
    ...data,
    ...roleContext,
  });
  const flags = buildFlags(modeContext);

  console.log("📖 [ReaderGuide] Generating structured Reader101 guide");
  console.log("   Audition character:", roleContext.auditionCharacterName || "Unknown");
  console.log("   Reader role:", roleContext.displayReaderCharacterName);
  console.log("   Production:", data.productionTitle || "Unknown");
  console.log("   Mode:", modeContext.mode);
  console.log("   Flags:", flags.join(", ") || "none");

  const result = await buildGuide(
    {
      ...data,
      ...roleContext,
      ...modeContext,
      flags,
    },
    { returnMeta: true }
  );

  const validation = validateReaderGuideOutput(result.html, modeContext);

  if (!validation.ok) {
    console.error("[ReaderGuide] Render validation failed:", validation.errors);
    throw new Error(`Reader101 render validation failed: ${validation.errors.join(" | ")}`);
  }

  console.log("✅ [ReaderGuide] Guide ready", {
    template: result.templateStyle,
    source: result.contentSource,
    length: result.html.length,
  });

  return result.html;
}

module.exports = {
  buildReaderModeContext,
  resolveReaderRoleContext,
  generateReaderGuide,
  validateReaderGuideOutput,
};
