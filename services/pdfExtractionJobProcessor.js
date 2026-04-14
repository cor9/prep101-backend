const { purifyPdfWithWorker } = require("./pdfPurifierClient");
const { extractStructuredOcr } = require("./documentOcrProviders");
const { mapOcrBlocksToScreenplay } = require("./screenplaySpatialMapper");
const { ingestPdf } = require("./pdfIngestPipeline");

function buildFallbackBlocksFromText(text = "") {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    let x = 150;
    if (/^(INT|EXT|EST|INT\/EXT|I\/E)\./i.test(line)) x = 120;
    else if (/^[A-Z][A-Z0-9 '\-()]{1,40}$/.test(line)) x = 400;
    else if (/^\(.*\)$/.test(line)) x = 300;
    else if (line.length < 50) x = 250;

    return {
      text: line,
      bbox: { x, y: 100 + index * 20, width: Math.max(60, line.length * 8), height: 16 },
      page: 1,
      pageWidth: 1000,
      pageHeight: Math.max(1400, 120 + lines.length * 24),
    };
  });
}

async function processPdfExtractionJob(jobPayload = {}) {
  const { pdfBase64, filename } = jobPayload;
  if (!pdfBase64) {
    throw new Error("Job payload missing pdfBase64.");
  }

  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  try {
    const purified = await purifyPdfWithWorker(pdfBuffer, {
      filename: filename || "upload.pdf",
      dpi: Number(process.env.PDF_PURIFIER_DPI || 300),
      maxPages: Number(process.env.PDF_PURIFIER_MAX_PAGES || 12),
    });

    const ocrPurified = await extractStructuredOcr(purified.pages);
    const purifiedText = (ocrPurified.blocks || []).map((b) => b.text || "").join("\n");
    const hasImagePlaceholderNoise = /!\[img-\d+\.jpeg\]/i.test(purifiedText);
    const purifiedWordCount = (purifiedText.match(/\b[\w']+\b/g) || []).length;
    const shouldTryRaw =
      hasImagePlaceholderNoise ||
      purifiedWordCount < 80 ||
      /^(\d+\s+[\d.,-]+\s*)+$/m.test(purifiedText);

    let ocr = ocrPurified;
    if (shouldTryRaw) {
      const rawPages = purified.pages.map((page) => ({
        ...page,
        imageBuffer: page.rawImageBuffer || page.imageBuffer,
      }));
      const ocrRaw = await extractStructuredOcr(rawPages);
      const rawText = (ocrRaw.blocks || []).map((b) => b.text || "").join("\n");
      const rawWordCount = (rawText.match(/\b[\w']+\b/g) || []).length;
      if (rawWordCount > purifiedWordCount) {
        ocr = {
          ...ocrRaw,
          fallbackReason: ocrPurified.provider
            ? `Switched from purified OCR provider ${ocrPurified.provider} due to low-quality text.`
            : "Switched from purified OCR path due to low-quality text.",
        };
      }
    }

    const mapped = mapOcrBlocksToScreenplay(ocr.blocks);

    return {
      filename: filename || "upload.pdf",
      provider: ocr.provider,
      fallbackReason: ocr.fallbackReason || null,
      pageCount: purified.pages.length,
      blockCount: ocr.blocks.length,
      mapped,
      raw: {
        ocr: ocr.raw,
      },
    };
  } catch (cvPipelineError) {
    const ingest = await ingestPdf(pdfBuffer, {
      maxPages: 6,
      maxPipelineMs: 45000,
      allowLocalRaster: !process.env.VERCEL,
    });
    const fallbackBlocks = buildFallbackBlocksFromText(ingest.text || "");
    const mapped = mapOcrBlocksToScreenplay(fallbackBlocks);

    return {
      filename: filename || "upload.pdf",
      provider: "fallback-text-reconstruction",
      fallbackReason: cvPipelineError.message,
      pageCount: 1,
      blockCount: fallbackBlocks.length,
      mapped,
      raw: {
        ingestDiagnostics: ingest.diagnostics || null,
      },
    };
  }
}

module.exports = {
  processPdfExtractionJob,
};
