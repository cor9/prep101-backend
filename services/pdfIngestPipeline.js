const fs = require("fs");
const os = require("os");
const path = require("path");
const fetch = require("node-fetch");
const pdfParse = require("pdf-parse");
const FormData = require("form-data");

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
const IMAGE_BASED_RECOVERY_SUCCESS_MESSAGE =
  "Image-based reading recovered usable script text.";
const MIN_IMAGE_RECOVERY_WORDS = 80;

function getWordCount(text = "") {
  return (String(text).match(/\b[\w']+\b/g) || []).length;
}

function hasScreenplayStructure(text = "") {
  const source = String(text || "");
  if (!source.trim()) return false;

  const hasSceneHeading = /\b(INT|EXT)\./i.test(source);
  const colonCueCount = (source.match(/^[ \t]*[A-Z][A-Z0-9\s'().\-]{1,30}:/gm) || []).length;
  if (colonCueCount >= 2) return true;

  // Standalone uppercase cue line followed by likely dialogue line.
  const lines = source.split("\n");
  const cueStopWords = new Set([
    "PLEASE",
    "OPTIONAL",
    "LABELING",
    "SCENE",
    "SLATE",
    "READ",
    "NOTES",
    "TAKES",
    "AUDITION",
  ]);
  let cueCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const cue = lines[index].trim();
    if (!cue) continue;
    if (cue.length < 2 || cue.length > 32) continue;
    if (!/^[A-Z][A-Z\s'().\-]+$/.test(cue)) continue;
    const words = cue.split(/\s+/).filter(Boolean);
    if (words.length > 4) continue;
    if (words.some((word) => cueStopWords.has(word))) continue;
    if (isLikelyWatermarkLine(cue)) continue;
    if (/^(INT|EXT|EST|CUT TO|FADE (IN|OUT)|ANGLE ON|INSERT|DISSOLVE TO)\b/.test(cue)) {
      continue;
    }

    let next = "";
    for (let lookahead = index + 1; lookahead < lines.length; lookahead += 1) {
      next = lines[lookahead].trim();
      if (next) break;
    }
    if (!next || isLikelyWatermarkLine(next)) continue;

    const looksLikeDialogue =
      next.startsWith("(") ||
      /^[A-Z]?[a-z][^:]{1,160}$/.test(next) ||
      /^["'(]/.test(next);

    if (looksLikeDialogue) cueCount += 1;
    if (cueCount >= 2) return true;
  }

  return Boolean(hasSceneHeading && cueCount >= 1);
}

function buildCharacterNames(text = "") {
  const source = String(text || "");
  const names = new Set();
  const lines = source.split("\n");

  // Format: JAMIE:
  const withColon = source.match(/^[ \t]*([A-Z][A-Z0-9\s'().\-]{1,30}):/gm) || [];
  withColon.forEach((line) => {
    const cleaned = line.replace(":", "").trim();
    if (!cleaned || isLikelyWatermarkLine(cleaned)) return;
    names.add(cleaned);
  });

  // Format: standalone screenplay cue line:
  //     JAMIE
  //     (O.S.)
  //     I don't know.
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (line.includes(":")) continue;
    if (line.length < 2 || line.length > 32) continue;
    if (!/^[A-Z][A-Z0-9\s'().\-]+$/.test(line)) continue;
    if (/\d{2,}/.test(line) || /[\/\\|]/.test(line)) continue;
    if (isLikelyWatermarkLine(line)) continue;
    if (/^(INT|EXT|EST|CUT TO|FADE (IN|OUT)|ANGLE ON|INSERT|DISSOLVE TO)\b/.test(line)) continue;
    if (line.split(/\s+/).length > 4) continue;

    let next = "";
    for (let lookahead = index + 1; lookahead < lines.length; lookahead += 1) {
      next = lines[lookahead].trim();
      if (next) break;
    }
    if (!next) continue;

    const looksLikeDialogue =
      next.startsWith("(") ||
      /^[A-Z]?[a-z][^:]{1,160}$/.test(next) ||
      /^["'(]/.test(next);

    if (looksLikeDialogue) {
      names.add(line);
    }
  }

  return [...names];
}

function cleanPipelineText(text = "") {
  const raw = String(text || "");
  const conservative = raw
    .replace(/B\d{3,}[A-Z0-9-]*/gi, "")
    .replace(/[A-Z]?[A-Z0-9]{5,}[-_][A-Z0-9-]*/g, "")
    .replace(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}.*/g, "")
    .replace(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const aggressive = scrubWatermarks(
    conservative
      .split("\n")
      .filter((line) => line.trim().length > 3)
      .filter((line) => !/^[A-Z0-9\-]+$/.test(line.trim()))
      .join("\n")
  );

  const conservativeCleaned = scrubWatermarks(conservative);
  const aggressiveWords = getWordCount(aggressive);
  const conservativeWords = getWordCount(conservativeCleaned);

  // If aggressive filters wiped out too much, keep the conservative version.
  if (aggressiveWords < 20 && conservativeWords >= 20) {
    return conservativeCleaned;
  }

  return aggressive;
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
  const rawWordCount = getWordCount(rawText);
  let finalText = cleanedText;
  let wordCount = getWordCount(cleanedText);
  let characterNames = buildCharacterNames(cleanedText);

  // Safety valve: if cleaning stripped too much but raw text is substantial,
  // keep a lightly normalized raw version instead of returning near-empty text.
  if (wordCount < 20 && rawWordCount >= 80) {
    finalText = String(rawText || "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    wordCount = getWordCount(finalText);
    characterNames = buildCharacterNames(finalText);
  }
  const repeatedTokenRatio = getRepeatedTokenRatio(rawText);
  const metadataLineRatio = getMetadataLineRatio(rawText);
  const entropyRatio = getEntropyRatio(finalText);
  const watermarkInterference = analyzeWatermarkInterference(rawText);
  const qualityAssessment = assessQuality(finalText);
  const hasScriptSignals =
    characterNames.length >= 2 ||
    hasScreenplayStructure(finalText);

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
    text: finalText,
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

async function extractClaudeDocumentStage(pdfBuffer) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) {
    return {
      stage: "document",
      source: "document",
      provider: "claude-document",
      skipped: true,
      text: "",
      rawText: "",
      wordCount: 0,
      quality: "needs_escalation",
      failures: ["anthropicKeyMissing"],
      characterNames: [],
    };
  }

  const prompt = `Extract only the usable audition script text from this PDF.

INCLUDE:
- Character names
- Dialogue
- Scene headings
- Essential stage directions

IGNORE:
- Watermarks
- Dates/timestamps
- IDs/codes
- Repeated headers/footers

Return plain text only. No commentary.`;

  const requestedModel =
    process.env.ANTHROPIC_DOCUMENT_MODEL ||
    process.env.CLAUDE_DOCUMENT_MODEL ||
    DEFAULT_CLAUDE_MODEL;
  const fallbackModels = [
    requestedModel,
    "claude-3-5-sonnet-latest",
    "claude-3-5-sonnet-20241022",
  ].filter(Boolean);
  const modelsToTry = [...new Set(fallbackModels)];
  let lastError = "unknown_document_error";
  const isAbortError = (error) => {
    const message = String(error?.message || "");
    return (
      error?.name === "AbortError" ||
      /aborted/i.test(message) ||
      /The user aborted a request/i.test(message)
    );
  };

  for (const model of modelsToTry) {
    const configuredTimeout = Number(process.env.CLAUDE_DOCUMENT_TIMEOUT_MS || 120000);
    const timeoutMs = Number.isFinite(configuredTimeout)
      ? Math.min(210000, Math.max(20000, configuredTimeout))
      : 120000;
    const timeoutAttempts = [timeoutMs, Math.min(240000, timeoutMs + 45000)];

    for (let attemptIndex = 0; attemptIndex < timeoutAttempts.length; attemptIndex += 1) {
      const currentTimeoutMs = timeoutAttempts[attemptIndex];
      const controller = new AbortController();
      try {
        const timeout = setTimeout(() => controller.abort(), currentTimeoutMs);
        let response;
        try {
          response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            signal: controller.signal,
            body: JSON.stringify({
              model,
              max_tokens: Math.min(DEFAULT_CLAUDE_MAX_TOKENS, 8192),
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    {
                      type: "document",
                      source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: pdfBuffer.toString("base64"),
                      },
                    },
                  ],
                },
              ],
            }),
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `model=${model} status=${response.status} ${errorText}`;
          break;
        }

        const json = await response.json();
        const rawText =
          json?.content?.map((part) => part?.text || "").join("\n") || "";
        const evaluated = evaluateExtraction("document", rawText, {
          minWordCount: 50,
        });
        if (evaluated.wordCount > 0) {
          return {
            source: "document",
            provider: `claude-document:${model}`,
            ...evaluated,
          };
        }

        lastError = `model=${model} returned_empty_document_text`;
        break;
      } catch (error) {
        const hasNextAttempt = attemptIndex < timeoutAttempts.length - 1;
        if (isAbortError(error) && hasNextAttempt) {
          lastError = `model=${model} aborted_timeout_${currentTimeoutMs}ms_retrying`;
          continue;
        }
        lastError = `model=${model} ${error.message || "request_failed"}`;
        break;
      } finally {
        controller.abort();
      }
    }
  }

  {
    return {
      stage: "document",
      source: "document",
      provider: "claude-document",
      text: "",
      rawText: "",
      wordCount: 0,
      quality: "needs_escalation",
      failures: [`documentExtractionFailed:${lastError}`],
      characterNames: [],
    };
  }
}

async function extractGeminiDocumentStage(pdfBuffer) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      stage: "document",
      source: "document",
      provider: "gemini-document",
      skipped: true,
      text: "",
      rawText: "",
      wordCount: 0,
      quality: "needs_escalation",
      failures: ["geminiKeyMissing"],
      characterNames: [],
    };
  }

  const prompt = `Extract only the usable audition script text from this PDF.

INCLUDE:
- Character names
- Dialogue
- Scene headings
- Essential stage directions

IGNORE:
- Watermarks
- Dates/timestamps
- IDs/codes
- Repeated headers/footers

Return plain text only. No commentary.`;

  try {
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
                    mimeType: "application/pdf",
                    data: pdfBuffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        stage: "document",
        source: "document",
        provider: "gemini-document",
        text: "",
        rawText: "",
        wordCount: 0,
        quality: "needs_escalation",
        failures: [`geminiDocumentFailed:${response.status}:${errorText}`],
        characterNames: [],
      };
    }

    const json = await response.json();
    const rawText =
      json?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("\n") || "";

    return {
      source: "document",
      provider: "gemini-document",
      ...evaluateExtraction("document", rawText, { minWordCount: 50 }),
    };
  } catch (error) {
    return {
      stage: "document",
      source: "document",
      provider: "gemini-document",
      text: "",
      rawText: "",
      wordCount: 0,
      quality: "needs_escalation",
      failures: [`geminiDocumentFailed:${error.message || "request_failed"}`],
      characterNames: [],
    };
  }
}

function extractOpenAIResponseText(payload = {}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.output)) {
    const chunks = [];
    for (const item of payload.output) {
      if (!item || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (typeof part?.text === "string" && part.text.trim()) {
          chunks.push(part.text.trim());
        }
      }
    }
    if (chunks.length) return chunks.join("\n\n");
  }

  return "";
}

async function uploadPdfToOpenAI(pdfBuffer, apiKey) {
  const form = new FormData();
  form.append("purpose", "assistants");
  form.append("file", pdfBuffer, {
    filename: "upload.pdf",
    contentType: "application/pdf",
  });

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`openaiFileUploadFailed:${response.status}:${err}`);
  }

  const payload = await response.json();
  return payload?.id;
}

