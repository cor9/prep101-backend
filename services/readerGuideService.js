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

Your job is to generate a READER SUPPORT GUIDE for the parent or reader holding lines during a self-tape audition.

This is NOT actor coaching. This is reader-impact coaching.

Every instruction you write must answer one question:
"How does this reader behavior directly affect the actor's performance?"

TONE RULES:
- Direct, blunt, behavioral
- Cause-and-effect phrasing: "If you rush this, the emotional turn is lost." "If you go flat here, the actor has nothing to respond to."
- No soft language, no generic advice, no acting theory
- Written for a parent who has 2 minutes to absorb this before pressing record

CORE PRINCIPLES:
- The reader is never the performance — they are the condition the actor performs in
- Reader energy, timing, and tone directly shape what ends up on camera
- Lack of connection is visible on camera — it makes the actor look like they're performing alone
- Every instruction must have a concrete, immediate action attached to it

SCRIPT INTEGRITY:
- Use ONLY what is in the sides. If something is not stated, do not invent it.
- Tie every piece of guidance to a specific moment, line, or beat from the scene.
- No generic acting advice — if it could apply to any scene, cut it.

READER DIFFICULTY SCORE:
- Easy: single character, flat pacing, minimal emotional shifts
- Moderate: some emotional turns, timing sensitivity, 1–2 characters
- Challenging: escalating stakes, tight timing windows, multiple characters, emotional pivots

FORMAT: Output pure HTML only. No markdown, no code fences, no \`\`\`html wrappers.
Use semantic HTML. No inline color or background-color styles.
Be concise — every section should be scannable in under 30 seconds.`;

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

  return `Generate a Reader Support Guide for this self-tape session.

${productionTitle ? `PRODUCTION: ${productionTitle}` : ""}
${productionType ? `TYPE: ${productionType}` : ""}
${genre ? `GENRE: ${genre}` : ""}
${storyline ? `CONTEXT: ${storyline}` : ""}

SIDES:
${sceneText}

Generate the complete guide using EXACTLY the sections below, in this order. Every section must contain at least one concrete, immediate action the reader can take. No section may contain generic advice that could apply to any scene.

<p><strong>⚠️ Why This Matters</strong><br>The way you read this scene directly affects how believable the performance feels. What you do — and don't do — shows up on camera.</p>

<h2>🎭 Scene Snapshot</h2>
What is this scene? Describe the tone, stakes, and emotional world in 2–3 sentences. Then state exactly what the actor needs to do their best work here. Be specific to THIS script.

<h2>🎯 Your Role in This Scene</h2>
Do NOT describe how to "play" the other character. Instead: explain what energy, pressure, or presence the reader needs to bring so the actor has something real to respond to. Frame it as: "Your job is to create the condition where the actor can ___."

<h2>📊 Reader Difficulty Score</h2>
State Easy / Moderate / Challenging. Follow with 2–3 sentences explaining WHY — based on specific demands in this scene (timing windows, emotional pivots, character count). Name the hardest moment in the scene for the reader.

<h2>⏱️ Pacing & Beats to Protect</h2>
Identify 3–5 specific moments in this scene where timing directly impacts the actor's performance. Use cause-and-effect language: "If you rush [beat], the actor loses the chance to ___."
Do not generalize. Reference actual lines or transitions from the sides.

<h2>🎤 How to Read Your Lines</h2>
Give delivery guidance that explains HOW it affects the actor — not just what to do.
For any line that needs special handling, call it out directly: name the line or paraphrase it, then say what to do and why it matters.
Replace phrases like "be natural" with specific behavior: volume level, pace, emotional temperature.

<h2>🔊 Volume & Energy Guide</h2>
Scale the reader's energy relative to the actor — not the scene in general.
Give explicit guidance: "Stay one level below the actor's energy." "Pull back after [beat] to give them room to escalate."
Call out any moments where going too big would overpower the actor, or going too flat would deflate them.

<h2>🎯 Do This / Avoid This</h2>
<strong>Do This:</strong>
<ul>
  <li>3–5 specific, actionable reader behaviors tied to moments in this scene</li>
  <li>Each item must reference a real beat, line, or transition from the sides</li>
  <li>Format: "[Specific action] — this gives the actor [specific result]"</li>
</ul>
<strong>Avoid This:</strong>
<ul>
  <li>3–5 common reader mistakes that would hurt this specific performance</li>
  <li>Use consequence language: "If you ___, the actor loses ___"</li>
  <li>No generic warnings — each must be grounded in this scene</li>
</ul>

<h2>🎭 Reader Awareness</h2>
If the reader plays multiple characters: how to differentiate them without overacting — name the tonal or energy difference between them, and how fast the switch needs to happen.
If the reader plays one character: explain how consistency in your delivery protects the actor's performance arc. Identify one moment where inconsistency would be most damaging.

<h2>⚠️ Common Mistakes to Avoid</h2>
3–5 scene-specific mistakes. Each one must name a real moment from the sides and the consequence. Be blunt.
Example format: "Don't rush [moment] — the actor needs that pause to land the turn."

<h2>🎧 Performance Feel Reference</h2>
1–2 sentences capturing the overall vibe — a TV/film comparison the parent can immediately understand and feel. Then add one sentence on what the reader's energy should feel like, not what it should sound like.

<h2>👀 Connection Note (CRITICAL)</h2>
Direct instruction: maintain eye-line, presence, and active listening throughout.
State clearly that dead eyes, looking at the page, or zoning out is visible on camera and undermines the actor's performance.
Keep this short — 3–4 sentences. Make it land.

<h2>🧠 Quick Mindset Reset</h2>
4–5 short, punchy reminders the parent reads right before pressing record. No fluff. Each one should do something — shift their mindset, sharpen their focus, or remind them of their job.

Output ONLY the HTML content. No \`\`\`html block. No commentary before or after.`;
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
