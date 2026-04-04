/**
 * readerGuideService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a READER SUPPORT GUIDE — practical, scene-specific coaching for the
 * parent or non-actor reader who is holding lines during a self-tape session.
 *
 * This is NOT actor coaching.  The output is entirely framed for the reader.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fetch = require("node-fetch");
const { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS } = require("../config/models");

// ─── System Prompt ──────────────────────────────────────────────────────────

const READER_SYSTEM_PROMPT = `You are Corey Ralston, an expert acting coach and youth talent manager.

Your job is to analyze audition sides and generate a READER SUPPORT GUIDE specifically for the parent or reader helping the actor during a self-tape.

This is NOT actor coaching.

This is practical, specific direction for how the reader should support the performance.

Your tone:
- Clear, confident, and direct
- Supportive but no-nonsense
- Practical, not theoretical
- Written for parents (not actors)

Your job is to:

1. Identify the tone and genre of the scene
2. Explain how the reader should emotionally approach the scene
3. Break down pacing and beats from the READER perspective
4. Give line delivery guidance for the reader (without overacting)
5. Help the reader understand where to:
   - pause
   - not rush
   - support emotional turns
6. Provide volume and energy calibration
7. Address how to handle multiple characters (if applicable)
8. Warn against common mistakes specific to THIS scene
9. Reinforce connection, timing, and presence

IMPORTANT RULES:
- The reader should never overshadow the actor
- The reader should never be flat or disengaged
- The reader is part of the scene's rhythm

SCRIPT INTEGRITY:
- Use ONLY facts present in the script. If key information is missing write "Not stated in sides" rather than inventing.
- NO inline citations or evidence tags — just coach.
- Tie EVERY piece of advice directly back to the provided sides.

READER DIFFICULTY SCORE:
After analyzing the scene, assign a Reader Difficulty Score:
- Easy: minimal emotional shifts, straightforward pacing, single character
- Moderate: some emotional turns, requires pacing awareness, 1–2 characters
- Challenging: major emotional shifts, tight timing, multiple characters, escalating energy

FORMAT: Output pure HTML content ONLY (no markdown, no code fences, no \`\`\`html wrappers).
Use semantic HTML — headings, paragraphs, lists — let the CSS handle styling.
NEVER use inline color or background-color styles.
Write concisely — parents should be able to read and use this in 2–3 minutes.`;

// ─── User Prompt Builder ─────────────────────────────────────────────────────

function buildReaderPrompt(data) {
  const {
    sceneText,
    characterName,
    productionTitle,
    productionType,
    genre,
    storyline,
  } = data;

  return `You are generating a Reader Support Guide for the self-tape of:

CHARACTER: ${characterName}
PRODUCTION: ${productionTitle} (${productionType}${genre ? ` / ${genre}` : ""})
${storyline ? `STORYLINE CONTEXT: ${storyline}` : ""}

SIDES / SCENE TEXT:
${sceneText}

Generate the complete Reader Support Guide using EXACTLY the following sections in this order:

<h2>🎭 Scene Snapshot (For the Reader)</h2>
Brief explanation of tone, genre, and emotional world. 2–4 sentences. Be specific to THIS scene.

<h2>🎯 Your Role in This Scene</h2>
What the reader represents emotionally and functionally. Who are you to the actor's character? What energy do you bring to the room?

<h2>📊 Reader Difficulty Score</h2>
State: Easy / Moderate / Challenging — then give a 2–3 sentence explanation based on emotional complexity, pacing demands, and character load.

<h2>⏱️ Pacing & Beats to Protect</h2>
Specific guidance on timing, pauses, and rhythm. Call out exact moments in the scene where pacing matters most. Don't generalize.

<h2>🎤 How to Read Your Lines</h2>
General delivery tone plus any line-specific adjustments. If a specific line needs special treatment, call it out. Don't just say "be natural" — be specific.

<h2>🔊 Volume & Energy Guide</h2>
Clear instruction on loudness, intensity, and presence shifts. Where to pull back. Where to lean in.

<h2>🎭 Playing Multiple Characters (if applicable)</h2>
If the reader voices more than one character: how to differentiate without overacting. If only one character, state: "You're reading one character — stay consistent throughout."

<h2>⚠️ Common Mistakes to Avoid</h2>
3–5 scene-specific warnings. Be direct. ("Don't rush line X." "Don't go flat after the pause." "Don't match the actor's emotion — let them own it.")

<h2>🎧 Performance Feel Reference</h2>
One or two sentences capturing the overall vibe. Think: "The tone is like a quiet scene from a grounded family drama — not theatrical, not flat. Think Parenthood, not a school play."

<h2>🧠 Quick Mindset Reset</h2>
3–5 short, powerful reminders for the parent to read right before hitting record. Punchy. Practical. Confidence-building.

Output ONLY the HTML content. No wrapping \`\`\`html block. No extra commentary before or after.`;
}

// ─── HTML Wrapper ────────────────────────────────────────────────────────────

function wrapReaderGuideHtml(rawContent, meta = {}) {
  if (!rawContent) return "";

  // If Claude accidentally returned a full HTML document, return as-is
  if (rawContent.includes("<html") && rawContent.includes("</html>")) {
    return rawContent;
  }

  const {
    characterName = "Actor",
    productionTitle = "",
    productionType = "",
  } = meta;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reader Guide • ${characterName} — ${productionTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    :root {
      --teal:    #14b8a6;
      --teal-dk: #0d9488;
      --ink:     #0f172a;
      --slate:   #1e293b;
      --mist:    #e2e8f0;
      --amber:   #f59e0b;
      --rose:    #f43f5e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--ink);
      color: var(--mist);
      font-family: "Inter", system-ui, sans-serif;
      line-height: 1.7;
    }
    /* ── Hero ─────────────────────────────────────────────── */
    .rg-hero {
      background: linear-gradient(135deg, var(--teal-dk) 0%, #0f4f57 100%);
      padding: 3rem 1.5rem 4.5rem;
      text-align: center;
    }
    .rg-hero .eyebrow {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.65);
      margin-bottom: 0.75rem;
    }
    .rg-hero h1 {
      font-family: "Playfair Display", serif;
      font-size: clamp(2rem, 4vw, 2.75rem);
      color: #fff;
      line-height: 1.2;
    }
    .rg-hero .sub {
      margin-top: 0.5rem;
      font-size: 0.95rem;
      color: rgba(255,255,255,0.6);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .rg-hero .badge {
      display: inline-block;
      margin-top: 1.25rem;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 999px;
      padding: 0.35rem 1rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #fff;
      letter-spacing: 0.08em;
    }
    /* ── Shell ────────────────────────────────────────────── */
    .rg-shell {
      max-width: 820px;
      margin: -2.5rem auto 5rem;
      padding: 0 1.25rem;
    }
    .rg-card {
      background: var(--slate);
      border-radius: 20px;
      padding: 2.75rem 2.5rem;
      box-shadow: 0 30px 80px rgba(0,0,0,0.5);
      border: 1px solid rgba(148,163,184,0.12);
    }
    /* ── Section headings ─────────────────────────────────── */
    h2 {
      font-size: 1rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--teal);
      margin-top: 2.5rem;
      margin-bottom: 1rem;
      padding-bottom: 0.45rem;
      border-bottom: 1px solid rgba(20,184,166,0.25);
    }
    h2:first-child { margin-top: 0; }
    h3 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--amber);
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
    }
    /* ── Body text ────────────────────────────────────────── */
    p { color: #cbd5e1; margin-bottom: 0.85rem; font-size: 0.97rem; }
    ul, ol { color: #cbd5e1; padding-left: 1.35rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.4rem; font-size: 0.97rem; }
    strong { color: var(--amber); font-weight: 600; }
    em { color: var(--teal); font-style: normal; font-weight: 500; }
    /* ── Difficulty badge ─────────────────────────────────── */
    .difficulty-easy     { color: #4ade80; font-weight: 700; }
    .difficulty-moderate { color: var(--amber); font-weight: 700; }
    .difficulty-challenging { color: var(--rose); font-weight: 700; }
    /* ── Footer ───────────────────────────────────────────── */
    .rg-footer {
      text-align: center;
      padding: 2rem 1rem 3rem;
      font-size: 0.8rem;
      color: rgba(148,163,184,0.5);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    @media (max-width: 600px) {
      .rg-card { padding: 1.75rem 1.25rem; }
    }
  </style>
</head>
<body>
  <header class="rg-hero">
    <p class="eyebrow">Reader Support Guide • PREP101</p>
    <h1>${characterName}</h1>
    <p class="sub">${productionTitle}${productionType ? ` · ${productionType}` : ""}</p>
    <span class="badge">For the Parent / Reader</span>
  </header>

  <main class="rg-shell">
    <article class="rg-card">
      ${rawContent}
    </article>
  </main>

  <footer class="rg-footer">
    Generated by PREP101 · Reader Support Mode
  </footer>
</body>
</html>`;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

/**
 * generateReaderGuide(data)
 *
 * @param {object} data
 *   - sceneText        {string}  Extracted PDF text
 *   - characterName    {string}
 *   - productionTitle  {string}
 *   - productionType   {string}
 *   - genre            {string|undefined}
 *   - storyline        {string|undefined}
 * @returns {Promise<string>}  Full HTML string ready to serve
 */
async function generateReaderGuide(data) {
  const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const userPrompt = buildReaderPrompt(data);

  console.log("📖 [ReaderGuide] Generating reader support guide...");
  console.log(`   Character: ${data.characterName}`);
  console.log(`   Production: ${data.productionTitle} (${data.productionType})`);

  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [ReaderGuide] Attempt ${attempt}/${maxRetries}...`);

      const controller = new AbortController();
      // Reader guides are shorter — 3-minute timeout is plenty
      const timeoutId = setTimeout(() => controller.abort(), 180000);

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
          max_tokens: Math.min(DEFAULT_CLAUDE_MAX_TOKENS, 4000), // Reader guides don't need 8k tokens
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
          await new Promise((r) => setTimeout(r, attempt * 2000));
          lastError = new Error(`Gateway timeout (attempt ${attempt})`);
          continue;
        }

        throw new Error(`Anthropic ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.content && result.content[0] && result.content[0].text) {
        const rawHtml = result.content[0].text;
        console.log(
          `✅ [ReaderGuide] Generated ${rawHtml.length} chars of content`
        );

        // Wrap with branded HTML shell
        return wrapReaderGuideHtml(rawHtml, {
          characterName: data.characterName,
          productionTitle: data.productionTitle,
          productionType: data.productionType,
        });
      } else {
        throw new Error("Invalid response format from Anthropic API");
      }
    } catch (err) {
      lastError = err;

      if (err.name === "AbortError") {
        console.error(`⏰ [ReaderGuide] Timeout on attempt ${attempt}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
          continue;
        }
      }

      if (attempt < maxRetries) {
        console.log(`🔄 [ReaderGuide] Retrying after error: ${err.message}`);
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }

      console.error(`❌ [ReaderGuide] All ${maxRetries} attempts failed`);
      throw err;
    }
  }

  throw lastError || new Error("Failed to generate reader guide");
}

module.exports = {
  generateReaderGuide,
  wrapReaderGuideHtml,
  READER_SYSTEM_PROMPT,
};