async function deleteOpenAIFile(fileId, apiKey) {
  if (!fileId) return;
  try {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (_error) {
    // no-op
  }
}

async function extractOpenAIDocumentStage(pdfBuffer) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return {
      stage: "document",
      source: "document",
      provider: "openai-document",
      skipped: true,
      text: "",
      rawText: "",
      wordCount: 0,
      quality: "needs_escalation",
      failures: ["openaiKeyMissing"],
      characterNames: [],
    };
  }

  const model = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1";
  const prompt = `Extract only the usable audition script text from this PDF.

INCLUDE:
- Character names
- Dialogue
- Scene headings
- Essential stage directions

IGNORE:
- Watermarks
- Dates/timestamps
- IDs/codes
- Repeated headers/footers

Return plain text only. No commentary.`;

  let fileId = null;
  try {
    fileId = await uploadPdfToOpenAI(pdfBuffer, apiKey);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 8192,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_file", file_id: fileId },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        stage: "document",
        source: "document",
        provider: "openai-document",
        text: "",
        rawText: "",
        wordCount: 0,
        quality: "needs_escalation",
        failures: [`openaiDocumentFailed:${response.status}:${err}`],
        characterNames: [],
      };
    }

    const payload = await response.json();
    const rawText = extractOpenAIResponseText(payload);

    return {
      source: "document",
      provider: `openai-document:${model}`,
      ...evaluateExtraction("document", rawText, { minWordCount: 50 }),
    };
  } catch (error) {
    return {
      stage: "document",
      source: "document",
      provider: "openai-document",
      text: "",
      rawText: "",
      wordCount: 0,
      quality: "needs_escalation",
      failures: [`openaiDocumentFailed:${error.message || "request_failed"}`],
      characterNames: [],
    };
  } finally {
    await deleteOpenAIFile(fileId, apiKey);
  }
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
  const textFailures = new Set(textStage?.failures || []);
  const textHasSevereNoise =
    textFailures.has("watermarkInterference") ||
    textFailures.has("metadataHeavyLines") ||
    textFailures.has("repeatedTokens>20%") ||
    textFailures.has("lowEntropy");

  // Be permissive when the text layer already looks script-like, even if
  // watermark heuristics are noisy. This avoids false fallback mode.
  if (
    textStage &&
    textStage.wordCount >= 60 &&
    !textHasSevereNoise &&
    ((textStage.characterNames || []).length >= 1 ||
      hasScreenplayStructure(textStage.text))
  ) {
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

  if (
    ocrStage &&
    ocrStage.quality === "good" &&
    (ocrStage.wordCount || 0) >= MIN_IMAGE_RECOVERY_WORDS
  ) {
    return {
      text: ocrStage.text,
      source: "ocr",
      confidence: buildConfidence(ocrStage.wordCount, "ocr", false),
      warnings: [IMAGE_BASED_RECOVERY_SUCCESS_MESSAGE],
      characterNames: ocrStage.characterNames,
      wordCount: ocrStage.wordCount,
      limited: false,
      uploadMessage: IMAGE_BASED_RECOVERY_SUCCESS_MESSAGE,
      diagnostics: { textStage, ocrStage, visionStage },
    };
  }

  if (visionStage && (visionStage.wordCount || 0) >= MIN_IMAGE_RECOVERY_WORDS) {
    const limited = visionStage.wordCount < 50;
    return {
      text: visionStage.text,
      source: "vision",
      confidence: buildConfidence(visionStage.wordCount, "vision", limited),
      warnings: [IMAGE_BASED_RECOVERY_SUCCESS_MESSAGE],
      characterNames: visionStage.characterNames,
      wordCount: visionStage.wordCount,
      limited,
      uploadMessage: IMAGE_BASED_RECOVERY_SUCCESS_MESSAGE,
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

  // If text extraction is weak, try direct PDF document extraction via Claude
  // before image conversion (which can fail on some serverless runtimes).
  const [claudeDocumentStage, geminiDocumentStage, openaiDocumentStage] = await Promise.all([
    extractClaudeDocumentStage(pdfBuffer),
    extractGeminiDocumentStage(pdfBuffer),
    extractOpenAIDocumentStage(pdfBuffer),
  ]);
  const documentCandidates = [
    claudeDocumentStage,
    geminiDocumentStage,
    openaiDocumentStage,
  ].filter(Boolean);
  const documentStage =
    documentCandidates
      .slice()
      .sort((a, b) => (b?.wordCount || 0) - (a?.wordCount || 0))[0] || null;
  if (documentStage && documentStage.quality === "good") {
    return {
      text: documentStage.text,
      source: "document",
      confidence: buildConfidence(documentStage.wordCount, "document", false),
      warnings: [],
      characterNames: documentStage.characterNames || [],
      wordCount: documentStage.wordCount || 0,
      limited: false,
      uploadMessage: null,
      diagnostics: {
        textStage,
        claudeDocumentStage,
        geminiDocumentStage,
        openaiDocumentStage,
        documentStage,
        ocrStage: null,
        visionStage: null,
      },
    };
  }

  // Avoid local PDF rasterization on Vercel serverless; prefer managed extractors there.
  const allowLocalRaster =
    options.allowLocalRaster !== false && !process.env.VERCEL;

  const imagePipelinePromise = (async () => {
    if (!allowLocalRaster) {
      return resolvePipelineResult({
        textStage,
        ocrStage: {
          source: "ocr",
          stage: "ocr",
          text: "",
          rawText: "",
          wordCount: 0,
          quality: "needs_escalation",
          failures: ["localRasterDisabledOnVercel"],
          characterNames: [],
          pageResults: [],
        },
        visionStage: {
          source: "vision",
          stage: "vision",
          text: "",
          rawText: "",
          wordCount: 0,
          quality: "needs_escalation",
          failures: ["localRasterDisabledOnVercel"],
          characterNames: [],
          pageResults: [],
        },
      });
    }

    const rendered = await convertPdfToImages(pdfBuffer, options);
    try {
      const ocrStage = await extractOcrStage(rendered.pages);
      if (ocrStage.quality === "good") {
        return resolvePipelineResult({
          textStage,
          ocrStage,
          visionStage: null,
          documentStage,
        });
      }

      const visionStage = await extractVisionStage(rendered.pages, ocrStage.pageResults);
      const resolved = resolvePipelineResult({ textStage, ocrStage, visionStage });
      resolved.diagnostics = {
        ...(resolved.diagnostics || {}),
        claudeDocumentStage,
        geminiDocumentStage,
        documentStage,
      };
      return resolved;
    } finally {
      rendered.cleanup();
    }
  })();

  const timeoutMs = options.maxPipelineMs || 18000;
  const bestBaseStage =
    [
      documentStage,
      openaiDocumentStage,
      geminiDocumentStage,
      claudeDocumentStage,
      textStage,
    ]
      .filter(Boolean)
      .sort((a, b) => (b?.wordCount || 0) - (a?.wordCount || 0))[0] || textStage;
  const timeoutResult = {
    text: bestBaseStage?.text || textStage.text || "",
    source: bestBaseStage?.source || (textStage.wordCount > 0 ? "text" : "document"),
    confidence: "low",
    warnings: [],
    characterNames: bestBaseStage?.characterNames || textStage.characterNames || [],
    wordCount: bestBaseStage?.wordCount || textStage.wordCount || 0,
    limited: true,
    uploadMessage: null,
    diagnostics: {
      textStage,
      claudeDocumentStage,
      geminiDocumentStage,
      openaiDocumentStage,
      documentStage,
      timeoutMs,
      timeoutFallback: true,
      allowLocalRaster,
    },
  };

  return Promise.race([
    imagePipelinePromise,
    new Promise((resolve) => setTimeout(() => resolve(timeoutResult), timeoutMs)),
  ]);
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
