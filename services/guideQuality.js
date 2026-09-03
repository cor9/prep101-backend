// Guide quality gates.
//
// These decide whether a finished generation is good enough to save and charge
// for. They used to live inside simple-backend-rag.js, which meant the guide
// worker — a separate process that cannot load the Express monolith — had no
// way to apply the same standard. Pulled out here so the worker and the API
// judge a guide identically.

function assessGeneratedGuideQuality(html = "") {
  const content = String(html || "");
  const missing = [];
  const lower = content.toLowerCase();

  if (content.length < 2500) missing.push("guide is too short");
  if (!/Final Coach Note|Closing Coach'?s?\s*Note|FINAL PEP TALK/i.test(content)) {
    missing.push("final coach note");
  }
  if (!/Pre-Submission Checklist/i.test(content)) missing.push("pre-submission checklist");
  if (!/Two[- ]Take|Take\s*A\b|Take\s*B\b|Take\s*1\b|Take\s*2\b/i.test(content)) {
    missing.push("two-take strategy");
  }
  if (
    lower.includes("no usable dramatic content detected") ||
    lower.includes("script pages are not available") ||
    lower.includes("actual script pages are not available") ||
    lower.includes("resubmit with the correct pdf") ||
    ((lower.match(/not stated in sides/g) || []).length >= 8)
  ) {
    missing.push("source-specific coaching");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

function assessReaderGuideQuality(html = "") {
  const content = String(html || "");
  const lower = content.toLowerCase();
  const missing = [];

  if (content.length < 1500) missing.push("reader guide is too short");
  if (
    !/Reader101|Reader Support|reader support|reader['’]?s job|your job|key beats/i.test(
      content
    )
  ) {
    missing.push("reader-specific coaching");
  }
  if (
    lower.includes("no usable dramatic content detected") ||
    lower.includes("script pages are not available") ||
    lower.includes("actual script pages are not available") ||
    lower.includes("resubmit with the correct pdf")
  ) {
    missing.push("source-specific reader guidance");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

function assessGuideQualityForType(html = "", guideType = "prep101") {
  return guideType === "reader101"
    ? assessReaderGuideQuality(html)
    : assessGeneratedGuideQuality(html);
}

module.exports = {
  assessGeneratedGuideQuality,
  assessReaderGuideQuality,
  assessGuideQualityForType,
};
