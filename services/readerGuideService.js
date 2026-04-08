/**
 * readerGuideService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a READER SUPPORT GUIDE — practical, scene-specific coaching for the
 * parent or non-actor reader holding lines during a self-tape session.
 *
 * This is NOT actor coaching. The output is entirely framed for the reader.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS } = require("../config/models");
const { scrubWatermarks } = require("./textCleaner");

const READER_GUIDE_EXAMPLE_PATH = path.join(
  __dirname,
  "..",
  "methodology",
  "reader101_june_example.html"
);

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

const READER_SYSTEM_PROMPT = `You are generating a Reader Support Guide using a STRICT production system.

You MUST follow:
- Exact section order
- Exact tone rules
- Exact formatting rules
- HTML output only

If any rule is violated, regenerate internally before responding.

This is not optional.

QUALITY CHECK BEFORE OUTPUT:

Ensure:
- "What Will Go Wrong" includes exactly 3 bullets
- Each bullet contains a failure + consequence
- "Your Job" calls out WRONG instinct before RIGHT instruction
- At least 2 lines include explicit consequence language ("If you...", "This kills...", "It falls apart...", etc.)
- No repeated guidance across sections
- Every bullet is a physical directive (playable)

If not, rewrite before output.

CORRUPTION DETECTION:

If extracted text is:
- repetitive
- timestamp-heavy
- watermark-heavy
- under 50 meaningful words

THEN:
- IGNORE extracted text
- Use Title, Genre, Role only
- Generate a high-level Reader Guide

DO NOT return error unless ZERO context exists.

Never output Markdown fences, JSON, commentary, or explanatory text before or after the HTML artifact.`;

function safeReadExampleHtml() {
  try {
    return fs.readFileSync(READER_GUIDE_EXAMPLE_PATH, "utf8");
  } catch (error) {
    console.warn("[ReaderGuide] Example HTML unavailable:", error.message);
    return "";
  }
}

const READER_GUIDE_EXAMPLE_HTML = safeReadExampleHtml();

function stripCodeFences(text = "") {
  return text
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function countMeaningfulWords(text = "") {
  return (text.match(/\b[\w']+\b/g) || []).length;
}

function detectIntimacy(content = "") {
  const normalized = String(content || "").toLowerCase();
  return INTIMACY_TRIGGERS.some((word) => normalized.includes(word));
}

function detectIntimacyArc(content = "") {
  const normalized = String(content || "").toLowerCase();
  const hasEscalation = INTIMACY_ESCALATION_TRIGGERS.some((word) =>
    normalized.includes(word)
  );
  const hasAftermath = INTIMACY_AFTERMATH_TRIGGERS.some((word) =>
    normalized.includes(word)
  );
  return hasEscalation && hasAftermath;
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

  const intimacyMode = detectIntimacy(combinedContent);
  const actorAge = Number.parseInt(data.actorAge, 10);
  const parentContext = /parent/i.test(combinedContent) || (!Number.isNaN(actorAge) && actorAge < 18);

  return {
    mode: intimacyMode ? "INTIMACY" : "STANDARD",
    intimacyMode,
    intimacyArc: intimacyMode && detectIntimacyArc(combinedContent),
    actorAge: Number.isNaN(actorAge) ? null : actorAge,
    parentContext,
  };
}

function buildReaderPrompt(data, validationFeedback = "") {
  const {
    sceneText,
    characterName,
    productionTitle,
    productionType,
    genre,
    storyline,
    fallbackMode,
    actorAge,
  } = data;

  const cleanedSceneText = scrubWatermarks(sceneText || "").trim();
  const meaningfulWordCount = countMeaningfulWords(cleanedSceneText);
  const modeContext = buildReaderModeContext({
    sceneText: cleanedSceneText,
    characterName,
    productionTitle,
    productionType,
    genre,
    storyline,
    actorAge,
  });

  const metadataLines = [
    characterName ? `ROLE: ${characterName}` : "",
    productionTitle ? `TITLE: ${productionTitle}` : "",
    productionType ? `FORMAT: ${productionType}` : "",
    genre ? `GENRE: ${genre}` : "",
    actorAge ? `ACTOR AGE: ${actorAge}` : "",
    storyline ? `STORY / CONTEXT: ${storyline}` : "",
  ].filter(Boolean);

  const readableSidesBlock = fallbackMode
    ? `CORRUPTION FALLBACK IS ACTIVE.
- Ignore extracted script text.
- Build the guide from Title, Genre, Role, and any clean story metadata only.
- Add this note near the top of the guide body: "⚠️ Upload clearer sides for line-specific guidance."
- Do NOT quote lines or invent scene-specific dialogue.
${modeContext.intimacyMode ? "- Intimacy was detected, so do NOT fallback to generic. Generate an Intimacy Protocol Guide based on detected tone and genre." : ""}`
    : `READABLE SIDES:
${cleanedSceneText || "[No readable sides provided]"}`;

  return `READER SUPPORT GUIDE SYSTEM — CORE RULES

OUTPUT FORMAT:
- Always generate as a self-contained HTML artifact
- Dark headers, white text, high contrast
- Header colors: #633806, #085041, #4A1B0C, #2C2C2A, #791F1F
- Header text always: #F1EFE8
- Body text always: var(--color-text-primary)
- Consequence lines in italic, muted, cause -> effect format throughout
- Output ONLY HTML. No markdown fences.

MANDATORY SECTION ORDER:
- ⚠️ What Will Go Wrong
${modeContext.intimacyMode ? "- ⚠️ When the Scene Crosses Into Intimacy" : ""}
- 01 Why This Matters
- 02 Performance Engine
- 03 Scene Snapshot
- 04 Your Job
- 05 Playing Multiple Characters
- 06 Reader Fundamentals
- 07 Key Beats
- 08 Rhythm, Pace & Energy
- 09 Do This / Avoid This
- 10 Connection
- 11 Tone & Reference Anchor
- 12 Quick Reset

VOICE RULES:
- Every bullet is a physical directive
- Call out the WRONG instinct before giving the right one
- Add consequences to critical beats
- Friction over instruction
- One directive per bullet
- Max 1 line per bullet
- Never repeat guidance across sections
- Never include conflicting instructions
- Every section must contain at least one high-stakes consequence frame
${modeContext.intimacyMode ? "- Every bullet must follow ACTION -> CONSEQUENCE" : ""}

SECTION-SPECIFIC REQUIREMENTS:
- "What Will Go Wrong" leads the guide and contains exactly 3 bullets on a black background with red markers
- "Your Job" must call out the wrong instinct before the right direction
- "Playing Multiple Characters" is mandatory and must include the contrast line "If X and Y feel the same, the audition dies instantly"
- "Reader Fundamentals" must be framed as where readers quietly ruin auditions
- "Rhythm, Pace & Energy" is one merged section, never split into two
- "Connection" must open with "NAME can only go as deep as you let them" or the closest natural name/pronoun adaptation
- "Tone & Reference Anchor" must lead with consequence framing like "If you play it like X, it falls apart immediately"
${modeContext.intimacyMode ? `- Add the section "⚠️ When the Scene Crosses Into Intimacy" directly after "What Will Go Wrong"
- In "What Will Go Wrong", force-add the failures: pulling back due to discomfort, rushing intimate beats, judging the material
- Disable comedic framing and force grounded realism throughout
- Increase consequence density across the guide
- Always include these exact lines somewhere in the intimacy guide:
  Reader does NOT simulate physical behavior
  Reader provides emotional grounding only
${modeContext.parentContext ? "- Add this exact note in the intimacy section: This may feel uncomfortable. Stay neutral and professional." : ""}
${modeContext.intimacyArc ? "- Track the emotional arc as: build -> tension -> exposure -> shame -> exit" : ""}` : ""}

INPUT CONTEXT:
${metadataLines.join("\n")}
MEANINGFUL WORDS IN SIDES: ${meaningfulWordCount}
MODE: ${modeContext.mode}

${readableSidesBlock}

${validationFeedback ? `REVISION REQUIRED:\n${validationFeedback}\n` : ""}
STYLE + EXAMPLE:
Use the visual system, class rhythm, and severity of this full June example as your taste reference.
Do not copy its story specifics, line quotes, or character names unless they truly match the current sides.

${READER_GUIDE_EXAMPLE_HTML || "[Example HTML unavailable in this environment.]"}

FINAL INSTRUCTIONS:
- Build a fresh guide for THIS role and THIS material.
- Reuse the same class naming and overall HTML approach as the example whenever possible.
- If readable lines exist, anchor Key Beats and consequences to the actual text.
- If fallback mode is active, stay high-level and do not fake line-specific analysis.
- If MODE is INTIMACY, build an Intimacy Protocol Guide without sanitizing the material.
- Return a complete HTML document with inline CSS and no extra commentary.`;
}

function extractSectionSlice(html, title, nextTitle) {
  const start = html.indexOf(title);
  if (start === -1) return "";

  if (!nextTitle) {
    return html.slice(start);
  }

  const end = html.indexOf(nextTitle, start + title.length);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

function validateReaderGuideOutput(html, options = {}) {
  const cleaned = stripCodeFences(html);
  const errors = [];
  const modeContext = buildReaderModeContext(options);

  if (!/<html[\s>]/i.test(cleaned) || !/<\/html>/i.test(cleaned)) {
    errors.push("Return a complete self-contained HTML document.");
  }

  if (!cleaned.includes("#F1EFE8")) {
    errors.push("Header text color #F1EFE8 is missing.");
  }

  if (!cleaned.includes("var(--color-text-primary)")) {
    errors.push("Body text must use var(--color-text-primary).");
  }

  const sectionPositions = REQUIRED_SECTION_TITLES.map((title) => ({
    title,
    index: cleaned.indexOf(title),
  }));

  if (sectionPositions.some((section) => section.index === -1)) {
    const missing = sectionPositions
      .filter((section) => section.index === -1)
      .map((section) => section.title);
    errors.push(`Missing required sections: ${missing.join(", ")}.`);
  } else {
    for (let i = 1; i < sectionPositions.length; i += 1) {
      if (sectionPositions[i].index < sectionPositions[i - 1].index) {
        errors.push("Sections are out of order.");
        break;
      }
    }
  }

  const whatWillGoWrong = extractSectionSlice(
    cleaned,
    "What Will Go Wrong",
    "Why This Matters"
  );
  const whatWillGoWrongBullets = (whatWillGoWrong.match(/<li\b/gi) || []).length;
  if (whatWillGoWrongBullets !== 3) {
    errors.push('"What Will Go Wrong" must include exactly 3 bullets.');
  }

  const consequenceMatches =
    cleaned.match(/If you|This kills|kills the audition|falls apart immediately|you lose the scene|kill the emotional turn/gi) || [];
  if (consequenceMatches.length < 2) {
    errors.push("Add more explicit consequence language.");
  }

  const yourJobSection = extractSectionSlice(
    cleaned,
    "Your Job",
    "Playing Multiple Characters"
  );
  if (!/wrong instinct|most readers|don't|do not|stop/gi.test(yourJobSection)) {
    errors.push('"Your Job" must call out the wrong instinct first.');
  }

  if (!/the audition dies instantly/i.test(cleaned)) {
    errors.push('Include the mandatory "the audition dies instantly" contrast line.');
  }

  if (modeContext.intimacyMode) {
    if (!/When the Scene Crosses Into Intimacy/i.test(cleaned)) {
      errors.push('Add the intimacy section "When the Scene Crosses Into Intimacy".');
    }
    if (!/Reader does NOT simulate physical behavior/i.test(cleaned)) {
      errors.push('Include the exact role-lock line "Reader does NOT simulate physical behavior".');
    }
    if (!/Reader provides emotional grounding only/i.test(cleaned)) {
      errors.push('Include the exact role-lock line "Reader provides emotional grounding only".');
    }
    if (modeContext.parentContext && !/This may feel uncomfortable\. Stay neutral and professional\./i.test(cleaned)) {
      errors.push("Include the parent/minor professionalism note.");
    }
    const intimacyWarnings = extractSectionSlice(
      cleaned,
      "What Will Go Wrong",
      "Why This Matters"
    );
    if (!/discomfort|pulling back/i.test(intimacyWarnings)) {
      errors.push('Add the discomfort failure to "What Will Go Wrong".');
    }
    if (!/rushing intimate beats|rush/i.test(intimacyWarnings)) {
      errors.push('Add the rushed intimacy failure to "What Will Go Wrong".');
    }
    if (!/judging the material|judge/i.test(intimacyWarnings)) {
      errors.push('Add the judging-the-material failure to "What Will Go Wrong".');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function wrapReaderGuideHtml(rawContent, meta = {}) {
  const content = stripCodeFences(rawContent);
  if (!content) return "";

  if (content.includes("<html") && content.includes("</html>")) {
    return content;
  }

  const {
    characterName = "Reader Guide",
    productionTitle = "",
    productionType = "",
    fallbackMode = false,
  } = meta;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reader Support Guide — ${characterName}${productionTitle ? ` | ${productionTitle}` : ""}</title>
  <style>
    :root {
      --color-bg: #121211;
      --color-surface: #1A1A18;
      --color-surface-soft: #23231F;
      --color-border: rgba(241, 239, 232, 0.12);
      --color-text-primary: #F1EFE8;
      --color-text-muted: #B6AEA1;
      --color-danger: #791F1F;
      --color-amber: #633806;
      --color-teal: #085041;
      --color-coral: #4A1B0C;
      --color-dark: #2C2C2A;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at top, #232017 0%, var(--color-bg) 45%);
      color: var(--color-text-primary);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.65;
      padding: 24px 16px 48px;
    }
    .guide {
      max-width: 880px;
      margin: 0 auto;
      background: rgba(18, 18, 17, 0.92);
      border: 1px solid var(--color-border);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45);
    }
    .guide-header {
      padding: 24px;
      border-bottom: 1px solid var(--color-border);
      background: linear-gradient(135deg, #1B1916 0%, #111 100%);
    }
    .guide-title {
      font-size: clamp(26px, 4vw, 38px);
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .guide-sub {
      margin-top: 6px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }
    .fallback-note {
      margin: 20px 24px 0;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid rgba(249, 115, 22, 0.25);
      background: rgba(121, 31, 31, 0.24);
      color: var(--color-text-primary);
    }
    .content {
      padding: 24px;
    }
    h2, h3 {
      color: #F1EFE8;
      margin-top: 24px;
      margin-bottom: 12px;
      font-size: 16px;
      letter-spacing: 0.02em;
    }
    p, li {
      color: var(--color-text-primary);
      font-size: 14px;
    }
    p {
      margin-bottom: 12px;
    }
    ul {
      list-style: none;
      margin-bottom: 12px;
    }
    li {
      padding-left: 16px;
      position: relative;
      margin-bottom: 8px;
    }
    li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: var(--color-text-muted);
    }
    strong {
      color: var(--color-text-primary);
    }
    .consequence,
    em {
      color: var(--color-text-muted);
      font-style: italic;
    }
    .section {
      margin-bottom: 18px;
      padding: 18px;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface);
    }
    .warn-box {
      background: #090909;
      border-left: 4px solid var(--color-danger);
    }
    .warn-box li::before {
      content: "✕";
      color: #E24B4A;
    }
  </style>
</head>
<body>
  <div class="guide">
    <div class="guide-header">
      <div class="guide-title">Reader Support Guide — ${characterName}</div>
      <div class="guide-sub">${productionTitle}${productionType ? ` · ${productionType}` : ""}</div>
    </div>
    ${fallbackMode ? '<div class="fallback-note">⚠️ Upload clearer sides for line-specific guidance.</div>' : ""}
    <div class="content">
      ${content}
    </div>
  </div>
</body>
</html>`;
}

async function generateReaderGuide(data) {
  const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  console.log("📖 [ReaderGuide] Generating reader support guide...");
  console.log(`   Character: ${data.characterName}`);
  console.log(`   Production: ${data.productionTitle} (${data.productionType})`);
  console.log(`   Fallback: ${Boolean(data.fallbackMode)}`);
  const modeContext = buildReaderModeContext(data);
  console.log(`   Reader Mode: ${modeContext.mode}`);

  const maxRetries = 2;
  let lastError = null;
  let validationFeedback = "";

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      console.log(`🔄 [ReaderGuide] Attempt ${attempt}/${maxRetries}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      const userPrompt = buildReaderPrompt(data, validationFeedback);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: DEFAULT_CLAUDE_MODEL,
          max_tokens: Math.min(DEFAULT_CLAUDE_MAX_TOKENS, 7000),
          system: READER_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ [ReaderGuide] API Error (attempt ${attempt}): ${response.status} — ${errorText}`
        );
        if (response.status === 504 && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          lastError = new Error(`Gateway timeout (attempt ${attempt})`);
          continue;
        }
        throw new Error(`Anthropic ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      const rawHtml = result?.content?.[0]?.text;

      if (!rawHtml) {
        throw new Error("Invalid response format from Anthropic API");
      }

      const cleanedHtml = stripCodeFences(rawHtml);
      const validation = validateReaderGuideOutput(cleanedHtml, data);

      if (!validation.ok) {
        console.warn("[ReaderGuide] Validation failed:", validation.errors);
        if (attempt < maxRetries) {
          validationFeedback = validation.errors.map((error) => `- ${error}`).join("\n");
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
          continue;
        }
      }

      console.log(`✅ [ReaderGuide] Generated ${cleanedHtml.length} chars`);

      return wrapReaderGuideHtml(cleanedHtml, {
        characterName: data.characterName,
        productionTitle: data.productionTitle,
        productionType: data.productionType,
        fallbackMode: Boolean(data.fallbackMode),
      });
    } catch (error) {
      lastError = error;
      if (error.name === "AbortError") {
        console.error(`⏰ [ReaderGuide] Timeout on attempt ${attempt}`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          continue;
        }
      }

      if (attempt < maxRetries) {
        console.log(`🔄 [ReaderGuide] Retrying: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
        continue;
      }

      console.error(`❌ [ReaderGuide] All ${maxRetries} attempts failed`);
      throw error;
    }
  }

  throw lastError || new Error("Failed to generate reader guide");
}

module.exports = {
  generateReaderGuide,
  wrapReaderGuideHtml,
  READER_SYSTEM_PROMPT,
  validateReaderGuideOutput,
};
