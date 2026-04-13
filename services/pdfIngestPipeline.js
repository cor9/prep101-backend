const fs = require("fs");
const os = require("os");
const path = require("path");
const fetch = require("node-fetch");
const pdfParse = require("pdf-parse");

const {
  scrubWatermarks,
  assessQuality,
  analyzeWatermarkInterference,
  isLikelyWatermarkLine,
} = require("./textCleaner");
const { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS } = require("../config/models");

let extractWithAdobe = null;
try {
  ({ extractWithAdobe } = require("./extractors/adobeExtract"));
} catch (_error) {
  extractWithAdobe = null;
}

const IMAGE_BASED_READING_MESSAGE =
  "This file's formatting is interfering with text extraction. We're switching to image-based reading to recover the script.";

function getWordCount(text = "") {
  return (String(text).match(/\b[\w']+\b/g) || []).length;
}

function buildCharacterNames(text = "") {
  const characterPattern = /^[A-Z][A-Z\s]+:/gm;
  return [
    ...new Set(
      (String(text).match(characterPattern) || []).map((name) =>
        name.replace(":", "").trim()
      )
    ),
  ];
}

function cleanPipelineText(text = "") {
  return scrubWatermarks(
    String(text || "")
      .replace(/B\d{3,}[A-Z0-9-]*/gi, "")
      .replace(/[A-Z]?[A-Z0-9]{5,}[-_][A-Z0-9-]*/g, "")
      .replace(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}.*/g, "")
      .replace(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/gi, "")
      .replace(/\n{2,}/g, "\n")
      .split("\n")
      .filter((line) => line.trim().length > 3)
      .filter((line) => !/^[A-Z0-9\-]+$/.test(line.trim()))
      .join("\n")
  );
}

function getMetadataLineRatio(text = "") {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return 1;
  const metadataLines = lines.filter((line) => isLikelyWatermarkLine(line));
  return metadataLines.length / lines.length;
}

function getRepeatedTokenRatio(text = "") {
  const tokens = String(text || "")
    .match(/\b[A-Z0-9][A-Z0-9-]{2,}\b/g) || [];

  if (!tokens.length) return 0;

  const counts = {};
  tokens.forEach((token) => {
    const normalized = token.toUpperCase();
    counts[normalized] = (counts[normalized] || 0) + 1;
  });

  let repeatedCount = 0;
  Object.values(counts).forEach((count) => {
    if (count > 1) repeatedCount += count;
  });

  return repeatedCount / tokens.length;
}

function getEntropyRatio(text = "") {
  const words = String(text || "")
    .toLowerCase()
    .match(/\b[a-z0-9']+\b/g) || [];

  if (!words.length) return 0;
  return new Set(words).size / words.length;
}

function evaluateExtraction(stage, rawText, { minWordCount }) {
  const cleanedText = cleanPipelineText(rawText);
  const wordCount = getWordCount(cleanedText);
  const characterNames = buildCharacterNames(cleanedText);
  const repeatedTokenRatio = getRepeatedTokenRatio(rawText);
  const metadataLineRatio = getMetadataLineRatio(rawText);
  const entropyRatio = getEntropyRatio(cleanedText);
  const watermarkInterference = analyzeWatermarkInterference(rawText);
  const qualityAssessment = assessQuality(cleanedText);
  const hasScriptSignals =
    characterNames.length >= 2 ||
    /\b(INT|EXT)\./i.test(cleanedText) ||
    /^[A-Z][A-Z\s]{1,24}:/m.test(cleanedText);

  const failures = [];
  if (wordCount < minWordCount) failures.push(`wordCount<${minWordCount}`);
  if (repeatedTokenRatio > 0.2) failures.push("repeatedTokens>20%");
  if (metadataLineRatio > 0.35) failures.push("metadataHeavyLines");
  if (watermarkInterference.shouldEscalateToOCR) {
    failures.push("watermarkInterference");
  }
  if (entropyRatio < 0.35) failures.push("lowEntropy");
  if (qualityAssessment.quality === "repetitive") failures.push("repetitive");

  // If we extracted enough usable script-like text, don't over-penalize watermark/noise heuristics.
  const looksUsableScript =
    wordCount >= 80 &&
    qualityAssessment.usable &&
    hasScriptSignals &&
    !watermarkInterference.shouldEscalateToOCR;

  const quality =
    looksUsableScript || !failures.length ? "good" : "needs_escalation";
  return {
    stage,
    rawText,
    text: cleanedText,
    wordCount,
    quality,
    failures,
    repeatedTokenRatio,
    metadataLineRatio,
    entropyRatio,
    watermarkInterference,
    characterNames,
  };
}

async function convertPdfToImages(pdfBuffer, options = {}) {
  const pdf2pic = require("pdf2pic");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-ingest-"));
  const tempPdfPath = path.join(tempDir, "input.pdf");
  fs.writeFileSync(tempPdfPath, pdfBuffer);

  const convert = pdf2pic.fromPath(tempPdfPath, {
    density: options.density || 300,
    saveFilename: "page",
    savePath: tempDir,
    format: "png",
    width: options.width || 1600,
    height: options.height || 2200,
  });

  const pages = [];
  const maxPages = options.maxPages || 10;
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    try {
      const result = await convert(pageNum);
      if (!result?.path) break;
      pages.push({
        pageNum,
        path: result.path,
        buffer: fs.readFileSync(result.path),
      });
    } catch (_error) {
      break;
    }
  }

  return {
    pages,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function buildConfidence(wordCount, source, limited) {
  if (limited) return "low";
  if (source === "text" && wordCount >= 300) return "high";
  if (wordCount >= 120) return "medium";
  return "low";
}

async function extractTextStage(pdfBuffer) {
  const candidates = [];

  const basic = await pdfParse(pdfBuffer);
  candidates.push({
    source: "text",
    provider: "pdf-parse",
    ...evaluateExtraction("text", basic.text || "", { minWordCount: 100 }),
  });

  if (extractWithAdobe) {
    try {
      const adobe = await extractWithAdobe(pdfBuffer);
      candidates.push({
        source: "text",
        provider: "adobe",
        ...evaluateExtraction("text", adobe.text || "", { minWordCount: 100 }),
      });
    } catch (_error) {
      // ignore and continue
    }
  }

  candidates.sort((a, b) => {
    if (a.quality === "good" && b.quality !== "good") return -1;
    if (b.quality === "good" && a.quality !== "good") return 1;
    return (b.wordCount || 0) - (a.wordCount || 0);
  });

  return candidates[0] || {
    stage: "text",
    source: "text",
    provider: "pdf-parse",
    text: "",
    rawText: "",
    wordCount: 0,
    quality: "needs_escalation",
    failures: ["noText"],
    repeatedTokenRatio: 0,
    metadataLineRatio: 1,
    entropyRatio: 0,
    watermarkInterference: analyzeWatermarkInterference(""),
    characterNames: [],
  };
}

async function extractOcrStage(pages) {
  let Tesseract = null;
  try {
    Tesseract = require("tesseract.js");
  } catch (_error) {
    return {
      stage: "ocr",
      source: "ocr",
      skipped: true,
      text: "",
      rawText: "",
      wordCount: 0,
      quality: "needs_escalation",
      failures: ["tesseractUnavailable"],
      characterNames: [],
      pageResults: [],
    };
  }

  const pageResults = [];
  const chunks = [];
  for (const page of pages) {
    const result = await Tesseract.recognize(page.path, "eng");
    const rawText = result?.data?.text || "";
    const cleanedText = cleanPipelineText(rawText);
    const wordCount = getWordCount(cleanedText);
    pageResults.push({
      pageNum: page.pageNum,
      rawText,
      text: cleanedText,
      wordCount,
      quality: wordCount >= 50 ? "good" : "needs_escalation",
    });
    if (cleanedText) {
      chunks.push(cleanedText);
    }
  }

  const combinedRawText = pageResults.map((page) => page.rawText).join("\n\n");
  const evaluated = evaluateExtraction("ocr", combinedRawText, {
    minWordCount: 50,
  });
  return {
    source: "ocr",
    ...evaluated,
    pageResults,
  };
}

async function callGeminiVisionPage(page, prompt) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key missing");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: page.buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini vision failed: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  return (
    json?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || ""
  );
}

async function callClaudeVisionPage(page, prompt) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("Anthropic API key missing");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: DEFAULT_CLAUDE_MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: page.buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude vision failed: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  return json?.content?.[0]?.text || "";
}

function selectVisionPages(pages, ocrPageResults = []) {
  if (!ocrPageResults.length) return pages;
  const badPageNumbers = new Set(
    ocrPageResults
      .filter((page) => page.wordCount < 30 || page.quality !== "good")
      .map((page) => page.pageNum)
  );
  return pages.filter((page) => badPageNumbers.has(page.pageNum));
}

async function extractVisionStage(pages, ocrPageResults = []) {
  const prompt = `Extract only the usable audition sides from this image.

INCLUDE:
- Character names
- Dialogue
- Scene headings
- Essential stage directions

IGNORE:
- Watermarks
- Repeated IDs or codes
- Timestamps
- Page numbers
- Background overlays

FORMAT:
- Clean script format
- Preserve dialogue flow
- Remove duplicates
- Do not explain anything

If text is partially obscured, reconstruct it naturally.`;

  const pagesToProcess = selectVisionPages(pages, ocrPageResults);
  const useGemini = Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  const chunks = [];
  const pageResults = [];

  for (const page of pagesToProcess) {
    try {
      const rawText = useGemini
        ? await callGeminiVisionPage(page, prompt)
        : await callClaudeVisionPage(page, prompt);
      const cleanedText = cleanPipelineText(rawText);
      pageResults.push({
        pageNum: page.pageNum,
        rawText,
        text: cleanedText,
        wordCount: getWordCount(cleanedText),
      });
      if (cleanedText) {
        chunks.push(cleanedText);
      }
    } catch (_error) {
      // continue to next page
    }
  }

  const combinedRawText = pageResults.map((page) => page.rawText).join("\n\n");
  return {
    source: "vision",
    provider: useGemini ? "gemini-flash" : "claude-vision",
    ...evaluateExtraction("vision", combinedRawText, { minWordCount: 1 }),
    pageResults,
  };
}

function resolvePipelineResult({ textStage, ocrStage, visionStage }) {
  if (textStage.quality === "good") {
    return {
      text: textStage.text,
      source: "text",
      confidence: buildConfidence(textStage.wordCount, "text", false),
      warnings: [],
      characterNames: textStage.characterNames,
      wordCount: textStage.wordCount,
      limited: false,
      uploadMessage: null,
      diagnostics: { textStage, ocrStage, visionStage },
    };
  }

  if (ocrStage && ocrStage.quality === "good") {
    return {
      text: ocrStage.text,
      source: "ocr",
      confidence: buildConfidence(ocrStage.wordCount, "ocr", false),
      warnings: [IMAGE_BASED_READING_MESSAGE],
      characterNames: ocrStage.characterNames,
      wordCount: ocrStage.wordCount,
      limited: false,
      uploadMessage: IMAGE_BASED_READING_MESSAGE,
      diagnostics: { textStage, ocrStage, visionStage },
    };
  }

  if (visionStage && visionStage.wordCount > 0) {
    const limited = visionStage.wordCount < 50;
    return {
      text: visionStage.text,
      source: "vision",
      confidence: buildConfidence(visionStage.wordCount, "vision", limited),
      warnings: [IMAGE_BASED_READING_MESSAGE],
      characterNames: visionStage.characterNames,
      wordCount: visionStage.wordCount,
      limited,
      uploadMessage: IMAGE_BASED_READING_MESSAGE,
      diagnostics: { textStage, ocrStage, visionStage },
    };
  }

  const bestStage =
    [visionStage, ocrStage, textStage]
      .filter(Boolean)
      .sort((a, b) => (b?.wordCount || 0) - (a?.wordCount || 0))[0] || textStage;

  return {
    text: bestStage?.text || "",
    source: bestStage?.source || "vision",
    confidence: "low",
    warnings: [],
    characterNames: bestStage?.characterNames || [],
    wordCount: bestStage?.wordCount || 0,
    limited: true,
    uploadMessage: null,
    diagnostics: { textStage, ocrStage, visionStage },
  };
}

async function ingestPdf(pdfBuffer, options = {}) {
  const textStage = await extractTextStage(pdfBuffer);
  if (textStage.quality === "good") {
    return resolvePipelineResult({ textStage, ocrStage: null, visionStage: null });
  }

  const rendered = await convertPdfToImages(pdfBuffer, options);
  try {
    const ocrStage = await extractOcrStage(rendered.pages);
    if (ocrStage.quality === "good") {
      return resolvePipelineResult({ textStage, ocrStage, visionStage: null });
    }

    const visionStage = await extractVisionStage(rendered.pages, ocrStage.pageResults);
    return resolvePipelineResult({ textStage, ocrStage, visionStage });
  } finally {
    rendered.cleanup();
  }
}

module.exports = {
  IMAGE_BASED_READING_MESSAGE,
  ingestPdf,
  __private: {
    cleanPipelineText,
    evaluateExtraction,
    resolvePipelineResult,
    getRepeatedTokenRatio,
    getMetadataLineRatio,
    getEntropyRatio,
  },
};
