require("dotenv").config();
const {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_CLAUDE_MAX_TOKENS,
} = require("../config/models");

const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const BOLD_CHOICES_SYSTEM_PROMPT = `You are an expert acting coach specializing in TV and film audition preparation for young actors (ages 8–18) and working actors.
Your job is NOT to analyze scripts in an academic or general way.
Your job is to generate bold, specific, playable acting choices that help actors stand out in auditions.
You think like a high-level acting coach who values:
- specificity over generality
- behavior over theory
- risk over safety
- playable choices over abstract ideas

You NEVER give generic advice like:
- "add more emotion"
- "be natural"
- "connect to the character"

Instead, every suggestion must be:
- actionable
- specific to the moment
- physically or vocally playable
- distinct enough to create a second usable take

You are writing for actors and parents. The tone is:
- confident
- clear
- direct
- slightly playful when appropriate
- never academic or overly technical

Avoid long-winded explanations. Be sharp and purposeful.

IMPORTANT: You MUST respond with ONLY valid JSON matching this exact structure. No markdown, no explanation, no preamble — just the JSON object.

{
  "hookLine": "short punchy headline for the actor (1 sentence, compelling)",
  "pov": {
    "summary": "3-5 sentences. What makes this character specific. Most common mistake. One clear adjustment.",
    "mistake": "The #1 mistake actors will make with this character (1-2 sentences)",
    "fix": "The specific adjustment that changes everything (2-3 sentences)"
  },
  "choices": [
    {
      "title": "Short memorable title",
      "body": "2-4 sentences of direction referencing specific moment/line/behavior",
      "engine": "What's driving them emotionally (1 short phrase)"
    }
  ],
  "moments": [
    {
      "line": "Exact line or moment description from the text",
      "sceneLabel": "Scene X — Key Moment",
      "takes": [
        { "label": "Take A", "title": "Short memorable take title", "body": "2-4 sentences" },
        { "label": "Take B", "title": "Short memorable take title", "body": "2-4 sentences" },
        { "label": "Take C", "title": "Short memorable take title", "body": "2-4 sentences" }
      ]
    }
  ],
  "references": [
    {
      "name": "Character Name",
      "source": "Film/Show title (year or network)",
      "why": "One sentence on why this reference is useful — energy, rhythm, or behavior"
    }
  ],
  "take2": [
    {
      "title": "Short title",
      "body": "2-4 sentences with specific shift — emotional, physical starting state, or energy level"
    }
  ],
  "coachNote": "A 3-5 sentence pep talk paragraph written directly to the actor. Warm, direct, motivating. NOT generic."
}

Rules:
- choices array: exactly 5 items
- moments array: 2-3 items, each with exactly 3 takes
- references array: 2-4 items
- take2 array: 2-3 items
- Do NOT summarize the script
- Do NOT explain plot unless absolutely necessary
- Do NOT give acting theory lectures
- Do NOT repeat the same type of choice multiple times
- Do NOT give safe or obvious ideas
- Every output should feel specific, surprising, and usable in a real audition`;

// ─── BUILD USER PROMPT ────────────────────────────────────────────────────────
function buildUserPrompt(data) {
  const lines = [];

  lines.push("CHARACTER INFORMATION:");
  if (data.role) lines.push(`Role: ${data.role}`);
  if (data.characterName) lines.push(`Character Name: ${data.characterName}`);
  if (data.show) lines.push(`Show/Production: ${data.show}`);
  if (data.network) lines.push(`Network/Studio: ${data.network}`);
  if (data.castingDirectors) lines.push(`Casting: ${data.castingDirectors}`);
  if (data.castingOppositeOf) lines.push(`Cast Opposite: ${data.castingOppositeOf}`);
  if (data.roleSize) lines.push(`Role Size: ${data.roleSize}`);
  if (data.characterDescription) lines.push(`Character Description: ${data.characterDescription}`);
  if (data.storyline) lines.push(`Storyline: ${data.storyline}`);

  if (data.sceneText) {
    lines.push("\nSIDES / SCENE TEXT:");
    lines.push(data.sceneText);
  }

  // ── Modifier suffix ────────────────────────────────────────────────────────
  if (data.spinAgain) {
    let spinInstruction = "\nIMPORTANT INSTRUCTION: Generate a COMPLETELY NEW set of bold acting choices. Every choice must be different from what you might have suggested before. Avoid any idea that feels expected or obvious. Surprise the actor.";
    if (data.previousOutputSummary) {
      spinInstruction += `\n\nAVOID repeating ideas, phrasing, or behavioral patterns from the previous version: ${data.previousOutputSummary}`;
    }
    lines.push(spinInstruction);
  }

  if (data._schemaRetry) {
    lines.push("\nCRITICAL: Your previous response was missing required fields. You MUST include: pov (with summary, mistake, fix), at least 5 choices, at least 2 moments (each with 3 takes labeled A/B/C), references, take2, and coachNote. Return ONLY the JSON object — no markdown fences, no commentary.");
  }

  if (data.modifier === "wilder") {
    lines.push("\nIMPORTANT INSTRUCTION — MAKE IT WILDER: Push every choice further than you normally would. Increase boldness, unpredictability, and specificity. Avoid safe or expected interpretations. These choices should feel almost risky — the kind of choice that either books the role or stands out unforgettably. Do NOT soften anything. The actor is ready to take the risk.");
  }

  if (data.modifier === "take2") {
    lines.push("\nIMPORTANT INSTRUCTION — TAKE 2 FOCUS: Your primary focus for this output should be the take2 array. Generate 3 distinctly different Take 2 strategies — each one must shift a fundamentally different performance element (emotional state, physical starting point, energy level, inner life, tempo). These should feel like completely different actors playing the same scene, not variations of the same idea. Still complete all other sections, but make the Take 2 strategies exceptional.");
  }

  lines.push("\nGenerate the Bold Choices Guide now. Return ONLY valid JSON.");
  return lines.join("\n");
}

// ─── MAIN SERVICE FUNCTION ────────────────────────────────────────────────────
async function generateBoldChoices(data) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const userPrompt = buildUserPrompt(data);

  let messages = [{ role: "user", content: userPrompt }];

  async function callClaude(msgArray) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: DEFAULT_CLAUDE_MAX_TOKENS,
        system: BOLD_CHOICES_SYSTEM_PROMPT,
        messages: msgArray,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    return result.content[0]?.text || "";
  }

  let rawText = await callClaude(messages);
  let cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("[BoldChoices] Failed to parse JSON on first try, attempting retry.");
    messages.push({ role: "assistant", content: rawText });
    messages.push({ role: "user", content: "Return ONLY valid JSON. No commentary." });
    
    rawText = await callClaude(messages);
    cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    
    try {
      parsed = JSON.parse(cleaned);
    } catch (e2) {
      console.error("[BoldChoices] Failed to parse JSON on retry:", cleaned.substring(0, 500));
      throw new Error("Claude returned invalid JSON. Please try again.");
    }
  }

  return parsed;
}

module.exports = { generateBoldChoices };
