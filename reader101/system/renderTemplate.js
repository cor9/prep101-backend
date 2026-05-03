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

function renderList(items = []) {
  const rows = Array.isArray(items)
    ? items.map((item) => normalizeLine(item)).filter(Boolean)
    : [];

  if (!rows.length) {
    return "<ul><li>Stay playable — the actor needs something solid to work against.</li></ul>";
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

  const sectionTitle = data.intimacyMode
    ? "When the Scene Crosses Into Intimacy"
    : "Handling High-Risk Material";

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
        <span class="sec-title tl">${sectionTitle}</span>
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
    arcBullets.push("Treat the sexual content as behavior, not spectacle -> spectacle cheapens the turn immediately.");
    arcBullets.push("Do not add humor or commentary to defuse discomfort -> defusing the moment kills the scene's danger.");
    arcBullets.push("Stay vocally neutral with no judgment or distancing -> judgment makes the actor protect instead of reveal.");
    arcBullets.push("Allow stillness -> rushing this collapses the contained tension.");
    arcBullets.push("Track the shift into shame -> if you miss that pivot, the whole scene goes flat.");
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
  html = replaceToken(html, "HIGH_RISK_SECTION", renderHighRiskSection(data));
  html = replaceToken(html, "EMOTIONAL_ARC_SECTION", renderEmotionalArcSection(data));
  html = replaceToken(html, "YOUR_JOB_SENTENCE", formatInline(data.your_job_sentence || ""));
  html = replaceToken(html, "MISTAKES", renderList(data.mistakes));
  html = replaceToken(html, "HOW_TO_READ", renderList(data.how_to_read));
  html = replaceToken(html, "KEY_READER_LINES", renderList(data.key_reader_lines));
  html = replaceToken(html, "SILENCE_AND_INTERRUPTIONS", renderList(data.silence_and_interruptions));
  html = replaceToken(html, "TIMING", renderList(data.timing));
  html = replaceToken(html, "QUICK_RESET", renderList(data.quick_reset));

  return html.replace(/{{[A-Z_]+}}/g, "");
}

module.exports = {
  renderTemplate,
};
