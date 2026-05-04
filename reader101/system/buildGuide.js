const path = require("path");
const { generateContent } = require("./generateContent");
const { selectTemplate } = require("./selectTemplate");
const { renderTemplate } = require("./renderTemplate");
const { retrieveMethodologyContext } = require("../../services/methodologyRetrieval");

function normalizeLine(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items = []) {
  return [...new Set(items.map((item) => normalizeLine(item)).filter(Boolean))];
}

function hasAny(text = "", needles = []) {
  const normalized = normalizeLine(text).toLowerCase();
  return needles.some((needle) => normalized.includes(String(needle).toLowerCase()));
}

function ensureActionConsequence(line, fallbackConsequence) {
  const normalized = normalizeLine(line);

  if (!normalized) {
    return fallbackConsequence;
  }

  if (/(->|→|If you|This kills|falls apart|kills the audition|you lose)/i.test(normalized)) {
    return normalized;
  }

  return `${normalized} -> ${fallbackConsequence}`;
}

function normalizeArraySection(items, fallbackItems, fallbackConsequence, maxItems) {
  const source = Array.isArray(items) && items.length ? items : fallbackItems;
  const cleaned = unique(source).map((item) => ensureActionConsequence(item, fallbackConsequence));
  return cleaned.slice(0, maxItems);
}

function defaultToneLine(style) {
  switch (style) {
    case "multicam":
      return "If you signal jokes or flatten contrast, the scene dies immediately -> grounded timing is the whole engine.";
    case "prestige":
      return "If you play this like melodrama, it falls apart immediately -> restraint is what makes the scene land.";
    case "dark":
      return "If you flinch from the material, it falls apart immediately -> neutrality keeps the scene playable.";
    default:
      return "If you play this like lightweight filler, it falls apart immediately -> the stakes have to feel real.";
  }
}

