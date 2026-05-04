const { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS } = require("../../config/models");
const { sendAnthropicMessage } = require("../../services/anthropicClient");
const { scrubWatermarks } = require("../../services/textCleaner");

const CONTENT_SYSTEM_PROMPT = `You are Corey Ralston creating a Reader101 guide.

Reader101 Rule:
You are not coaching the actor. You are coaching the reader.
If any part of your response describes how the actor should perform, it is wrong.

Return ONLY valid JSON.
Do not return markdown.
Do not return HTML.
Do not wrap the JSON in code fences.

Reader101 is not a general acting lesson.
Reader101 is an actor protection system.
Your job is to stop the reader from ruining THIS specific audition.

You are not teaching performance theory.
You are correcting real-time reader behavior so the actor can go deeper.

Hard rules:
- No generic writing.
- No blog tone.
- No abstract genre talk unless it directly sharpens this exact scene.
- No vague filler like "this scene is emotional" or "the actor needs support."
- Tie every section to the actual sides, quoted lines, and concrete moments.
- If the guide could apply to another audition, it has failed.
- Coach pacing, tone, timing, listening, restraint, presence, and reaction.
- Do NOT coach the reader to build character psychology like an actor.
- Do NOT drift into therapy language or academic analysis.
- Use direct, grounded, occasionally sharp language when needed.
- Use consequence-driven coaching throughout.
- Emotional framing should come before instruction; consequences should follow instruction.

Every bullet must be one line, playable, and immediately usable in a live self-tape.
Use "->" when it sharpens cause and effect.
Do not repeat the same note across sections.
Do not sanitize high-risk material. Keep it grounded and professional.`;

const SCHEMA_TEXT = `{
  "what_will_go_wrong": ["", "", ""],
  "why_it_matters": "",
  "performance_engine": {
    "drive_label": "",
    "drive_text": "",
    "drive_consequence": "",
    "fuel_label": "",
    "fuel_text": "",
    "fuel_consequence": ""
  },
  "scene_snapshot": [
    { "heading": "", "bullets": ["", ""] }
  ],
  "your_job": [""],
  "playing_multiple_characters": [""],
  "reader_fundamentals": [""],
  "key_beats": [""],
  "rhythm": [""],
  "do": [""],
  "avoid": [""],
  "connection": [""],
  "anchor_line": "",
  "tone_reference_anchor": [""],
  "quick_reset": [""],
  "intimacy_section": [],
  "emotional_arc_mapping": []
}`;

// ── Parent Reader Pipeline (6-section, two-pass generation) ───────


