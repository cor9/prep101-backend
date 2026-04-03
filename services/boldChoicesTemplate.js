/**
 * renderBoldChoicesTemplate(data, meta, isPreview)
 *
 * data   — structured JSON from boldChoicesService.generateBoldChoices()
 * meta   — { characterName, show, network, castingDirectors, roleSize, castingOppositeOf }
 * isPreview — boolean: if true, truncate to first 2 bold choices and show upsell banner
 */
function renderBoldChoicesTemplate(data, meta = {}, isPreview = false) {
  const {
    hookLine = "",
    pov = {},
    choices = [],
    moments = [],
    references = [],
    take2 = [],
    coachNote = "",
  } = data;

  const {
    characterName = "CHARACTER",
    actorAge = "",
    productionTitle = "",
    productionType = "",
    roleSize = "",
    genre = "",
  } = meta;

  // Limit choices in preview mode
  const displayChoices = choices;
  const displayMoments = moments;
  const displayTake2 = take2;

  // ── HELPERS ────────────────────────────────────────────────────────────────
  const esc = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const renderChoices = (list) =>
    list
      .map(
        (c, i) => `
    <div class="choice-card" style="position:relative;">
      <button class="save-choice-btn" onclick="window.parent.postMessage({ type: 'BOLD_CHOICES_SAVE', choice: '${esc(c.title).replace(/'/g, "\\'")}\n${esc(c.body).replace(/'/g, "\\'")}' }, '*')" style="position:absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.8); border: 1px solid #F5D87A; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight:600; color: #1A1A1A; display:flex; align-items:center; gap:4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-transform:none; letter-spacing:0;">⭐ Add to Playbook</button>
      <div class="choice-number">Choice ${String(i + 1).padStart(2, "0")}</div>
      <div class="choice-title">${esc(c.title)}</div>
      <div class="choice-body">${esc(c.body)}</div>
      <div class="choice-engine">Engine: <span>${esc(c.engine)}</span></div>
    </div>`
      )
      .join("");

  const renderVariations = (takes) =>
    (takes || [])
      .map(
        (t) => `
        <div class="variation">
          <strong>${esc(t.label)} — ${esc(t.title)}</strong>
          ${esc(t.body)}
        </div>`
      )
      .join("");

  const renderMoments = (list) =>
    list
      .map(
        (m) => `
    <div class="moment-wrapper">
      <div class="moment-line">
        <span class="line-tag">${esc(m.sceneLabel || "Key Moment")}</span>
        "${esc(m.line)}"
      </div>
      <div class="moment-variations">
        ${renderVariations(m.takes)}
      </div>
    </div>`
      )
      .join("");

  const renderRefs = (list) =>
    list
      .map(
        (r) => `
      <div class="ref-card">
        <div class="ref-name">${esc(r.name)}</div>
        <div class="ref-show">${esc(r.source)}</div>
        <div class="ref-why">${esc(r.why)}</div>
      </div>`
      )
      .join("");

  const renderTake2 = (list) =>
    list
      .map(
        (t) => `
    <div class="take2-card">
      <div class="take2-title">${esc(t.title)}</div>
      <div class="take2-body">${esc(t.body)}</div>
    </div>`
      )
      .join("");

  const subHeaderParts = [productionTitle, productionType, genre]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  const subHeaderLine2 = [
    roleSize ? `Role: ${roleSize}` : null,
    actorAge ? `Age: ${actorAge}` : null,
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  // ── PREP101 FULL UPGRADE BANNER ───────────────────────────────────────────
  const prep101Banner = `
  <div class="prep101-upsell" style="background: var(--ink); border-radius: var(--border-radius); padding: 48px 36px; margin: 48px 0; text-align: center; border: 2px solid var(--gold);">
    <h2 style="font-family: 'Fraunces', serif; font-size: 1.8rem; color: #fff; margin-bottom: 24px;">Want the full breakdown?</h2>
    <p style="color: rgba(255,255,255,0.85); font-size: 16px; line-height: 1.7; max-width: 500px; margin: 0 auto 24px;">
      Bold Choices gives you options.<br/>
      <strong>Prep101 tells you which one books.</strong>
    </p>
    <p style="color: rgba(255,255,255,0.65); font-size: 15px; line-height: 1.7; max-width: 400px; margin: 0 auto 32px;">
      Every beat.<br/>
      Every shift.<br/>
      Every decision — intentional.
    </p>
    <a href="https://prep101.site" target="_blank" style="display: inline-block; background: var(--coral); color: #fff; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px; padding: 14px 36px; border-radius: 8px; text-decoration: none; letter-spacing: 0.03em; transition: opacity 0.2s;">👉 Build the performance →</a>
  </div>`;

  // ─── HTML OUTPUT ────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(characterName)} — Bold Choices Guide | Prep101</title>
<meta name="description" content="Bold, specific, playable acting choices for ${esc(characterName)}. Generated by Prep101 Bold Choices.">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --cream: #FAFAF5;
    --ink: #1A1A1A;
    --coral: #FF4D4D;
    --gold: #F5A623;
    --teal: #00B4A6;
    --purple: #7B4FBE;
    --sky: #3B9EE8;
    --soft-coral: #FFF0EE;
    --soft-gold: #FFF8E7;
    --soft-teal: #E6F9F8;
    --soft-purple: #F3EEFF;
    --soft-sky: #EBF5FF;
    --border-radius: 14px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: var(--cream);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    font-size: 17px;
    line-height: 1.7;
    max-width: 820px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }

  /* HEADER */
  .header {
    background: var(--ink);
    color: #fff;
    border-radius: var(--border-radius);
    padding: 40px 36px 32px;
    margin-bottom: 40px;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 220px; height: 220px;
    background: var(--coral);
    border-radius: 50%;
    opacity: 0.15;
  }
  .header-tag {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 10px;
  }
  .header h1 {
    font-family: 'Fraunces', serif;
    font-size: clamp(2.2rem, 6vw, 3.4rem);
    font-weight: 900;
    line-height: 1.05;
    color: #fff;
    margin-bottom: 8px;
  }
  .header h1 em { color: var(--coral); font-style: normal; }
  .header-hook {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-size: 1.1rem;
    color: rgba(255,255,255,0.75);
    margin-top: 12px;
    max-width: 560px;
  }
  .header-sub {
    font-size: 14px;
    color: rgba(255,255,255,0.55);
    margin-top: 12px;
    line-height: 1.6;
  }
  .header-sub strong { color: #fff; }

  /* SECTION */
  .section { margin-bottom: 36px; }
  .section-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .section-label .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .card { border-radius: var(--border-radius); padding: 26px 28px; border: 1.5px solid transparent; margin-bottom: 16px; }

  /* POV */
  .pov-card { background: var(--soft-coral); border-color: #FFCABD; }
  .pov-card .section-label { color: var(--coral); }
  .pov-card .dot { background: var(--coral); }
  .pov-summary { margin-bottom: 16px; font-size: 16px; }
  .mistake-box {
    background: var(--coral); color: #fff; border-radius: 10px;
    padding: 14px 18px; margin: 16px 0; font-size: 15px; font-weight: 500;
  }
  .mistake-box strong { display: block; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; opacity: 0.8; }
  .fix-box {
    background: #fff; border: 2px solid var(--coral); border-radius: 10px;
    padding: 14px 18px; font-size: 15px;
  }
  .fix-box strong { color: var(--teal); display: block; margin-bottom: 3px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
  .play-this-box {
    background: rgba(123,79,190,0.06); border-left: 3px solid var(--purple);
    margin: 16px 0 0; padding: 14px 18px; font-size: 15px;
  }
  .play-this-box strong { color: var(--purple); display: block; margin-bottom: 3px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }

  /* CHOICES */
  .choices-section .section-label { color: var(--gold); }
  .choices-section .dot { background: var(--gold); }
  .choice-card {
    background: var(--soft-gold); border: 1.5px solid #F5D87A;
    border-radius: var(--border-radius); padding: 22px 24px; margin-bottom: 14px;
  }
  .choice-number { font-family: 'Fraunces', serif; font-size: 13px; font-weight: 700; color: var(--gold); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .choice-title { font-family: 'Fraunces', serif; font-size: 1.35rem; font-weight: 700; color: var(--ink); margin-bottom: 10px; }
  .choice-body { font-size: 15.5px; color: #333; }
  .choice-engine { margin-top: 10px; font-size: 13px; font-weight: 600; color: var(--gold); text-transform: uppercase; letter-spacing: 0.07em; }
  .choice-engine span { color: var(--ink); font-weight: 400; text-transform: none; letter-spacing: 0; }

  /* MOMENTS */
  .moments-section .section-label { color: var(--teal); }
  .moments-section .dot { background: var(--teal); }
  .moment-wrapper { margin-bottom: 28px; }
  .moment-line {
    background: var(--teal); color: #fff; border-radius: 10px 10px 0 0;
    padding: 14px 20px; font-family: 'Fraunces', serif; font-style: italic;
    font-size: 1.05rem; font-weight: 400;
  }
  .moment-line .line-tag {
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.65);
    display: block; margin-bottom: 3px; font-style: normal;
  }
  .moment-variations {
    border: 1.5px solid #B2EAE6; border-top: none;
    border-radius: 0 0 10px 10px; overflow: hidden;
  }
  .variation {
    padding: 16px 20px; border-bottom: 1px solid #D6F5F3;
    background: var(--soft-teal); font-size: 15px;
  }
  .variation:last-child { border-bottom: none; }
  .variation strong { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--teal); margin-bottom: 4px; }

  /* REFS */
  .refs-section .section-label { color: var(--purple); }
  .refs-section .dot { background: var(--purple); }
  .ref-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 560px) { .ref-grid { grid-template-columns: 1fr; } }
  .ref-card { background: var(--soft-purple); border: 1.5px solid #C9A8F0; border-radius: var(--border-radius); padding: 18px 20px; }
  .ref-name { font-family: 'Fraunces', serif; font-size: 1.1rem; font-weight: 700; color: var(--purple); margin-bottom: 4px; }
  .ref-show { font-size: 12px; color: var(--purple); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 8px; }
  .ref-why { font-size: 14.5px; color: #3A2E4A; }

  /* TAKE 2 */
  .take2-section .section-label { color: var(--sky); }
  .take2-section .dot { background: var(--sky); }
  .take2-card { background: var(--soft-sky); border: 1.5px solid #A8D5F5; border-radius: var(--border-radius); padding: 22px 26px; margin-bottom: 14px; }
  .take2-title { font-family: 'Fraunces', serif; font-size: 1.2rem; font-weight: 700; color: var(--sky); margin-bottom: 8px; }
  .take2-body { font-size: 15.5px; color: #1A2F42; }

  /* PEP TALK */
  .pep-talk {
    background: var(--ink); color: #fff; border-radius: var(--border-radius);
    padding: 36px 36px 32px; margin-top: 48px; position: relative; overflow: hidden;
  }
  .pep-talk::after {
    content: ''; position: absolute; bottom: -50px; left: -50px;
    width: 200px; height: 200px; background: var(--teal); border-radius: 50%; opacity: 0.12;
  }
  .pep-talk .section-label { color: var(--gold); margin-bottom: 16px; }
  .pep-talk .dot { background: var(--gold); }
  .pep-talk p { font-size: 16.5px; line-height: 1.75; color: rgba(255,255,255,0.88); position: relative; z-index: 1; }
  .pep-talk p + p { margin-top: 14px; }
  .pep-talk strong { color: var(--gold); }
  .pep-talk em { color: var(--coral); font-style: normal; font-weight: 600; }

  /* DIVIDER */
  .divider {
    height: 2px;
    background: linear-gradient(to right, var(--coral), var(--gold), var(--teal), var(--purple), var(--sky));
    border-radius: 2px; margin: 48px 0; opacity: 0.35;
  }

  /* PARTIAL NOTICE */
  .partial-notice {
    background: #fff; border: 2px dashed #CCC; border-radius: var(--border-radius);
    padding: 22px 26px; text-align: center; margin-top: 48px;
  }
  .partial-notice p { font-size: 14.5px; color: #666; }
  .partial-notice strong { color: var(--ink); font-size: 15px; display: block; margin-bottom: 6px; }

  /* LOCKED / PREVIEW STYLES */
  .locked-section { opacity: 0.45; filter: blur(1.5px); pointer-events: none; userSelect: none; }
  .locked-card { position: relative; }
  .locked-bar { height: 22px; background: #D4AD60; border-radius: 4px; width: 55%; margin-bottom: 12px; }
  .locked-bar-white { height: 48px; background: rgba(255,255,255,0.3); border-radius: 8px; }
  .locked-line { height: 14px; background: #C8B99A; border-radius: 4px; width: 100%; margin-bottom: 8px; }

  /* PREVIEW GATE */
  .preview-gate {
    background: var(--ink); border-radius: var(--border-radius);
    padding: 48px 36px; margin: 48px 0; text-align: center;
    border: 2px solid var(--gold);
  }
  .preview-icon { font-size: 2.5rem; margin-bottom: 16px; }
  .preview-gate h2 { font-family: 'Fraunces', serif; font-size: 1.8rem; color: #fff; margin-bottom: 14px; }
  .preview-gate p { color: rgba(255,255,255,0.75); font-size: 16px; line-height: 1.7; max-width: 480px; margin: 0 auto 28px; }
  .preview-gate p strong { color: var(--gold); }
  .unlock-btn {
    display: inline-block; background: var(--coral); color: #fff;
    font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 15px;
    padding: 14px 36px; border-radius: 8px; text-decoration: none;
    letter-spacing: 0.03em; transition: opacity 0.2s;
  }
  .unlock-btn:hover { opacity: 0.88; }

  /* PREP101 BADGE */
  .prep101-badge {
    text-align: center; margin-top: 56px; padding-top: 32px;
    border-top: 1px solid #E8E8E0;
    font-size: 13px; color: #999; letter-spacing: 0.04em;
  }
  .prep101-badge strong { color: var(--ink); }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-tag">Bold Choices Guide</div>
  <h1>${esc(characterName).toUpperCase()}</h1>
  ${hookLine ? `<div class="header-hook">${esc(hookLine)}</div>` : ""}
  <div class="header-sub">
    ${subHeaderParts ? `<strong>${subHeaderParts}</strong><br>` : ""}
    ${subHeaderLine2 || ""}
  </div>
</div>

<!-- 1. CHARACTER POV SNAPSHOT -->
<div class="section pov-card card">
  <div class="section-label"><span class="dot"></span>1 — Character POV Snapshot</div>
  <p class="pov-summary">${esc(pov.summary || "")}</p>
  ${
    pov.mistake
      ? `<div class="mistake-box"><strong>The #1 Mistake Actors Will Make</strong>${esc(pov.mistake)}</div>`
      : ""
  }
  ${
    pov.fix
      ? `<div class="fix-box"><strong>The Fix</strong>${esc(pov.fix)}</div>`
      : ""
  }
  ${
    pov.playThis
      ? `<div class="play-this-box"><strong>Play This</strong>${esc(pov.playThis)}</div>`
      : ""
  }
</div>

<div class="divider"></div>

<!-- 2. BOLD ACTING CHOICES -->
<div class="section choices-section">
  <div class="section-label"><span class="dot"></span>2 — Bold Acting Choices</div>
  ${renderChoices(displayChoices)}
  
</div>



<div class="divider"></div>

<!-- 3. MOMENT PLAYS -->
<div class="section moments-section">
  <div class="section-label"><span class="dot"></span>3 — Moment Plays</div>
  ${renderMoments(displayMoments)}
  
</div>

<div class="divider"></div>

<!-- 4. CHARACTER REFERENCES -->
<div class="section refs-section">
  <div class="section-label"><span class="dot"></span>4 — Character References</div>
  <div class="ref-grid">
    ${renderRefs(references)}
    
  </div>
</div>

<div class="divider"></div>

<!-- 5. TAKE 2 STRATEGY -->
<div class="section take2-section">
  <div class="section-label"><span class="dot"></span>5 — Take 2 Strategy</div>
  ${renderTake2(displayTake2)}
  
</div>

<!-- PEP TALK (only in full guide) -->
${
  coachNote
    ? `<div class="pep-talk">
  <div class="section-label"><span class="dot"></span>Final Word from Coach</div>
  <p>${esc(coachNote)}</p>
</div>`
    : ""
}

${prep101Banner}

<!-- PREP101 BADGE -->
<div class="prep101-badge">
  Generated by <strong>Prep101</strong> Bold Choices &nbsp;·&nbsp; boldchoices.prep101.site
</div>

</body>
</html>`;
}

module.exports = { renderBoldChoicesTemplate };