function buildFallbackContent(meta = {}) {
  const auditionRole = normalizeLine(meta.characterName || "the actor");
  const readerRoleSummary = normalizeLine(
    meta.displayReaderCharacterName ||
      meta.readerCharacterName ||
      "the scene partner"
  );
  const title = normalizeLine(meta.productionTitle || "the project");
  const genre = normalizeLine(meta.genre || "the material");
  const highRisk = Boolean(meta.highRiskScene);
  const comedyMode = Boolean(meta.comedyMode) && !highRisk;

  return {
    what_will_go_wrong: highRisk
      ? [
          "Pull back because the material feels uncomfortable -> the actor loses the danger in the scene.",
          "Rush the intimate turns -> the emotional arc collapses before it lands.",
          "Judge the behavior instead of grounding it -> the scene stops being playable.",
        ]
      : comedyMode
        ? [
            "Play the counterpart as flat or dead -> the actor loses contrast and the scene collapses.",
            "React early or signal punchlines -> reversals stop landing and timing dies.",
            "Match the actor's swings instead of staying grounded -> the comedic engine disappears.",
          ]
      : [
          "Read like a placeholder -> the actor ends up doing all the scene work alone.",
          "Flatten the stakes -> the turn never arrives when it needs to.",
          "Chase personality instead of behavior -> the tone drifts and the scene loses shape.",
        ],
    why_it_matters: `${auditionRole} can only fight for something real if the reader gives the scene weight, pressure, and timing through ${readerRoleSummary}. In ${title}, the reader is not background noise. The reader is the thing the actor is responding to, pushing against, and revealing themselves around.`,
    performance_engine: {
      drive_label: highRisk ? "Scene Risk" : comedyMode ? "Comedy Engine" : "Scene Drive",
      drive_text: highRisk
        ? `The scene is tracking exposure, containment, and the cost of staying in the moment inside ${genre}.`
        : comedyMode
          ? "The scene runs on fast reversals and sincere emotional pivots, not joke performance."
        : `The scene is tracking pressure, resistance, and how hard ${auditionRole} has to work to stay in control.`,
      drive_consequence: highRisk
        ? "If you sanitize the behavior, the psychological turn disappears."
        : comedyMode
          ? "If you flatten or anticipate the turns, the comedy has nowhere to land."
        : "If you flatten the resistance, the actor loses the scene's engine.",
      fuel_label: highRisk ? "Reader Lock" : comedyMode ? "Reader Grounding" : "Reader Fuel",
      fuel_text: highRisk
        ? "Stay vocally neutral, hold stillness, and keep your cues grounded in behavior instead of performance."
        : comedyMode
          ? "Stay one beat behind, receive each pivot as new, and let the actor swing without cushioning."
        : "Keep cues grounded, specific, and responsive so the actor has something clean to play against.",
      fuel_consequence: highRisk
        ? "If you perform around the discomfort, the scene protects itself instead of opening up."
        : comedyMode
          ? "If you perform the comedy instead of grounding it, the actor starts playing alone."
        : "If you get decorative, the scene starts sounding acted instead of lived.",
    },
    scene_snapshot: highRisk
      ? [
          {
            heading: "Build",
            bullets: [
              "Start contained and observational -> early pressure has to feel quiet before it sharpens.",
              "Treat every cue as loaded behavior -> spectacle will cheapen the turn immediately.",
            ],
          },
          {
            heading: "Exposure",
            bullets: [
              "Let the scene breathe when the behavior crosses the line -> rushing erases the reveal.",
              "Hold the actor in real time -> they need space to register what just happened.",
            ],
          },
          {
            heading: "Shame / Exit",
            bullets: [
              "Track the pullback into shame -> that pivot is the scene.",
              "Do not rescue the moment -> containment is what makes the aftermath land.",
            ],
          },
        ]
      : comedyMode
        ? [
            {
              heading: "Escalation",
              bullets: [
                "Treat each new event as fully real in the moment -> sincerity is what makes reversals funny.",
                "Let the actor's first swing land before responding -> early reactions blunt the turn.",
              ],
            },
            {
              heading: "Reversal",
              bullets: [
                "Do not smooth the pivot from disaster to triumph -> the hard switch is the scene.",
                "Keep delivery grounded and plain -> punchline signaling kills the mechanic.",
              ],
            },
            {
              heading: "Button",
              bullets: [
                "Land your factual line cleanly and stop -> the actor needs the final beat.",
                "Stay one beat behind through the close -> that delay makes the ending land.",
              ],
            },
          ]
      : [
          {
            heading: "Setup",
            bullets: [
              "Open with clean pressure -> the actor needs a live situation immediately.",
              "Keep your lines pointed at the objective -> generic cueing softens the launch.",
            ],
          },
          {
            heading: "Push / Pull",
            bullets: [
              "Escalate when the scene asks for resistance -> the actor needs something to push against.",
              "Let the timing tighten before the turn -> if the rhythm drifts, the beat evaporates.",
            ],
          },
          {
            heading: "Turn",
            bullets: [
              "Honor the quiet turn or reveal -> that is where the audition usually wins or dies.",
              "Land the final cue simply -> overplaying the button steals the actor's ending.",
            ],
          },
        ],
    your_job: [
      "Do not read like a placeholder -> give the actor a real obstacle to work against.",
      comedyMode
        ? "Keep every cue grounded and sincere -> performative comedy flattens reversals immediately."
        : "Keep every cue grounded in behavior -> style without stakes weakens the scene immediately.",
      "Stay present through silences -> dead air steals the actor's turn.",
    ],
    playing_multiple_characters: [
      "Reset your voice, pace, and point of view between roles -> blurred switches flatten the scene.",
      "If the two reader roles feel the same, the audition dies instantly.",
      "Change the pressure, not the gimmick -> clean contrast beats over-performed differentiation every time.",
    ],
    reader_fundamentals: [
      `Read ${readerRoleSummary} with the line that is happening now -> reading ahead makes you sound like a cue machine.`,
      "Support silence instead of filling it -> many turns land in the beat before the next line.",
      comedyMode
        ? "Stay one beat behind each pivot -> reacting early kills the comedic turn."
        : "Keep energy through the end of the line -> dropping off early makes the actor pull back.",
    ],
    key_beats: [
      comedyMode
        ? "Play the first catastrophe as fully real -> if you wink, the scene loses reality."
        : "Hit the first escalation cleanly -> if you blur the turn, the actor misses the ramp.",
      comedyMode
        ? "Do not pre-react to the reversal -> the actor needs the switch to land on you."
        : "Honor the reveal beat with space -> rushing it kills the emotional shift.",
      "Land the final cue without commentary -> the actor needs the last word to stay alive.",
    ],
    rhythm: [
      comedyMode
        ? "Keep pace clean and conversational -> forced setup-punchline rhythm ruins the scene."
        : "Let fast scenes stay tight -> extra air drains the momentum out of the exchange.",
      "Let quiet scenes settle before the response -> stepping on the turn kills the depth.",
      comedyMode
        ? "Use hard cuts and quick pivots as written -> smoothing transitions kills reversals."
        : "Use the punctuation on the page -> trailing off where the script cuts weakens the beat.",
    ],
    do: [
      "React to new information like it lands in real time -> fresh listening keeps the actor engaged.",
      comedyMode
        ? "Stay grounded while the actor swings between extremes -> contrast creates the comedy."
        : "Match the stakes of the scene, not just the volume -> false intensity reads as fake immediately.",
      "Keep cues clean and playable -> simplicity gives the actor room to work.",
    ],
    avoid: [
      "Avoid adding commentary or attitude the script did not earn -> extra seasoning muddies the tone.",
      comedyMode
        ? "Avoid signaling punchlines or smiling through turns -> the scene stops feeling lived."
        : "Avoid stepping on monologues or turns -> interruptions can take the scene away from the actor.",
      "Avoid pushing for effect -> result-playing kills specificity fast.",
    ],
    connection: [
      `Stay available to ${auditionRole} through ${readerRoleSummary} in the silence -> that is usually where the actor decides whether to go deeper.`,
      "Answer what the actor is actually doing, not what you expected on the page -> anticipation flattens discovery.",
      "Let the actor's turn change how you deliver the next cue -> fixed readings make the scene feel dead.",
    ],
    anchor_line: `${auditionRole} can only go as deep as you let them through ${readerRoleSummary}.`,
    tone_reference_anchor: [
      defaultToneLine(meta.templateStyle),
      comedyMode
        ? "This is character logic plus timing, not sketch performance -> play truth and let reversals hit."
        : "Keep the scene grounded in behavior, not concept -> the writing already carries the tone.",
      "Let the seriousness of the situation drive the humor or tension -> winking at it breaks the world.",
    ],
    quick_reset: [
      comedyMode
        ? "Stay real and one beat behind -> the actor's swings must land on you."
        : "Open the scene with pressure -> the actor needs something live right away.",
      "Protect the turn -> that is where the audition usually either lands or disappears.",
      "Stay simple at the end -> let the actor own the button.",
    ],
    intimacy_section: highRisk
      ? [
          "Treat the behavior as real and contained -> spectacle pulls focus from the actual shift.",
          "Let stillness hold when the scene goes uncomfortable -> rushing is a defense and it shows.",
        ]
      : [],
    emotional_arc_mapping: highRisk
      ? [
          "Track the move from curiosity into participation -> if you flatten the build, shame has nowhere to come from.",
          "Shift cleanly into awareness -> missing that beat erases the turn.",
          "Let the aftermath contract instead of explain -> explanation kills the scene's sting.",
        ]
      : [],
  };
}

