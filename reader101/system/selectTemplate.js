function normalize(value = "") {
  return String(value || "").toLowerCase();
}

function hasAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function selectTemplate(meta = {}) {
  const genre = normalize(meta.genre);
  const productionType = normalize(meta.productionType);
  const storyline = normalize(meta.storyline);
  const title = normalize(meta.productionTitle);
  const flags = Array.isArray(meta.flags)
    ? meta.flags.map((flag) => normalize(flag))
    : [];
  const combined = [genre, productionType, storyline, title, flags.join(" ")]
    .filter(Boolean)
    .join(" ");

  if (flags.includes("high_risk") || flags.includes("intimacy")) {
    return "dark";
  }

  if (
    hasAny(combined, [
      "multicam",
      "multi-cam",
      "sitcom",
      "comedy series",
      "studio audience",
      "half hour comedy",
    ])
  ) {
    return "multicam";
  }

  if (
    hasAny(combined, [
      "disney",
      "nickelodeon",
      "teen",
      "youth",
      "kids",
      "family",
      "young adult",
      "coming of age",
      "school",
    ])
  ) {
    return "youth";
  }

  if (
    hasAny(combined, [
      "drama",
      "thriller",
      "prestige",
      "indie",
      "festival",
      "limited series",
      "crime",
      "period",
    ])
  ) {
    return "prestige";
  }

  return "youth";
}

module.exports = {
  selectTemplate,
};