function countMeaningfulWords(text = "") {
  return (String(text || "").match(/\b[\w']+\b/g) || []).length;
}

function countDialogueWords(text = "") {
  // Rough count of words that are likely dialogue (exclude sluglines, all-caps headers)
  const lines = String(text || "").split("\n");
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip sluglines (INT./EXT.), all-caps cue headers (CHARACTER NAME), scene directions
    if (/^(INT|EXT)[\.\s]/i.test(trimmed)) continue;
    if (/^[A-Z][A-Z\s\.\(\)]{2,}$/.test(trimmed)) continue; // all-caps header
    count += (trimmed.match(/\b[\w']+\b/g) || []).length;
  }
  return count;
}

function clipText(text = "", maxLength = 14000) {
  const cleaned = String(text || "").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}\n...[truncated]` : cleaned;
}

function collectJsonCandidates(raw = "") {
  const text = String(raw || "");
  const candidates = [];

  for (let start = 0; start < text.length; start += 1) {
    const opening = text[start];
    if (opening !== "{" && opening !== "[") continue;

    const closing = opening === "{" ? "}" : "]";
    const stack = [closing];
    let inString = false;
    let escaped = false;

    for (let i = start + 1; i < text.length; i += 1) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = inString;
        continue;
      }

      if (char === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === "{" || char === "[") {
        stack.push(char === "{" ? "}" : "]");
        continue;
      }

      if (char === "}" || char === "]") {
        if (char !== stack[stack.length - 1]) {
          break;
        }

        stack.pop();

        if (stack.length === 0) {
          candidates.push({
            start,
            end: i + 1,
            text: text.slice(start, i + 1),
          });
          break;
        }
      }
    }
  }

  return candidates.sort((a, b) => {
    if (b.end !== a.end) return b.end - a.end;
    const bLength = b.end - b.start;
    const aLength = a.end - a.start;
    if (bLength !== aLength) return bLength - aLength;
    return b.start - a.start;
  });
}

function parseJsonCandidate(raw = "") {
  const candidates = collectJsonCandidates(raw);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.text);
    } catch (error) {
      // Keep trying candidates; model output often contains JSON examples
      // before the actual payload.
    }
  }

  return null;
}

function parseJsonResponse(text = "") {
  const raw = String(text || "").trim();

  if (!raw) {
    throw new Error("Empty model response");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("[Reader101] generateContent FAILED — attempting recovery. Error:", error.message);
    
    // Try to extract from markdown fences
    const fenceMatches = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
    for (let i = fenceMatches.length - 1; i >= 0; i -= 1) {
      const fenced = fenceMatches[i][1];
      try {
        return JSON.parse(fenced.trim());
      } catch (e) {
        const parsedFence = parseJsonCandidate(fenced);
        if (parsedFence) return parsedFence;
      }
    }

    const parsedCandidate = parseJsonCandidate(raw);
    if (parsedCandidate) return parsedCandidate;

    // If all recovery attempts fail, throw a clear error with the preview
    throw new Error(`Claude returned invalid JSON: ${error.message} (Preview: ${raw.slice(0, 100)})`);
  }
}

function collectStrings(value, bucket = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, bucket));
    return bucket;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, bucket));
    return bucket;
  }

  if (typeof value === "string") {
    bucket.push(value);
  }

  return bucket;
}

function countQuotedReferences(value) {
  return collectStrings(value)
    .map((item) => String(item || ""))
    .filter((item) => /["“”][^"“”]{2,}["“”]|'[^'\n]{3,}'/.test(item))
    .length;
}

function validateStructuredContent(data = {}, meta = {}) {
  const errors = [];
  const isFallback = Boolean(meta.fallbackMode);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["Response must be a JSON object."];
  }

  if (!Array.isArray(data.what_will_go_wrong) || data.what_will_go_wrong.length !== 3) {
    errors.push('"what_will_go_wrong" must be an array of exactly 3 strings.');
  }

  if (!data.why_it_matters || typeof data.why_it_matters !== "string") {
    errors.push('"why_it_matters" must be a string.');
  }

  if (!data.performance_engine || typeof data.performance_engine !== "object") {
    errors.push('"performance_engine" must be an object.');
  }

  const requiredArrays = [
    "scene_snapshot",
    "your_job",
    "playing_multiple_characters",
    "reader_fundamentals",
    "key_beats",
    "rhythm",
    "do",
    "avoid",
    "connection",
    "tone_reference_anchor",
    "quick_reset",
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(data[key]) || !data[key].length) {
      errors.push(`"${key}" must be a non-empty array.`);
    }
  }

  // Strict count requirements — relaxed in fallback mode since there are no real lines to quote
  // Short scenes also can't meet high minimums — count enforcement belongs in the prompt, not here
  if (!isFallback) {
    if (Array.isArray(data.key_beats) && data.key_beats.length < 2) {
      errors.push('"key_beats" must contain at least 2 scene-specific beats.');
    }

    if (Array.isArray(data.do) && data.do.length < 2) {
      errors.push('"do" must contain at least 2 specific actions.');
    }

    if (Array.isArray(data.avoid) && data.avoid.length < 2) {
      errors.push('"avoid" must contain at least 2 specific mistakes.');
    }
  }

  if (!data.anchor_line || typeof data.anchor_line !== "string") {
    errors.push('"anchor_line" must be a string.');
  }

  if (!isFallback) {
    const keyBeatsQuoteCount = countQuotedReferences(data.key_beats);
    if (keyBeatsQuoteCount < 2) {
      errors.push("'key_beats' must contain at least 2 bullets that quote lines of dialogue or stage directions.");
    }

    const quotedReferenceCount = countQuotedReferences([
      data.what_will_go_wrong,
      data.why_it_matters,
      data.performance_engine,
      data.scene_snapshot,
      data.your_job,
      data.key_beats,
      data.connection,
      data.do,
      data.avoid,
    ]);

    if (quotedReferenceCount < 4) {
      errors.push("You must anchor at least 4 specific instructions to exact text from the sides using quotation marks.");
    }
  }

  return errors;
}

function buildContentPrompt(meta = {}, validationFeedback = "") {
  const cleanedSceneText = scrubWatermarks(meta.sceneText || "").trim();
  const sceneWordCount = countMeaningfulWords(cleanedSceneText);
  const flags = Array.isArray(meta.flags) ? meta.flags : [];
  const genreMode = String(meta.genreMode || "drama").toLowerCase();
  const childFocused = Boolean(meta.childFocused);
  const methodologyContext = String(meta.methodologyContext || "").trim();
  const retrievalSignals = meta.retrievalSignals || {};

  const metadataBlock = [
    meta.characterName ? `AUDITION ROLE: ${meta.characterName}` : "",
    meta.readerCharacterName ? `READER ROLE: ${meta.readerCharacterName}` : "",
    Array.isArray(meta.readerCharacterNames) && meta.readerCharacterNames.length
      ? `READER ROLES: ${meta.readerCharacterNames.join(", ")}`
      : "",
    meta.actorAge ? `ACTOR AGE: ${meta.actorAge}` : "",
    meta.productionTitle ? `TITLE: ${meta.productionTitle}` : "",
    meta.productionType ? `FORMAT: ${meta.productionType}` : "",
    meta.genre ? `GENRE: ${meta.genre}` : "",
    meta.storyline ? `STORYLINE: ${meta.storyline}` : "",
    meta.genreMode ? `GENRE MODE: ${meta.genreMode}` : "",
    `CHILD FOCUSED: ${childFocused ? "true" : "false"}`,
    meta.templateStyle ? `TEMPLATE STYLE: ${meta.templateStyle}` : "",
    flags.length ? `FLAGS: ${flags.join(", ")}` : "",
    `FALLBACK MODE: ${meta.fallbackMode ? "true" : "false"}`,
    `MEANINGFUL WORDS: ${sceneWordCount}`,
    meta.structure ? `STRUCTURAL TONE BIAS: ${meta.structure.tone_bias}` : "",
    meta.structure ? `PULSE AND PACE: ${meta.structure.pace}` : "",
    meta.structure ? `SCENE BEATS: ${meta.structure.beat_count}` : "",
    meta.structure ? `INTERRUPTIONS: ${meta.structure.interruption_count}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const dialogueWordCount = countDialogueWords(cleanedSceneText);
  // Short Sides Mode: genuinely short scene with READABLE text.
  // Exclude fallbackMode=true (corrupted/partial PDF) — that's corruption fallback, not short sides.
  const shortSidesMode = dialogueWordCount < 80 && cleanedSceneText.length > 30 && !meta.fallbackMode;

  if (shortSidesMode) {
    console.log(`[Reader101] SHORT_SIDES_MODE: TRUE — ${dialogueWordCount} dialogue words detected`);
  }

  // ── Scene block: ALWAYS include actual text when available ──────────────
  // fallbackMode only adds a reliability note — it NEVER hides the script from Claude.
  // When Claude has no text, guides are generic. Text is better than no text.
  const hasSidesText = cleanedSceneText.length > 50;
  const sceneBlock = hasSidesText
    ? `SIDES TEXT${meta.fallbackMode ? " (PARTIAL EXTRACTION — use what is readable, note gaps)" : ""}:
${clipText(cleanedSceneText)}`
    : `SIDES STATUS: No readable text could be extracted. Base coaching on character name, show title, and genre metadata only. Do NOT invent dialogue or fake quotes.`;

  const methodologyBlock = methodologyContext
    ? `RANKED METHODOLOGY MEMORY (READER101 FILTERED):
${clipText(methodologyContext, 6500)}

RETRIEVAL SIGNALS:
- Primary Archetype: ${retrievalSignals.primaryArchetype || "general"}
- Secondary Archetype: ${retrievalSignals.secondaryArchetype || "none"}
- Hagen Want: ${Array.isArray(retrievalSignals.hagen?.want) ? retrievalSignals.hagen.want.join(" | ") || "not clear" : "not clear"}
- Hagen Obstacle: ${Array.isArray(retrievalSignals.hagen?.obstacle) ? retrievalSignals.hagen.obstacle.join(" | ") || "not clear" : "not clear"}
- Hagen Tactics: ${Array.isArray(retrievalSignals.hagen?.tactics) ? retrievalSignals.hagen.tactics.join(" | ") || "not clear" : "not clear"}
`
    : `RANKED METHODOLOGY MEMORY:
- No retrieval chunks available. Stay script-faithful and role-locked.`;

  const highRiskRules = flags.includes("high_risk")
    ? `HIGH-RISK RULES:
- Disable comedic framing.
- Force grounded realism.
- Increase consequence density.
- Fill "intimacy_section" with reader-facing directives only.
- Fill "emotional_arc_mapping" with shift-based action -> consequence bullets.
- The emotional progression is critical: curiosity -> participation -> awareness -> shame.
- If foster_style_scene is present, weight shame, stillness, neutrality, and containment heavily.`
    : `HIGH-RISK RULES:
- If the scene is not high-risk, return empty arrays for "intimacy_section" and "emotional_arc_mapping".`;

  const roleLockBlock = `ROLE LOCK — READER101 VS PREP101:
- You are operating in Reader101 mode, not Prep101.
- Prep101 builds the performance. Reader101 protects it.
- Reader101 does not generate performance; it removes obstacles to performance.
- DO NOT analyze character psychology in depth.
- DO NOT provide actor-focused technique.
- DO NOT explain internal motivations beyond what is playable for the reader.
- DO focus on timing, delivery, interaction, and reader restraint.
- If output starts resembling actor coaching, STOP and redirect to reader behavior.`;

  const genreModeBlock = `GENRE MODE SYSTEM:
Active mode: ${genreMode}

DRAMA MODE (default):
- Slower pacing, silence/load-bearing beats, reader as container.

MULTI-CAM MODE (strict):
- Fast pacing, reversals, reader as grounded contrast.
- No joke signaling, no cushioning, no early reactions.

SINGLE-CAM COMEDY:
- Natural pace with subtle reversals.
- Reader can be slightly more reactive than multi-cam, still no joke signaling.

THRILLER / HORROR:
- Reader is pressure source.
- Tension over warmth, loaded silence, no emotional cushioning.

TEEN DRAMA:
- Reader can mirror emotionally in a controlled way.
- Keep stakes large but avoid melodrama.

CHILD-FOCUSED CONTENT:
- Protect the performance without patronizing language.
- Do not artificially slow pacing.
- Treat the actor as capable and specific.

Apply the active mode as the behavior override before tone/style choices.`;

  const priorityStack = `PRIORITY ORDER (MANDATORY):
1) SCRIPT REALITY (what actually happens)
2) GENRE MODE RULES
3) READER FUNCTION
4) TONE / STYLE

Never invert this order.`;

  const ACTOR_ROLE = meta.characterName ? meta.characterName.trim() : "the actor";
  const guardrail = `
ACTOR ROLE: ${ACTOR_ROLE}

You are generating a Reader101 guide.

The reader is NOT playing the actor role.

Do NOT:
- give direction for ${ACTOR_ROLE}'s performance
- describe how ${ACTOR_ROLE} should act
- analyze ${ACTOR_ROLE} as if the reader is performing them

You are ONLY coaching the reader on how to support ${ACTOR_ROLE}.

INTERNAL TRANSLATION RULE (MANDATORY):
Before outputting any instruction, convert ALL actor insight into reader responsibility.
If you think: "${ACTOR_ROLE} needs resistance to play this scene"
It MUST be rewritten as: "If you soften here, ${ACTOR_ROLE} loses the resistance they need."
If you think: "${ACTOR_ROLE} should play this angry"
It MUST be rewritten as: "Do not pacify the scene; your coldness gives ${ACTOR_ROLE} the necessary wall to hit."

Prep101 asks: "What should the actor do?"
Reader101 asks: "What must the reader NOT mess up?"
Everything you write must answer the second question.
`;

  const shortSidesBlock = shortSidesMode
    ? `\nSHORT SIDES MODE — ACTIVE (${dialogueWordCount} dialogue words detected)\n\n⚡ This guide must prioritize precision over volume. Every beat matters more when there are fewer of them.\n\nADAPTATIONS:\n- KEY BEATS: Use every quotable line exactly once. Stage directions are quotable — treat them as anchors. If only 2 lines are quotable, the section gets 2 bullets. Do NOT pad to hit a count.\n- SCENE SNAPSHOT: Collapse to a single "Scene in One Line" per scene. Do not use a multi-row grid format.\n- YOUR JOB: This is the load-bearing section for short sides. Expand it. Every cue is a setup the actor must land on.\n- PLAYING MULTIPLE CHARACTERS: Only include if both reader characters appear. Name them and their scene function specifically.\n- DO NOT generate filler bullets to fill section shapes. Missing beats are invisible. Generic beats are lies.\n`
    : "";

  const citationRule = hasSidesText
    ? `- CITATION RULE: Every bullet in Key Beats, Your Job, and Scene Snapshot MUST open with a direct quote from the sides in quotation marks. Stage directions count as quotes. No quote = no bullet. If you cannot find a line to anchor the directive, omit the bullet entirely. Do NOT pad with generic advice to hit a count.\n- ANCHOR QUOTES (extracted from sides — use these as your primary citation sources):\n${meta.anchorQuotes && meta.anchorQuotes.length > 0 ? meta.anchorQuotes.map(q => `  • "${q}"`).join("\n") : "  (No pre-extracted anchors — mine the sides text directly for quotable lines.)"}\n- INVISIBLY GENERIC TEST: Before including any bullet, ask — could this appear in a guide for a completely different show? If yes, rewrite it with a specific quote or delete it.\n- TWO-CHARACTER CONTRAST RULE: If there are two reader characters, name both with one specific line or beat each showing their difference in pressure, status, or function. Required format: "[Char A] ([scene/pg]): [status/function anchored to a line]. [Char B] ([scene/pg]): [status/function anchored to a different line]. If they feel the same, the audition dies instantly." Generic labels without cited moments are not permitted.`
    : `- CITATION RULE: No readable sides available. Do NOT invent quotes. Use character names and show context only.`;

  const userPrompt = `Generate structured Reader101 content for the fixed HTML template system.

Return ONLY valid JSON that matches this schema exactly:
${SCHEMA_TEXT}

Global rules:
- SCRIPT-FAITHFUL CHARACTER RULE:
  - Use only character names that explicitly appear in the provided sides/metadata.
  - Do NOT infer, rename, relabel, or invent placeholder roles.
  - If a role is unclear, reference it exactly as written in the script.
- EXTRACTION-FIRST RULE:
  - Before writing coaching, internally extract the real speaking roles and beat sequence from the sides.
  - If speaker roles are unclear, do not invent structure; stay literal and use exact script labeling only.
- Coach the reader on how to read the READER ROLE opposite the AUDITION ROLE.
- Never instruct the reader to "play" or read lines for the AUDITION ROLE under ANY circumstances.
- The reader's job is solely to support the actor who is playing the AUDITION ROLE.
- If READER ROLE is present, treat that as the reader's character assignment throughout.
- If READER ROLES is empty or missing, actively infer the scene partner(s) from the dialogue text. The reader plays EVERY speaking role EXCEPT the AUDITION ROLE.
- If READER ROLES lists more than one role, coach all counterpart roles and contrast them clearly.
- Any character-specific vocal, physical, or behavioral note must refer to the READER ROLE, never the AUDITION ROLE.
- The product is: how to not destroy THIS specific audition.
- Every list item must be one line.
- Every list item must be a physical, vocal, timing, listening, or restraint directive.
- Use plain, exact reader coaching. Not theory.
- SCENE SNAPSHOT RULE: ${shortSidesMode ? 'SHORT SIDES MODE — collapse to one Scene in One Line per scene (location, reader character, scene temperature, actor arc). No grid format.' : `Generate one row per scene in the sides. Each row must include: location (from slugline), reader character(s), scene temperature, ${ACTOR_ROLE}'s arc in that scene. Writing about "the world" or "the show" is not a scene snapshot.`}
- PLAYING MULTIPLE CHARACTERS RULE: Name every reader character explicitly. Each named character requires: one register description anchored to a specific moment in the sides, and one contrast line naming what is different about their pressure, status, or function from the other reader character. Generic descriptions without a cited beat are not permitted.
- CONSEQUENCE RULE: The following consequence phrases are BANNED: "the emotional turn disappears", "the scene loses its pulse", "the actor feels the drop immediately", "the scene drifts off target", "the high-risk turn collapses". Every consequence must name what specifically breaks in THIS scene.
- SPECIFICITY CHECK — run before finalizing output: For every directive, ask: could this bullet appear in a guide for a completely different show with different characters? If yes: rewrite with a cited line or delete it.
- KEY BEATS RULE: Use only lines you can anchor to the actual sides. If sides are short, generate only anchored beats — do NOT pad to reach any minimum. Each anchored beat must contain: a quoted line, one physical directive, one specific consequence.
- "what_will_go_wrong" must contain exactly 3 bullets identifying precise failure points plus consequences specific to THIS scene.
- "why_it_matters" must explain the actor's specific problem using the actual dynamics in these sides, not genre summary.
- "performance_engine.drive_*" is Push (Reader's Function): the specific resistance or pressure the reader provides in THIS scene.
- "performance_engine.fuel_*" is Pull (Actor's Need): what the actor reaches for and how the reader protects or destroys it.
- "your_job" must be moment-based. ${shortSidesMode ? 'SHORT SIDES: this is the load-bearing section — expand it. Every reader line is a setup the actor must land on. Be specific about each one.' : 'Quote the actual line first, then correct the wrong instinct, then provide the right move.'}
- "reader_fundamentals" must be practical, scene-relevant reader rules — include as many as the sides support. Do NOT pad to hit a number.
- "rhythm" must cover cadence, punctuation, interruptions, pauses, volume, containment, and energy shifts specific to THIS scene.
- "do" and "avoid" must be concrete and scene-specific. Quote the line or moment first.
- "connection" must explain where the actor depends on the reader and how the specific moment dies if mishandled.
- "tone_reference_anchor" must anchor emotional texture to precise scene truth, not generic genre explanation.
- "quick_reset" should feel like live self-tape rescue notes for THIS specific scene.
- Emotional framing before instruction. Consequences after instruction.

${citationRule}
${shortSidesBlock}
${highRiskRules}
${roleLockBlock}
${genreModeBlock}
${priorityStack}

${genreMode === "multicam"
    ? `FORMAT OVERRIDE — MULTI-CAMERA SITCOM (STRICT MODE):
If this is multi-camera/sitcom/audience-laughter material, these rules override defaults:

1) COMEDY ENGINE DEFINITION (NON-NEGOTIABLE)
- Structure is escalation -> reversal -> escalation -> reversal.
- Do NOT reframe this as slow emotional arc analysis.
- Comedy comes from contrast + timing + commitment.

2) READER FUNCTION (CORRECTED)
- Reader is NOT indifferent, cold, or a wall.
- Reader is engaged, present, and one beat behind.
- Stay grounded while the actor escalates.
- If the reader is a parent/caregiver role, they care but cannot keep up.

3) TIMING LAW (CRITICAL)
- Every turn must land on the reader before response.
- Do NOT react early, anticipate, or cushion.
- If reader gets there first, the joke disappears and the scene collapses.

4) ENERGY CONTRAST RULE
- Do NOT match actor energy.
- Actor escalates; reader stays grounded.
- If energy matches, contrast disappears and comedy dies.

5) NO JOKE SIGNALING RULE
- Never smile through lines, soften into punchlines, or indicate "this is funny."
- If you signal the joke, you kill the joke.

6) PACING RULE (MULTI-CAM SPECIFIC)
- Keep exchanges quick with minimal dead air.
- Do NOT add thoughtful pauses unless text demands it.
- Speed supports comedy; slowing down kills it.

7) SCRIPT REALITY ENFORCEMENT (ANTI-HALLUCINATION)
- ONLY use character names explicitly in the sides.
- NEVER invent roles, labels, or placeholders.
- NEVER reinterpret character structure.

8) COMEDY-SAFE INTERPRETATION RULE
- Do NOT impose shame arcs, trauma framing, or extra psychological depth not supported by the script.
- Prioritize: what is happening, how fast it changes, and how reader timing supports turns.

9) CONSEQUENCE LANGUAGE (MANDATORY STYLE)
- Use hard-stakes language: "the scene dies", "the joke disappears", "the moment collapses", "casting checks out."
- Avoid soft phrasing.

10) CORE REFRAME
- The reader is the normal world.
- The actor is the disruption.

11) ONE-LINE TRUTH
- Reinforce this idea directly: "The reader stays real so the actor can be funny."`
    : ""}

METADATA:
${metadataBlock}

${sceneBlock}
${methodologyBlock}

${validationFeedback ? `REVISION FEEDBACK:\n${validationFeedback}\n` : ""}

${hasSidesText ? `CONFIRMATION — log internally before generating: "I have read the sides. The character ${meta.readerCharacterName || 'the reader character'} appears in the following lines: [list them]. I will anchor my coaching to these specific lines and no others."` : ""}

Return the JSON object now.`;

  return guardrail + "\n\n" + userPrompt;
}

function invalidReaderOutput(output, actorRole) {
  if (!output || !actorRole) return false;
  const lower = String(output).toLowerCase();
  const role = String(actorRole).toLowerCase().trim();

  return (
    lower.includes(`play ${role}`) ||
    lower.includes(`${role} should`) ||
    lower.includes(`for ${role}'s performance`) ||
    lower.includes(`the actor playing ${role}`)
  );
}

async function callAnthropic(prompt, apiKey, signal) {
  const { data: payload, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel: DEFAULT_CLAUDE_MODEL,
    maxTokens: Math.min(DEFAULT_CLAUDE_MAX_TOKENS, 3500),
    system: CONTENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    signal,
  });

  const text = payload?.content?.[0]?.text;

  if (!text) {
    throw new Error("Anthropic returned no text content.");
  }

  if (model !== DEFAULT_CLAUDE_MODEL) {
    console.warn(
      `[Reader101] Used fallback model ${model} (primary ${DEFAULT_CLAUDE_MODEL} unavailable)`
    );
  }

  return text;
}

async function extractAnchorQuotes(sceneText, meta, apiKey, signal) {
  // Lightweight pre-pass: extract quotable lines from the sides before main generation.
  // These become the ANCHOR QUOTES injected into the main prompt.
  if (!sceneText || sceneText.length < 100) return [];

  const actorRole = (meta.characterName || "").trim();
  const readerRoles = Array.isArray(meta.readerCharacterNames)
    ? meta.readerCharacterNames.join(", ")
    : (meta.readerCharacterName || "");

  const anchorPrompt = `You are extracting quotable lines from a screenplay for a reader coaching guide.

AUDITION ROLE (actor's character): ${actorRole}
READER ROLE(S) (what the reader reads): ${readerRoles || "all other characters"}

SIDES TEXT:
${clipText(sceneText, 8000)}

Task: Extract 8-15 directly quotable lines of dialogue OR stage directions from the sides above.
- Include lines spoken by ALL characters (both ${actorRole} and reader characters).
- Include action lines that describe key physical beats (e.g. "crosses to the door").
- Return ONLY a JSON array of strings. No explanation. No markdown.
- Each string must be an exact quote from the text above.
- Do NOT invent or paraphrase. Copy the line verbatim.
- If fewer than 4 quotable lines exist, return only what is there.

Example output format: ["line one", "line two", "line three"]

Return the JSON array now.`;

  try {
    const { data: payload } = await sendAnthropicMessage({
      apiKey,
      preferredModel: DEFAULT_CLAUDE_MODEL,
      maxTokens: 800,
      system: "You extract exact quotes from screenplay text. Return only a JSON array of strings.",
      messages: [{ role: "user", content: anchorPrompt }],
      signal,
    });

    const text = payload?.content?.[0]?.text || "";
    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");
    if (firstBracket === -1 || lastBracket === -1) return [];

    const parsed = JSON.parse(text.slice(firstBracket, lastBracket + 1));
    if (!Array.isArray(parsed)) return [];

    const quotes = parsed.filter(q => typeof q === "string" && q.trim().length > 3);
    if (quotes.length === 0) {
      console.error("[Reader101] ANCHOR_QUOTES: FAILED — pre-pass returned empty array. Main generation will proceed without anchor quotes.");
    } else {
      console.log(`[Reader101] ANCHOR_QUOTES: ${quotes.length} extracted — ${quotes.slice(0, 3).map(q => `"${q.slice(0, 40)}"`).join(", ")}...`);
    }
    return quotes;
  } catch (err) {
    console.error("[Reader101] ANCHOR_QUOTES: FAILED —", err.message);
    return [];
  }
}

async function generateContent(meta = {}, options = {}) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
  const signal = options.signal;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // ── Parent Reader mode \u2014 completely different schema + prompt ──────────────
  if (meta.parentReaderMode) {
    return generateParentContent(meta, { apiKey, signal });
  }

  let validationFeedback = "";
  let lastError = null;

  // \u2500\u2500 Anchor quote pre-pass \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Extract quotable lines from the sides before main generation.
  // Injected into the prompt as ANCHOR QUOTES to prevent generic output.
  const cleanedForAnchor = scrubWatermarks(meta.sceneText || "").trim();
  if (cleanedForAnchor.length > 100 && !meta.anchorQuotes) {
    const extracted = await extractAnchorQuotes(cleanedForAnchor, meta, apiKey, signal);
    if (!extracted.length) {
      console.error("[Reader101] ANCHOR_QUOTES: NONE \u2014 proceeding without anchor quotes. Expect higher generic output risk.");
    }
    meta = { ...meta, anchorQuotes: extracted };
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const prompt = buildContentPrompt(meta, validationFeedback);
      const rawText = await callAnthropic(prompt, apiKey, signal);
      const parsed = parseJsonResponse(rawText);
      const errors = validateStructuredContent(parsed, meta);

      const ACTOR_ROLE = meta.characterName ? meta.characterName.trim() : "";
      if (ACTOR_ROLE && invalidReaderOutput(rawText, ACTOR_ROLE)) {
        errors.push("You incorrectly gave actor coaching. Fix it. You are ONLY coaching the reader.");
      }

      if (errors.length) {
        lastError = new Error(errors.join(" "));
        validationFeedback = errors.map((error) => `- ${error}`).join("\n");

        if (attempt < 2) {
          continue;
        }
      }

      return parsed;
    } catch (error) {
      lastError = error;

      if (attempt < 2) {
        validationFeedback = `- The previous response failed validation or JSON parsing.\n- ${error.message}`;
        continue;
      }
    }
  }

  throw lastError || new Error("Failed to generate structured Reader101 content");
}

// \u2500\u2500 Parent Reader Card generation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

// ─── Parent Reader Card generation ──────────────────────────────────────────────

async function generateParentContent(meta = {}, { apiKey, signal }) {
  console.log("[Reader101] PARENT_READER_MODE: Pass 1 — Extract raw facts");

  const actorName = (meta.characterName || "").trim();
  const readerRoles = Array.isArray(meta.characterNames) && meta.characterNames.length
    ? meta.characterNames.join(", ")
    : (meta.readerCharacterName || "all other characters");
  const cleanedText = scrubWatermarks(meta.sceneText || "").trim();

  const pass1Prompt = `Extract raw facts from the scene. NO style. NO interpretation. Just raw facts.
AUDITION ROLE (actor): ${actorName || "the actor"}
READER ROLE(S): ${readerRoles}

SIDES TEXT:
${clipText(cleanedText, 8000)}

Return ONLY valid JSON matching exactly:
{
  "scene_summary": "string, 2 sentences max. Describes what happens literally.",
  "reader_characters": ["char1", "char2"],
  "lines": ["char: exact line text", "char: exact line text"],
  "pauses": ["exact moment to pause 1", "exact moment to pause 2"]
}`;

  const { data: pass1Payload } = await sendAnthropicMessage({
    apiKey,
    preferredModel: DEFAULT_CLAUDE_MODEL,
    maxTokens: 1500,
    system: "You are a data extractor. Return only valid JSON. No explanations. No styling.",
    messages: [{ role: "user", content: pass1Prompt }],
    signal,
  });

  const pass1Raw = pass1Payload?.content?.[0]?.text || "";
  const facts = parseJsonResponse(pass1Raw);

  console.log("[Reader101] PARENT_READER_MODE: Pass 2 — Format (Generating 6 sections independently)");

  const generateSection = async (sectionPrompt, maxTokens = 500) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { data: payload } = await sendAnthropicMessage({
          apiKey,
          preferredModel: DEFAULT_CLAUDE_MODEL,
          maxTokens,
          system: "You are formatting a specific section of a Reader Parent Card. Return ONLY valid JSON matching the requested schema. No markdown code blocks. No preamble. Do NOT echo back the raw facts. If a parent cannot DO this within 10 seconds, delete it.",
          messages: [{ role: "user", content: sectionPrompt + "\n\n<context>\nRAW FACTS:\n" + JSON.stringify(facts, null, 2) + "\n</context>\n\nOUTPUT ONLY THE JSON OBJECT." }],
          signal,
        });
        
        let text = payload?.content?.[0]?.text || "";
        if (text.trim().startsWith("```json")) {
          text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (text.trim().startsWith("```")) {
          text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        
        return parseJsonResponse(text);
      } catch (err) {
        if (attempt === 2) throw err;
        console.warn("[Reader101] Parent Card section validation failed, retrying:", err.message);
      }
    }
  };

  const p1 = generateSection(`01 — WHAT'S HAPPENING
Write 2 sentences max.
Describe only what happens.
No emotions. No acting language.
Write like a casual text message.
If you use abstract words -> rewrite.
Return JSON: { "whats_happening": "string" }`, 300);

  const p2 = generateSection(`02 — WHO YOU'RE PLAYING
List reader characters only.
Format: NAME — description
Max 8 words after dash.
No adjectives describing emotion.
No acting terms.
Return JSON: { "who_youre_playing": ["NAME — description", ...] }`, 300);

  const p3 = generateSection(`03 — HOW TO SAY IT
Select up to 5 key lines for the reader.
For each: "first few words" — physical instruction
Allowed words only: flat, fast, slow, quiet, loud, no smile, straight face, look, stop, lean in, look away
If instruction cannot be done in 3 seconds -> delete.
Return JSON: { "how_to_say_it": ["\\"first few words\\" — instruction", ...] }`, 400);

  const p4 = generateSection(`04 — PAUSE HERE
List exact pause moments.
Format: After "line" — wait.
Max 5 bullets.
No explanation.
Return JSON: { "pause_here": ["After \\"line\\" — wait.", ...] }`, 400);

  const p5 = generateSection(`05 — DON'T DO THIS
Write ONE sentence.
Name the most likely parent mistake.
Must be specific to THIS scene.
Return JSON: { "dont_do_this": "string" }`, 200);

  const p6 = generateSection(`06 — IF IT GOES WRONG
Write exactly 2 bullets.
Each under 10 words.
Must be direct actions: restart, point, pause, repeat, etc.
No explanation.
Return JSON: { "if_it_goes_wrong": ["action 1", "action 2"] }`, 200);

  const [s1, s2, s3, s4, s5, s6] = await Promise.all([p1, p2, p3, p4, p5, p6]);

  return {
    whats_happening: s1.whats_happening || "",
    who_youre_playing: s2.who_youre_playing || [],
    how_to_say_it: s3.how_to_say_it || [],
    pause_here: s4.pause_here || [],
    dont_do_this: s5.dont_do_this || "",
    if_it_goes_wrong: s6.if_it_goes_wrong || []
  };
}

module.exports = {
  buildContentPrompt,
  generateContent,
  generateParentContent,
  parseJsonResponse,
  validateStructuredContent,
};
