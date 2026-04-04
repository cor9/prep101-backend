/**
 * readerGuideService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a READER SUPPORT GUIDE — practical, scene-specific coaching for the
 * parent or non-actor reader who is holding lines during a self-tape session.
 *
 * This is NOT actor coaching. The output is entirely framed for the reader.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fetch = require("node-fetch");
const { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS } = require("../config/models");

// ─── System Prompt ──────────────────────────────────────────────────────────

const READER_SYSTEM_PROMPT = `You are Corey Ralston, an expert acting coach and youth talent manager.

Your job is to generate a READER SUPPORT GUIDE for the parent or reader holding lines during a self-tape audition.

This is NOT actor coaching. This is reader-impact coaching.

CORE QUESTION — every instruction must answer:
"What should the reader DO differently, and how does it affect the actor?"

TONE RULES:
- Direct. Concise. Slightly firm. Zero fluff.
- Cause-and-effect: "If you rush this, the actor loses the turn."
- No abstract acting language. No soft filler.
- Written for a parent reading this 2 minutes before pressing record.

CORE PRINCIPLES:
- The reader is never the performance — they are the condition the actor performs in.
- Reader energy, timing, and presence directly shape what lands on camera.
- Lack of connection is visible on camera — it makes the actor look like they're performing alone.
- Every instruction must have a concrete, immediate action.

FORMATTING RULES (NON-NEGOTIABLE):
- Use bullet points for ALL guidance. No paragraph blocks.
- Every bullet: 1–2 sentences max.
- Each section must be readable in under 5 seconds.
- No dense explanations. No abstract concepts.
- If it can't be acted on immediately, cut it.
- Use <ul><li> tags for all lists.
- Use <strong> only to flag the most critical word or phrase in a bullet.
- Use <h2> for section headers, <p> only for the Why This Matters block at the top.

SCRIPT INTEGRITY:
- Reference specific lines, beats, or moments from the sides — not the scene in general.
- Never invent details not in the script.
- If it could apply to any scene, it's not specific enough — rewrite it.`;

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

---

Generate the guide in EXACTLY this section order. Rules for every section:
- Bullet points only (ul/li) — no paragraph blocks except the Why This Matters intro
- Readable in under 5 seconds
- Must answer: "What should the reader DO differently?"
- Must reference specific lines or beats from the sides above — no generic advice

---

<p><strong>⚠️ Why This Matters</strong><br>
The way you read this scene directly affects how believable the performance feels.<br>
What you do — and don't do — shows up on camera.</p>

<h2>🎬 Scene Snapshot</h2>
4 bullets max. Each bullet = 1 line.
- Genre and tone (name it plainly)
- What's at stake in this scene
- Emotional temperature: where it starts vs. where it ends
- What the actor needs most from you to land their performance

<h2>🎯 Your Job</h2>
3–4 bullets. Each starts with "Your job is to ___."
Do NOT say "play the character." Instead: what specific energy, pressure, or presence do you bring so the actor has something real to respond to?

<h2>🔑 Key Beats</h2>
This is the most critical section. 4–6 bullets.
Each bullet MUST follow this format:
"[Quote or close paraphrase of line] → [Exact instruction: pause, slow down, hold silence, lower volume, etc.] — [consequence for the actor if you don't]"
Reference actual lines from the sides. Be exact.

<h2>🎤 How to Read</h2>
4–5 bullets. Each one: specific delivery behavior + how it affects the actor.
No "be natural." No "just react."
Name the volume level, pace, or emotional temperature. If a specific line needs different treatment, name it.

<h2>🔊 Volume & Energy</h2>
3–4 bullets. Scale relative to the actor — not the scene in abstract.
- Where to stay under them (and why)
- Where to match or push (and when)
- One moment where going too big pulls focus off the actor
- One moment where going flat kills the scene

<h2>✅ Do This / ❌ Avoid This</h2>
<strong>Do This:</strong>
<ul>
<li>3–5 bullets. Each tied to a specific moment. Format: "[Action] — this gives the actor [result]."</li>
</ul>
<strong>Avoid This:</strong>
<ul>
<li>3–5 bullets. Consequence required. Format: "If you [mistake], the actor loses [specific thing]."</li>
</ul>

<h2>👀 Connection (CRITICAL)</h2>
3–4 bullets. Short. Blunt.
- Eye-line: what it must be and when
- What active listening looks like on camera (vs. waiting for your line)
- The cost of disconnecting — plainly stated
- The one moment in this scene where connection is non-negotiable

<h2>🧠 Quick Reset</h2>
4–5 bullets. Parent reads this right before pressing record.
One sentence each. No explanation.
They should feel sharp, focused, and clear on their job.

---

Output ONLY the HTML. No \`\`\`html block. No text before or after.`;
}

// ─── HTML Wrapper ────────────────────────────────────────────────────────────

function wrapReaderGuideHtml(rawContent, meta = {}) {
  if (!rawContent) return "";

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
      line-height: 1.65;
    }
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
    /* Why This Matters block */
    .rg-card > p:first-child {
      background: rgba(244,63,94,0.1);
      border-left: 3px solid var(--rose);
      border-radius: 8px;
      padding: 0.9rem 1rem;
      margin-bottom: 1.75rem;
      font-size: 0.92rem;
      color: #fda4af;
      line-height: 1.55;
    }
    h2 {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--teal);
      margin-top: 2.25rem;
      margin-bottom: 0.75rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid rgba(20,184,166,0.2);
    }
    h2:first-of-type { margin-top: 0; }
    h3 {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--amber);
      margin-top: 1rem;
      margin-bottom: 0.4rem;
    }
    p { color: #cbd5e1; margin-bottom: 0.75rem; font-size: 0.93rem; }
    ul {
      list-style: none;
      padding: 0;
      margin: 0 0 0.75rem 0;
    }
    li {
      color: #cbd5e1;
      font-size: 0.93rem;
      padding: 0.4rem 0 0.4rem 1.1rem;
      position: relative;
      line-height: 1.55;
      border-bottom: 1px solid rgba(148,163,184,0.06);
    }
    li:last-child { border-bottom: none; }
    li::before {
      content: "→";
      position: absolute;
      left: 0;
      color: var(--teal);
      font-size: 0.8rem;
      top: 0.45rem;
    }
    strong { color: var(--amber); font-weight: 600; }
    em { color: var(--teal); font-style: normal; font-weight: 500; }
    .rg-footer {
      text-align: center;
      padding: 2rem 1rem 3rem;
      font-size: 0.8rem;
      color: rgba(148,163,184,0.4);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    @media (max-width: 600px) {
      .rg-card { padding: 1.5rem 1rem; }
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
          max_tokens: Math.min(DEFAULT_CLAUDE_MAX_TOKENS, 4000),
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
        console.log(`✅ [ReaderGuide] Generated ${rawHtml.length} chars`);
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
        console.log(`🔄 [ReaderGuide] Retrying: ${err.message}`);
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
