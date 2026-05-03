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

function normalizeArray(items, fallback, max) {
  const source = Array.isArray(items) && items.length ? items : (Array.isArray(fallback) ? fallback : []);
  return unique(source).slice(0, max);
}

function buildFallbackContent(meta = {}) {
  const auditionRole = normalizeLine(meta.characterName || "the actor");
  const readerRole = normalizeLine(
    meta.displayReaderCharacterName || meta.readerCharacterName || "the scene partner"
  );
  const highRisk = Boolean(meta.highRiskScene);
  const comedyMode = Boolean(meta.comedyMode) && !highRisk;

  return {
    your_job_sentence: highRisk
      ? `Stay vocally neutral and hold stillness so ${auditionRole} has ground to work from when the scene crosses into uncomfortable territory.`
      : comedyMode
        ? `Stay one beat behind and fully grounded so every reversal ${auditionRole} throws has somewhere to land.`
        : `Give ${auditionRole} something specific and real to push against — read ${readerRole} with enough weight that the scene has pressure from the first line.`,
    mistakes: highRisk
      ? [
          "Pull back because the material feels uncomfortable — the actor loses the scene's danger.",
          "Rush the turn — the emotional shift disappears before it can register.",
          "Judge the behavior instead of grounding it — the scene becomes unplayable.",
        ]
      : comedyMode
        ? [
            "React early or signal the punchline — the reversal dies before it lands.",
            "Match the actor's energy instead of staying grounded — the comedic contrast disappears.",
            "Smooth the hard cut — the scene loses the pivot it was built on.",
          ]
        : [
            "Read like a placeholder — the actor ends up carrying the scene alone.",
            "Flatten the pressure — the turn never arrives when it needs to.",
            "Add warmth before the scene earns it — the emotional arc collapses early.",
          ],
    how_to_read: [
      comedyMode
        ? "Stay grounded and sincere at all times — you are the normal world the actor disrupts."
        : `Read ${readerRole} with behavioral specificity — not a general supportive warmth, but the exact pressure or openness this moment requires.`,
      "Keep your volume consistently below the actor's throughout — they are the emotional center.",
      "Do not anticipate beats you have not reached yet — take each line as new information.",
    ],
    key_reader_lines: [
      comedyMode
        ? "Read each setup line as fully real — sincerity is what makes the reversal work."
        : "Deliver the scene's first line with clean intention — it sets the temperature for everything that follows.",
      "Land the scene's turning-point line simply and stop — do not add commentary or extra warmth.",
    ],
    silence_and_interruptions: [
      "When the script says '(beat)' or 'Long beat', honor it — do not speak into that space.",
      "Read interruption beats as real interruptions — commit to finishing the sentence and let the actor cut you.",
      "If the actor pauses mid-scene, do not rescue the silence — they are working.",
    ],
    timing: [
      comedyMode
        ? "Keep the exchange quick and grounded — dead air kills comedic momentum."
        : "Let the scene find its own tempo instead of imposing one — the script's punctuation is the guide.",
      "The scene's final exchange is lighter — do not add heaviness to lines that should release tension.",
    ],
    quick_reset: [
      comedyMode
        ? "If you reacted early, reset: receive the next line as completely new."
        : "If the scene felt flat, go back to the moment the pressure should have started and let it build from there.",
      "If an interruption beat felt awkward, commit harder to finishing the sentence — let the actor do the cutting.",
      "If the ending felt sentimental, cut the warmth from your last line by half.",
    ],
    intimacy_section: highRisk
      ? [
          "Treat the behavior as real and contained — spectacle pulls focus from the actual shift.",
          "Let stillness hold when the scene goes uncomfortable — rushing is a defense and it shows.",
        ]
      : [],
    emotional_arc_mapping: highRisk
      ? [
          "Track the move from curiosity into participation — if you flatten the build, shame has nowhere to come from.",
          "Shift cleanly into awareness — missing that beat erases the turn.",
          "Let the aftermath contract instead of explain — explanation kills the scene's sting.",
        ]
      : [],
  };
}

function normalizeContent(modelContent = {}, meta = {}) {
  const fallback = buildFallbackContent(meta);

  const readerCharacterNames = Array.isArray(meta.readerCharacterNames) ? meta.readerCharacterNames : [];
  const auditionRole = normalizeLine(meta.characterName || "the actor");
  const readerRoleDisplay = normalizeLine(
    meta.displayReaderCharacterName || meta.readerCharacterName || "Reader101"
  );

  return {
    title: `Reader Support Guide — ${readerRoleDisplay}`,
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
    intimacyMode: Boolean(meta.intimacyMode),
    parentContext: Boolean(meta.parentContext),
    intimacyArc: Boolean(meta.intimacyArc),
    fosterStyleScene: Boolean(meta.fosterStyleScene),
    multipleReaders: readerCharacterNames.length > 1,

    your_job_sentence: normalizeLine(
      modelContent.your_job_sentence || fallback.your_job_sentence
    ),

    mistakes: normalizeArray(
      modelContent.mistakes,
      fallback.mistakes,
      3
    ).slice(0, 3),

    how_to_read: normalizeArray(
      modelContent.how_to_read,
      fallback.how_to_read,
      5
    ),

    key_reader_lines: normalizeArray(
      modelContent.key_reader_lines,
      fallback.key_reader_lines,
      6
    ),

    silence_and_interruptions: normalizeArray(
      modelContent.silence_and_interruptions,
      fallback.silence_and_interruptions,
      5
    ),

    timing: normalizeArray(
      modelContent.timing,
      fallback.timing,
      5
    ),

    quick_reset: normalizeArray(
      modelContent.quick_reset,
      fallback.quick_reset,
      4
    ),

    intimacy_section: meta.highRiskScene
      ? normalizeArray(modelContent.intimacy_section, fallback.intimacy_section, 6)
      : [],
    emotional_arc_mapping: meta.highRiskScene
      ? normalizeArray(modelContent.emotional_arc_mapping, fallback.emotional_arc_mapping, 6)
      : [],
  };
}

async function buildGuide(meta = {}, options = {}) {
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
        topK: 4,
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

module.exports = {
  buildGuide,
  buildFallbackContent,
  normalizeContent,
};