function normalizePerformanceEngine(engine = {}, fallback = {}) {
  return {
    drive_label: normalizeLine(engine.drive_label || fallback.drive_label),
    drive_text: normalizeLine(engine.drive_text || fallback.drive_text),
    drive_consequence: normalizeLine(engine.drive_consequence || fallback.drive_consequence),
    fuel_label: normalizeLine(engine.fuel_label || fallback.fuel_label),
    fuel_text: normalizeLine(engine.fuel_text || fallback.fuel_text),
    fuel_consequence: normalizeLine(engine.fuel_consequence || fallback.fuel_consequence),
  };
}

function normalizeSceneSnapshot(snapshot, fallbackSnapshot) {
  const source = Array.isArray(snapshot) && snapshot.length ? snapshot : fallbackSnapshot;

  return source
    .map((scene) => ({
      heading: normalizeLine(scene.heading || scene.title || "Scene"),
      bullets: normalizeArraySection(
        Array.isArray(scene.bullets) ? scene.bullets : [],
        Array.isArray(scene.bullets) && scene.bullets.length ? scene.bullets : ["Track the active turn -> the scene needs clean support."],
        "the actor needs this beat clearly supported.",
        4
      ),
    }))
    .slice(0, 3);
}

function normalizeWhatWillGoWrong(sourceItems, meta, fallbackItems) {
  if (meta.highRiskScene) {
    const mapped = Array.isArray(sourceItems) ? sourceItems : [];

    const discomfort = mapped.find((item) => hasAny(item, ["discomfort", "pull back", "flinch"]));
    const rush = mapped.find((item) => hasAny(item, ["rush", "fast", "skip"]));
    const judge = mapped.find((item) => hasAny(item, ["judge", "judgment", "distance", "sanitize"]));

    return [
      ensureActionConsequence(
        discomfort || "Pull back due to discomfort",
        "the actor loses the danger in the moment."
      ),
      ensureActionConsequence(
        rush || "Rush the intimate beats",
        "the arc disappears before it lands."
      ),
      ensureActionConsequence(
        judge || "Judge the material instead of grounding it",
        "the scene stops being playable."
      ),
    ];
  }

  return normalizeArraySection(
    sourceItems,
    fallbackItems,
    "the actor loses the scene's shape.",
    3
  );
}

