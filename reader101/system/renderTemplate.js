const fs = require("fs");

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeLine(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatInline(value = "") {
  let safe = escapeHtml(normalizeLine(value));

  safe = safe.replace(/"([^"]+)"/g, '<span class="ref">"$1"</span>');
  safe = safe.replace(/\s(?:->|→)\s(.+)$/, ' <span class="consequence-inline">-&gt; $1</span>');

  return safe;
}

function renderParagraphs(value = "") {
  const paragraphs = String(value || "")
    .split(/\n{2,}/)
    .map((part) => normalizeLine(part))
    .filter(Boolean);

  return paragraphs.map((part) => `<p>${formatInline(part)}</p>`).join("");
}

function renderList(items = []) {
  const rows = Array.isArray(items)
    ? items.map((item) => normalizeLine(item)).filter(Boolean)
    : [];

  if (!rows.length) {
    return "<ul><li>Stay playable -> the actor needs something solid to work against.</li></ul>";
  }

  return `<ul>${rows.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>`;
}

function renderTagRow(tags = []) {
  const cleaned = Array.isArray(tags)
    ? tags.map((tag) => normalizeLine(tag)).filter(Boolean)
    : [];

  if (!cleaned.length) {
    return "";
  }

  return cleaned.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
}

function renderPerformanceEngine(engine = {}) {
  const driveLabel = normalizeLine(engine.drive_label || "Scene Drive");
  const driveText = normalizeLine(engine.drive_text || "Give the actor real resistance so the scene has pressure.");
  const driveConsequence = normalizeLine(
    engine.drive_consequence || "If you flatten the pressure, the actor loses the scene's engine."
  );
  const fuelLabel = normalizeLine(engine.fuel_label || "Reader Fuel");
  const fuelText = normalizeLine(engine.fuel_text || "Ground every cue in behavior and stakes, not presentation.");
  const fuelConsequence = normalizeLine(
    engine.fuel_consequence || "If you decorate the read, the scene starts performing instead of landing."
  );

  return `
    <div class="engine-card">
      <div class="engine-head eh-left"><div class="engine-label engine-label-left">${escapeHtml(driveLabel)}</div></div>
      <div class="engine-body">
        <p>${formatInline(driveText)}</p>
        <span class="consequence">${formatInline(driveConsequence)}</span>
      </div>
    </div>
    <div class="engine-card">
      <div class="engine-head eh-right"><div class="engine-label engine-label-right">${escapeHtml(fuelLabel)}</div></div>
      <div class="engine-body">
        <p>${formatInline(fuelText)}</p>
        <span class="consequence">${formatInline(fuelConsequence)}</span>
      </div>
    </div>
  `;
}

function renderSceneSnapshot(scenes = []) {
  const cards = Array.isArray(scenes) ? scenes : [];

  if (!cards.length) {
    return `
      <div class="scene-card">
        <div class="scene-head"><div class="scene-label">Scene Shape</div></div>
        <div class="scene-body">
          <ul><li>Track setup, pressure, and turn -> the actor needs clean support on each shift.</li></ul>
        </div>
      </div>
    `;
  }

  return cards
    .map((scene) => {
      const heading = normalizeLine(scene.heading || scene.title || "Scene");
      const bullets = Array.isArray(scene.bullets) ? scene.bullets : [];
      return `
        <div class="scene-card">
          <div class="scene-head"><div class="scene-label">${escapeHtml(heading)}</div></div>
          <div class="scene-body">${renderList(bullets)}</div>
        </div>
      `;
    })
    .join("");
}

function renderFallbackNote(data = {}) {
  const notes = [];

  if (Array.isArray(data.warnings)) {
    notes.push(
      ...data.warnings
        .map((warning) => normalizeLine(warning))
        .filter(
          (warning) =>
            warning &&
            !/limited script text detected/i.test(warning) &&
            !/upload clearer sides for line-specific detail/i.test(warning)
        )
    );
  }

  if (!notes.length) {
    return "";
  }

  return `
    <div class="notice-box">
      ${notes.map((note) => `<p>${formatInline(note)}</p>`).join("")}
    </div>
  `;
}

