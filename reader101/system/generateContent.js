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

function countMeaningfulWords(text = "") {
  return (String(text || "").match(/\b[\w']+\b/g) || []).length;
}

function clipText(text = "", maxLength = 14000) {
  const cleaned = String(text || "").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}\n...[truncated]` : cleaned;
}

function parseJsonResponse(text = "") {
  const raw = String(text || "").trim();

  if (!raw) {
    throw new Error("Empty model response");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    }

    throw error;
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

  if (Array.isArray(data.reader_fundamentals) && data.reader_fundamentals.length !== 10) {
    errors.push('"reader_fundamentals" must contain exactly 10 scene-specific rules.');
  }

  if (Array.isArray(data.key_beats) && data.key_beats.length < 6) {
    errors.push('"key_beats" must contain at least 6 scene-specific beats.');
  }

  if (Array.isArray(data.do) && (data.do.length < 4 || data.do.length > 6)) {
    errors.push('"do" must contain 4 to 6 specific actions.');
  }

  if (Array.isArray(data.avoid) && (data.avoid.length < 4 || data.avoid.length > 6)) {
    errors.push('"avoid" must contain 4 to 6 specific mistakes.');
  }

  if (Array.isArray(data.quick_reset) && (data.quick_reset.length < 3 || data.quick_reset.length > 4)) {
    errors.push('"quick_reset" must contain 3 to 4 concise reset bullets.');
  }

  if (!data.anchor_line || typeof data.anchor_line !== "string") {
    errors.push('"anchor_line" must be a string.');
  }

  if (!meta.fallbackMode) {
    const quotedReferenceCount = countQuotedReferences([
      data.what_will_go_wrong,
      data.why_it_matters,
      data.performance_engine,
      data.scene_snapshot,
      data.your_job,
      data.key_beats,
      data.connection,
      data.tone_reference_anchor,
      data.quick_reset,
    ]);

    if (quotedReferenceCount < 6) {
      errors.push("At least 6 notes must anchor to real quoted lines or phrases from the sides.");
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

  const sceneBlock = meta.fallbackMode
    ? `SIDES STATUS:
- Treat the extracted sides as partial or unreliable.
- Use only clean metadata and any obviously readable story cues.
- Do not invent exact dialogue or fake line-specific beats.`
    : `READABLE SIDES:
${clipText(cleanedSceneText || "[No readable sides provided]")}`;

  const methodologyBlock = methodologyContext
    ? `RANKED METHODOLOGY MEMORY (READER101 FILTERED):
${clipText(methodologyContext, 18000)}

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
`;

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
- Every section must tie back to the actual dialogue, exact beats, and emotional mechanics of this script.
- Quote real lines or short phrases from the sides naturally throughout the guide.
- "what_will_go_wrong" must contain exactly 3 bullets and each bullet must identify a precise failure point plus consequence.
- End "what_will_go_wrong" with the understanding that if these happen, the audition does not land.
- "why_it_matters" must explain the actor's internal problem in plain truth, not genre summary.
- "performance_engine.drive_*" is Push (Reader's Function): the resistance, pressure, or container the reader provides.
- "performance_engine.fuel_*" is Pull (Actor's Need): what the actor is reaching for emotionally and how the reader either protects or destroys it.
- "scene_snapshot" must stay tight and specific: setting, progression, turn, what changes.
- "your_job" must be moment-based, quote actual lines, and correct the wrong instinct before the right move.
- "playing_multiple_characters" must contrast the reader roles clearly, or if there is only one reader role, define the internal register shift inside that one role.
- "reader_fundamentals" must contain exactly 10 practical, scene-relevant reader rules.
- "key_beats" must contain at least 6 specific beats, and most should quote lines.
- "rhythm" must cover how to read this scene: cadence, punctuation, interruptions, pauses, volume, containment, and energy shifts.
- "do" and "avoid" must be concrete and scene-specific, never generic.
- "connection" must explain where the actor depends on the reader and how the moment dies if the reader mishandles it.
- "tone_reference_anchor" must start with consequence framing and then anchor the emotional texture to precise comps or scene truth, not generic genre explanation.
- "quick_reset" must be 3 to 4 bullets max and should feel like live self-tape rescue notes.
- Emotional framing should come before instruction. Consequences should follow instruction.
- Prefer direct lines from the sides whenever readable.
- If fallback mode is true, stay useful without pretending you saw clean lines.

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

async function callAnthropic(prompt, apiKey) {
  const { data: payload, model } = await sendAnthropicMessage({
    apiKey,
    preferredModel: DEFAULT_CLAUDE_MODEL,
    maxTokens: Math.min(DEFAULT_CLAUDE_MAX_TOKENS, 3500),
    system: CONTENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
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

async function generateContent(meta = {}) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  let validationFeedback = "";
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const prompt = buildContentPrompt(meta, validationFeedback);
      const rawText = await callAnthropic(prompt, apiKey);
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

module.exports = {
  buildContentPrompt,
  generateContent,
  validateStructuredContent,
};