function normalizeContent(modelContent = {}, meta = {}) {
  const fallback = buildFallbackContent(meta);
  const toneFallback = fallback.tone_reference_anchor;
  const consequenceLanguage = meta.comedyMode
    ? {
        readerFundamentals: "the scene dies immediately.",
        keyBeats: "the moment collapses.",
        rhythm: "the joke disappears.",
        do: "the actor gets cleaner support.",
        avoid: "casting checks out.",
        connection: "the scene collapses.",
        quickReset: "the read gets back on track immediately.",
      }
    : {
        readerFundamentals: "the actor feels the drop immediately.",
        keyBeats: "the emotional turn disappears.",
        rhythm: "the scene loses its pulse.",
        do: "the actor gets cleaner support.",
        avoid: "the scene drifts off target.",
        connection: "the actor pulls back instead of opening up.",
        quickReset: "the read gets back on track immediately.",
      };
  const yourJobSource = Array.isArray(modelContent.your_job) && modelContent.your_job.length
    ? modelContent.your_job
    : fallback.your_job;

  const yourJob = normalizeArraySection(
    yourJobSource,
    fallback.your_job,
    "the actor loses the support they need.",
    8
  );

  if (!hasAny(yourJob[0], ["do not", "don't", "wrong instinct", "stop"])) {
    yourJob.unshift("Do not read like a placeholder -> the actor ends up acting alone.");
  }

  const playingMultipleCharacters = normalizeArraySection(
    modelContent.playing_multiple_characters,
    fallback.playing_multiple_characters,
    "the scene loses contrast immediately.",
    6
  );

  if (!playingMultipleCharacters.some((item) => /audition dies instantly/i.test(item))) {
    playingMultipleCharacters.splice(1, 0, "If the two reader roles feel the same, the audition dies instantly.");
  }

  const toneReferenceAnchor = normalizeArraySection(
    modelContent.tone_reference_anchor,
    toneFallback,
    "the tone drifts immediately.",
    5
  );

  if (!/^if you/i.test(toneReferenceAnchor[0] || "")) {
    toneReferenceAnchor.unshift(defaultToneLine(meta.templateStyle));
  }

  return {
    title: `Reader Support Guide - ${normalizeLine(meta.displayReaderCharacterName || meta.readerCharacterName || "Reader101")}`,
    sub: [
      normalizeLine(meta.characterName ? `for ${meta.characterName}` : ""),
      normalizeLine(meta.productionTitle),
      normalizeLine(meta.productionType),
      normalizeLine(meta.genre),
    ]
      .filter(Boolean)
      .join(" · "),
    tags: [
      "Reader101",
      normalizeLine(meta.genre),
      normalizeLine(meta.productionType),
      meta.comedyMode ? "Comedy Mode" : "",
      meta.genreMode ? `Genre Mode: ${normalizeLine(meta.genreMode)}` : "",
      meta.childFocused ? "Child-Focused" : "",
      meta.highRiskScene ? "High-Risk Scene" : "",
      meta.templateStyle ? `Template: ${meta.templateStyle}` : "",
    ].filter(Boolean),
    fallbackMode: Boolean(meta.fallbackMode),
    warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
    highRiskScene: Boolean(meta.highRiskScene),
    parentContext: Boolean(meta.parentContext),
    intimacyArc: Boolean(meta.intimacyArc),
    fosterStyleScene: Boolean(meta.fosterStyleScene),
    what_will_go_wrong: normalizeWhatWillGoWrong(
      modelContent.what_will_go_wrong,
      meta,
      fallback.what_will_go_wrong
    ),
    what_will_go_wrong_footer: "If any of these happen, the audition doesn't land. Full stop.",
    why_it_matters: normalizeLine(modelContent.why_it_matters || fallback.why_it_matters),
    performance_engine: normalizePerformanceEngine(
      modelContent.performance_engine,
      fallback.performance_engine
    ),
    scene_snapshot: normalizeSceneSnapshot(modelContent.scene_snapshot, fallback.scene_snapshot),
    your_job: yourJob.slice(0, 8),
    playing_multiple_characters: playingMultipleCharacters.slice(0, 6),
    reader_fundamentals: normalizeArraySection(
      modelContent.reader_fundamentals,
      fallback.reader_fundamentals,
      consequenceLanguage.readerFundamentals,
      10
    ),
    key_beats: normalizeArraySection(
      modelContent.key_beats,
      fallback.key_beats,
      consequenceLanguage.keyBeats,
      8
    ),
    rhythm: normalizeArraySection(
      modelContent.rhythm,
      fallback.rhythm,
      consequenceLanguage.rhythm,
      8
    ),
    do: normalizeArraySection(
      modelContent.do,
      fallback.do,
      consequenceLanguage.do,
      5
    ),
    avoid: normalizeArraySection(
      modelContent.avoid,
      fallback.avoid,
      consequenceLanguage.avoid,
      5
    ),
    connection: normalizeArraySection(
      modelContent.connection,
      fallback.connection,
      consequenceLanguage.connection,
      6
    ),
    anchor_line: normalizeLine(
      modelContent.anchor_line || fallback.anchor_line
    ),
    tone_reference_anchor: toneReferenceAnchor.slice(0, 5),
    quick_reset: normalizeArraySection(
      modelContent.quick_reset,
      fallback.quick_reset,
      consequenceLanguage.quickReset,
      4
    ),
    intimacy_section: meta.highRiskScene
      ? normalizeArraySection(
          modelContent.intimacy_section,
          fallback.intimacy_section,
          "the high-risk turn collapses.",
          6
        )
      : [],
    emotional_arc_mapping: meta.highRiskScene
      ? normalizeArraySection(
          modelContent.emotional_arc_mapping,
          fallback.emotional_arc_mapping,
          "the arc disappears.",
          6
        )
      : [],
  };
}

