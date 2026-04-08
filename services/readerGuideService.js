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
  "touches",
  "orgasm",
  "horny",
  "bed",
  "watching",
  "intimate",
  "shame",
  "shamed",
  "ashamed",
  "embarrassed",
  "power imbalance",
  "older man",
  "older woman",
  "teacher",
  "coach",
  "boss",
  "superior",
  "subordinate",
];

const INTIMACY_TRIGGERS = [
  "porn",
  "sex",
  "touches",
  "kissing",
  "horny",
  "bed",
  "watching",
  "naked",
  "orgasm",
  "arousal",
  "physical proximity",
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

function hasAny(text = "", needles = []) {
  const normalized = normalize(text);
  return needles.some((needle) => normalized.includes(needle));
}

function detectIntimacy(content = "") {
  return hasAny(content, INTIMACY_TRIGGERS);
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
  const intimacyMode = detectIntimacy(combinedContent);
  const shameTransition =
    /shame|ashamed|embarrassed|exposed/i.test(combinedContent) ||
    detectIntimacyArc(combinedContent);
  const moralContradiction = hasAny(combinedContent, MORAL_CONTRADICTION_TRIGGERS);
  const powerImbalance = hasAny(combinedContent, POWER_IMBALANCE_TRIGGERS);
  const highRiskSignal =
    isHighRiskScene(combinedContent) ||
    intimacyMode ||
    shameTransition ||
    moralContradiction ||
    powerImbalance;

  return {
    mode: highRiskSignal ? "HIGH_RISK" : "STANDARD",
    highRiskScene: highRiskSignal,
    intimacyMode,
    intimacyArc: intimacyMode && detectIntimacyArc(combinedContent),
    actorAge: Number.isNaN(actorAge) ? null : actorAge,
    parentContext:
      /parent/i.test(combinedContent) || (!Number.isNaN(actorAge) && actorAge < 18),
    moralContradiction,
    powerImbalance,
    shameTransition,
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
    const requiredHighRiskLines = [
      "When the Scene Crosses Into Intimacy",
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
  const modeContext = buildReaderModeContext(data);
  const flags = buildFlags(modeContext);

  console.log("📖 [ReaderGuide] Generating structured Reader101 guide");
  console.log("   Character:", data.characterName || "Unknown");
  console.log("   Production:", data.productionTitle || "Unknown");
  console.log("   Mode:", modeContext.mode);
  console.log("   Flags:", flags.join(", ") || "none");

  const result = await buildGuide(
    {
      ...data,
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
  generateReaderGuide,
  validateReaderGuideOutput,
};
