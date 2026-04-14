const { purifyPdfWithWorker } = require("./pdfPurifierClient");
const { extractStructuredOcr } = require("./documentOcrProviders");
const { mapOcrBlocksToScreenplay } = require("./screenplaySpatialMapper");

async function processPdfExtractionJob(jobPayload = {}) {
  const { pdfBase64, filename } = jobPayload;
  if (!pdfBase64) {
    throw new Error("Job payload missing pdfBase64.");
  }

  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  const purified = await purifyPdfWithWorker(pdfBuffer, {
    filename: filename || "upload.pdf",
    dpi: Number(process.env.PDF_PURIFIER_DPI || 300),
    maxPages: Number(process.env.PDF_PURIFIER_MAX_PAGES || 12),
  });

  const ocr = await extractStructuredOcr(purified.pages);
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
}

module.exports = {
  processPdfExtractionJob,
};