async function buildGuide(meta = {}, options = {}) {
  // ── Parent Reader Card path ────────────────────────────────────────────
  // Always true for Reader101 — completely different template + schema.
  if (meta.parentReaderMode !== false) {
    const parentHtml = await buildParentGuide(meta, options);
    if (options.returnMeta) {
      return { html: parentHtml, templateStyle: "parent", contentSource: "model" };
    }
    return parentHtml;
  }

  const templateStyle = selectTemplate(meta);
  const templatePath = path.join(process.cwd(), "reader101", "templates", `${templateStyle}.html`);
  const generateContentFn = options.generateContentFn || generateContent;
  const signal = options.signal;
  let methodologyContext = "";
  let retrievalSignals = null;

  try {
    const retrieval = retrieveMethodologyContext(
      {
        product: "reader101",
        script: meta.sceneText || "",
        characterName: meta.characterName || "",
        productionTitle: meta.productionTitle || "",
        productionType: meta.productionType || "",
        genre: meta.genre || "",
        genreMode: meta.genreMode || "",
        storyline: meta.storyline || "",
      },
      {
        topK: 6,
      }
    );

    retrievalSignals = {
      primaryArchetype: retrieval.primaryArchetype || "",
      secondaryArchetype: retrieval.secondaryArchetype || "",
      hagen: retrieval.hagen || {},
    };

    methodologyContext = (retrieval.selectedChunks || [])
      .map(
        (chunk) =>
          `- [${chunk.filename} | score ${Number(chunk.score || 0).toFixed(3)}] ${String(
            chunk.text || ""
          ).trim()}`
      )
      .join("\n\n");
  } catch (error) {
    retrievalSignals = null;
    methodologyContext = "";
    console.warn("[Reader101] Methodology retrieval failed, continuing without retrieval context:", error.message);
  }

  let rawContent = {};
  let contentSource = "model";

  try {
    rawContent = await generateContentFn(
      {
        ...meta,
        templateStyle,
        methodologyContext,
        retrievalSignals,
      },
      { signal }
    );
  } catch (error) {
    contentSource = "fallback";
    rawContent = {};
    console.warn("[Reader101] Structured content generation failed:", error.message);
  }

  const normalized = normalizeContent(rawContent, {
    ...meta,
    templateStyle,
    warnings: [],
  });
  const html = renderTemplate(templatePath, normalized);

  if (options.returnMeta) {
    return {
      html,
      templateStyle,
      contentSource,
      content: normalized,
    };
  }

  return html;
}