function renderHighRiskSection(data = {}) {
  if (!data.highRiskScene) {
    return "";
  }

  const exactLines = [
    "This scene contains behavior that may cause reader discomfort. That discomfort must NOT affect delivery.",
    "Your job is not to make this comfortable. Your job is to make it playable.",
    "This moment may feel uncomfortable. Do not adjust your performance to avoid that discomfort.",
    "Reader does NOT simulate physical behavior.",
    "Reader provides emotional grounding only.",
  ];

  if (data.parentContext) {
    exactLines.push("This may feel uncomfortable. Stay neutral and professional.");
  }

  const bullets = [...exactLines, ...(Array.isArray(data.intimacy_section) ? data.intimacy_section : [])];

  return `
    <div class="section">
      <div class="sec-head sh-red">
        <span class="sec-num nl">⚠</span>
        <span class="sec-title tl">When the Scene Crosses Into Intimacy</span>
      </div>
      <div class="sec-body">
        ${renderList(bullets)}
      </div>
    </div>
  `;
}

function renderEmotionalArcSection(data = {}) {
  if (!data.highRiskScene) {
    return "";
  }

  const arcBullets = [
    "curiosity -> participation -> awareness -> shame",
  ];

  if (data.intimacyArc) {
    arcBullets.push("build -> tension -> exposure -> shame -> exit");
  }

  arcBullets.push(...(Array.isArray(data.emotional_arc_mapping) ? data.emotional_arc_mapping : []));

  if (data.fosterStyleScene) {
    arcBullets.push("Scene 3 - Critical Reader Adjustment");
    arcBullets.push("Treat the sexual content as behavior, not spectacle -> spectacle cheapens the turn immediately.");
    arcBullets.push("Do not add humor or commentary to defuse discomfort -> defusing the moment kills the scene's danger.");
    arcBullets.push("Stay vocally neutral with no judgment or distancing -> judgment makes the actor protect instead of reveal.");
    arcBullets.push("Allow stillness -> rushing this collapses the contained tension.");
    arcBullets.push("Track the shift into shame -> if you miss that pivot, the whole scene goes flat.");
    arcBullets.push("If you rush or soften this moment, Foster's entire psychological turn disappears.");
  }

  return `
    <div class="section">
      <div class="sec-head sh-coral">
        <span class="sec-num nl">AR</span>
        <span class="sec-title tl">Emotional Arc Mapping</span>
      </div>
      <div class="sec-body">
        ${renderList(arcBullets)}
      </div>
    </div>
  `;
}

function replaceToken(html, token, value) {
  return html.replace(new RegExp(`{{${token}}}`, "g"), value == null ? "" : String(value));
}

function renderTemplate(templatePath, data = {}) {
  let html = fs.readFileSync(templatePath, "utf8");

  html = replaceToken(html, "TITLE", escapeHtml(data.title || "Reader Support Guide"));
  html = replaceToken(html, "SUB", escapeHtml(data.sub || ""));
  html = replaceToken(html, "TAG_ROW", renderTagRow(data.tags));
  html = replaceToken(html, "NOTICE_BLOCK", renderFallbackNote(data));
  html = replaceToken(html, "WHAT_WILL_GO_WRONG", renderList(data.what_will_go_wrong));
  html = replaceToken(html, "WHAT_WILL_GO_WRONG_FOOTER", formatInline(data.what_will_go_wrong_footer || ""));
  html = replaceToken(html, "HIGH_RISK_SECTION", renderHighRiskSection(data));
  html = replaceToken(html, "EMOTIONAL_ARC_SECTION", renderEmotionalArcSection(data));
  html = replaceToken(html, "WHY_IT_MATTERS", renderParagraphs(data.why_it_matters));
  html = replaceToken(html, "PERFORMANCE_ENGINE", renderPerformanceEngine(data.performance_engine));
  html = replaceToken(html, "SCENE_SNAPSHOT", renderSceneSnapshot(data.scene_snapshot));
  html = replaceToken(html, "YOUR_JOB", renderList(data.your_job));
  html = replaceToken(html, "PLAYING_MULTIPLE_CHARACTERS", renderList(data.playing_multiple_characters));
  html = replaceToken(html, "READER_FUNDAMENTALS", renderList(data.reader_fundamentals));
  html = replaceToken(html, "KEY_BEATS", renderList(data.key_beats));
  html = replaceToken(html, "RHYTHM", renderList(data.rhythm));
  html = replaceToken(html, "DO_THIS", renderList(data.do));
  html = replaceToken(html, "AVOID_THIS", renderList(data.avoid));
  html = replaceToken(html, "ANCHOR_LINE", formatInline(data.anchor_line || ""));
  html = replaceToken(html, "CONNECTION", renderList(data.connection));
  html = replaceToken(html, "TONE_REFERENCE_ANCHOR", renderList(data.tone_reference_anchor));
  html = replaceToken(html, "QUICK_RESET", renderList(data.quick_reset));

  return html.replace(/{{[A-Z_]+}}/g, "");
}

module.exports = {
  renderTemplate,
};
