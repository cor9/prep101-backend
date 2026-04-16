const assert = require("assert");
const {
  __private: { evaluateExtraction, resolvePipelineResult },
} = require("../services/pdfIngestPipeline");

function stage(stageName, text, minWordCount, source, overrides = {}) {
  return {
    source,
    ...evaluateExtraction(stageName, text, { minWordCount }),
    ...overrides,
  };
}

function runTests() {
  const cleanPdfText = `
INT. KITCHEN - DAY

JUNE:
I said stay here.

RUBY:
I am staying here.

JUNE:
Good.
  `.repeat(25);

  const screenplayCueNoColonText = `
INT. APARTMENT - NIGHT

JAMIE
(whispering)
I don't want them to hear us.

LANDON
Then stop shouting.
  `.repeat(14);

  const watermarkHeavyText = `
B540LT
Sides by Breakdown Services - Actors Access
Page 1 of 5
Feb 12, 2026 10:30 AM
`;

  const ocrRecoveredText = Array.from({ length: 14 }, (_, index) => `
INT. HALLWAY ${index + 1} - NIGHT

FOSTER:
Don't look at me like that ${index + 1}.

JUNE:
Then stop giving me reasons ${index + 1}.
`).join("\n");

  const visionRecoveredText = Array.from({ length: 10 }, (_, index) => `
EXT. PARKING LOT ${index + 1} - NIGHT

JACK:
You okay ${index + 1}?

JUNE:
No. Keep driving ${index + 1}.
`).join("\n");

  const case1 = resolvePipelineResult({
    textStage: stage("text", cleanPdfText, 100, "text"),
    ocrStage: null,
    visionStage: null,
  });
  assert.equal(case1.source, "text", "Case 1 should stay on text extraction");

  const case2 = resolvePipelineResult({
    textStage: stage("text", watermarkHeavyText.repeat(30), 100, "text"),
    ocrStage: stage("ocr", ocrRecoveredText, 50, "ocr", { quality: "good" }),
    visionStage: null,
  });
  assert.equal(case2.source, "ocr", "Case 2 should escalate to OCR");
  assert.ok(
    case2.warnings.some((warning) => /image-based reading/i.test(String(warning || ""))),
    "Case 2 should include OCR recovery messaging"
  );

  const case3 = resolvePipelineResult({
    textStage: stage("text", "", 100, "text"),
    ocrStage: stage("ocr", ocrRecoveredText, 50, "ocr", { quality: "good" }),
    visionStage: null,
  });
  assert.equal(case3.source, "ocr", "Case 3 should use OCR for scanned PDFs");

  const case4 = resolvePipelineResult({
    textStage: stage("text", watermarkHeavyText.repeat(20), 100, "text"),
    ocrStage: stage("ocr", "B540LT\nB540LT\nB540LT", 50, "ocr"),
    visionStage: stage("vision", visionRecoveredText, 1, "vision"),
  });
  assert.equal(case4.source, "vision", "Case 4 should fall through to vision");

  const case5 = resolvePipelineResult({
    textStage: stage("text", "", 100, "text"),
    ocrStage: stage("ocr", "", 50, "ocr"),
    visionStage: stage("vision", "", 1, "vision"),
  });
  assert.equal(case5.limited, true, "All-fail case should remain internally limited");
  assert.deepEqual(case5.warnings, [], "All-fail case should not surface a limited-text warning");
  assert.equal(case5.uploadMessage, null, "All-fail case should not send user-facing fallback copy");

  const noColonStage = stage("text", screenplayCueNoColonText, 100, "text");
  assert.ok(
    (noColonStage.characterNames || []).includes("JAMIE"),
    "Should detect standalone screenplay cue names without colon"
  );
  const case6 = resolvePipelineResult({
    textStage: noColonStage,
    ocrStage: null,
    visionStage: null,
  });
  assert.equal(case6.source, "text", "Case 6 should pass with screenplay cue structure");

  console.log("pdf ingest pipeline routing tests passed");
}

runTests();