async function buildParentGuide(meta = {}, options = {}) {
  const { generateParentContent } = require("./generateContent");
  const signal = options.signal;
  const actorRole = (meta.characterName || "").trim();
  const readerRoles = Array.isArray(meta.characterNames) && meta.characterNames.length
    ? meta.characterNames
    : [meta.readerCharacterName || "Reader"];

  let raw = {};
  try {
    raw = await generateParentContent(meta, { apiKey: process.env.ANTHROPIC_API_KEY, signal });
    console.log("[Reader101] Parent card generated:", JSON.stringify(raw).slice(0, 200));
  } catch (err) {
    console.warn("[Reader101] Parent card generation failed:", err.message);
  }

  // ── Build HTML fragments directly (no renderTemplate — it uses actor guide tokens) ──
  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const yourLinesHtml = (Array.isArray(raw.your_lines) ? raw.your_lines : [])
    .filter(l => l && String(l.line || "").trim())
    .map(l => {
      const char = esc(String(l.character || "").toUpperCase());
      const line = esc(String(l.line || "").trim());
      const note = String(l.note || "").trim();
      return `<div class="line-row"><span class="line-char">${char}</span><span class="line-text">${line}${note ? `<span class="line-note">${esc(note)}</span>` : ""}</span></div>`;
    }).join("") || `<p style="color:#9B9182;padding:12px;font-size:14px;">Use your script for the lines.</p>`;

  const howToSayHtml = (Array.isArray(raw.how_to_say_it) ? raw.how_to_say_it : [])
    .filter(Boolean)
    .map(s => `<div class="delivery-row"><p>${esc(String(s).trim())}</p></div>`)
    .join("") || `<div class="delivery-row"><p>Say it flat. Wait one beat.</p></div>`;

  const pauseItems = Array.isArray(raw.pause_here) ? raw.pause_here.filter(Boolean) : [];
  const pauseHtml = pauseItems.length
    ? `<ul class="stop-list">${pauseItems.map(s => `<li>${esc(String(s).trim())}</li>`).join("")}</ul>`
    : `<ul class="stop-list"><li>After your last line — stop. Wait.</li></ul>`;

  const neverDoText = esc(String(raw.dont_do_this || "Don't add anything after your last line.").trim());

  const ifWrongItems = Array.isArray(raw.if_it_goes_wrong) ? raw.if_it_goes_wrong.filter(Boolean) : [];
  const ifWrongHtml = ifWrongItems.length >= 2
    ? `<ul class="reset-list">${ifWrongItems.slice(0, 2).map(s => `<li>${esc(String(s).trim())}</li>`).join("")}</ul>`
    : `<ul class="reset-list"><li>Say it flat.</li><li>Wait one beat.</li></ul>`;

  // ── Title / tags ──────────────────────────────────────────────────────────
  const titleParts = [meta.productionTitle, actorRole].filter(Boolean);
  const TITLE = esc(titleParts.length ? `Reader Card — ${titleParts.join(" / ")}` : "Reader Parent Card");
  const SUB = esc([`for ${actorRole || "actor"}`, meta.productionTitle, meta.productionType].filter(Boolean).join(" · "));
  const readerLabel = readerRoles.join(" / ");
  const tagHtml = [
    `<span class="tag">Reader101</span>`,
    `<span class="tag">Parent Card</span>`,
    readerLabel ? `<span class="tag">${esc(readerLabel)}</span>` : "",
    meta.genre ? `<span class="tag">${esc(meta.genre)}</span>` : "",
  ].filter(Boolean).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${TITLE}</title>
  <style>
    :root{--bg:#0e1210;--surface:#161c19;--border:rgba(241,239,232,0.10);--text:#F1EFE8;--muted:#9B9182;--amber:#633806;--teal:#085041;--red:#791F1F;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:linear-gradient(160deg,#0c110f 0%,#0e1210 100%);color:var(--text);font-family:"Avenir Next","Trebuchet MS",system-ui,sans-serif;padding:24px 16px 60px;}
    .guide{max-width:780px;margin:0 auto;}
    .guide-header{padding-bottom:18px;margin-bottom:22px;border-bottom:3px solid #BA7517;}
    .guide-title{font-size:clamp(24px,4vw,36px);font-weight:700;}
    .guide-sub{margin-top:6px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;}
    .tag-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}
    .tag{font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;border:1px solid var(--border);color:var(--text);background:rgba(255,255,255,0.06);}
    .parent-banner{background:rgba(8,80,65,0.18);border:1px solid rgba(8,80,65,0.45);border-radius:12px;padding:14px 18px;margin-bottom:18px;font-size:13px;line-height:1.6;color:#b2d4cc;}
    .parent-banner strong{color:#d6ede8;}
    .section{margin-bottom:14px;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:rgba(22,28,25,0.94);box-shadow:0 20px 60px rgba(0,0,0,0.22);}
    .sec-head{display:flex;align-items:center;gap:10px;padding:11px 16px;}
    .sh-red{background:#791F1F;} .sh-teal{background:#085041;} .sh-amber{background:#633806;} .sh-dark{background:#252a27;} .sh-stop{background:#3d1a00;} .sh-reset{background:rgba(241,239,232,0.07);}
    .sec-num{min-width:28px;font-size:11px;font-weight:800;letter-spacing:0.06em;color:#D5D1C8;}
    .sec-title{font-size:15px;font-weight:800;}
    .sec-badge{margin-left:auto;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,0.14);color:#F1EFE8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;}
    .lines-body,.delivery-body,.stop-body,.never-body,.reset-body{padding:14px 18px 18px;}
    .line-row{display:flex;align-items:baseline;gap:10px;padding:9px 12px;border-radius:10px;margin-bottom:8px;background:rgba(255,255,255,0.04);border:1px solid var(--border);}
    .line-char{flex-shrink:0;min-width:90px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#FAC775;}
    .line-text{font-size:16px;font-weight:600;line-height:1.5;color:var(--text);}
    .line-note{display:block;margin-top:4px;font-size:12px;color:var(--muted);font-style:italic;}
    .delivery-row{padding:10px 14px;border-radius:10px;margin-bottom:8px;background:rgba(8,80,65,0.10);border-left:3px solid #085041;}
    .delivery-row p{font-size:14px;line-height:1.6;color:var(--text);}
    .stop-list{list-style:none;}
    .stop-list li{font-size:14px;line-height:1.6;padding:8px 14px 8px 36px;position:relative;color:var(--text);margin-bottom:6px;background:rgba(61,26,0,0.18);border-radius:8px;}
    .stop-list li::before{content:"✋";position:absolute;left:10px;top:8px;font-size:14px;}
    .never-rule{font-size:18px;font-weight:700;line-height:1.45;color:#F1EFE8;padding:14px 18px;background:rgba(121,31,31,0.18);border-radius:12px;border-left:4px solid #E24B4A;}
    .reset-list{list-style:none;display:flex;flex-direction:column;gap:8px;}
    .reset-list li{font-size:15px;font-weight:600;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text);}
    .cta-section{margin-top:24px;padding:20px;background:#fff;border-radius:16px;}
    .cta-section p{font-size:14px;color:#1a1a1a;font-family:sans-serif;margin-bottom:8px;}
    .cta-btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
    .cta-btns a{background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;font-family:sans-serif;}
    @media(max-width:580px){.line-row{flex-direction:column;gap:4px;}.line-char{min-width:unset;}}
  </style>
</head>
<body>
  <div class="guide">
    <div class="guide-header">
      <div class="guide-title">${TITLE}</div>
      <div class="guide-sub">${SUB}</div>
      <div class="tag-row">${tagHtml}</div>
    </div>

    <div class="parent-banner">
      <strong>You're the reader.</strong> Your kid is auditioning. This guide tells you exactly what to say, how to say it, and when to stop. Read it once. Then put it down and just do it.
    </div>

    <div class="section">
      <div class="sec-head sh-teal">
        <span class="sec-num">01</span>
        <span class="sec-title">Your Lines</span>
        <span class="sec-badge">say exactly this</span>
      </div>
      <div class="lines-body">${yourLinesHtml}</div>
    </div>

    <div class="section">
      <div class="sec-head sh-amber">
        <span class="sec-num">02</span>
        <span class="sec-title">How To Say It</span>
      </div>
      <div class="delivery-body">${howToSayHtml}</div>
    </div>

    <div class="section">
      <div class="sec-head sh-stop">
        <span class="sec-num">03</span>
        <span class="sec-title">Pause Here</span>
        <span class="sec-badge">silence is right</span>
      </div>
      <div class="stop-body">${pauseHtml}</div>
    </div>

    <div class="section">
      <div class="sec-head sh-red">
        <span class="sec-num">04</span>
        <span class="sec-title">Don't Do This</span>
      </div>
      <div class="never-body">
        <div class="never-rule">${neverDoText}</div>
      </div>
    </div>

    <div class="section">
      <div class="sec-head sh-reset">
        <span class="sec-num">05</span>
        <span class="sec-title" style="color:#F1EFE8;">If It Goes Wrong</span>
      </div>
      <div class="reset-body">${ifWrongHtml}</div>
    </div>

    <div class="cta-section">
      <p><strong>Want help with the actual performance?</strong></p>
      <p>Your kid's lines, choices, and how to build a tape that stands out — that's what the system is for.</p>
      <div class="cta-btns">
        <a href="https://boldchoices.site">Bold Choices</a>
        <a href="https://prep101.site">Prep101 Guide</a>
        <a href="https://coaching.childactor101.com">Book Coaching</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}


function buildList(items, className) {
  if (!items.length) return "";
  const lis = items.map(item => `<li>${String(item).trim()}</li>`).join("");
  return `<ul class="${className}">${lis}</ul>`;
}

module.exports = {
  buildGuide,
  buildParentGuide,
  buildFallbackContent,
  normalizeContent,
};
