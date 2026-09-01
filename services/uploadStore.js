/**
 * services/uploadStore.js
 *
 * Shared in-memory store for PDF uploads.
 * Imported by both simple-backend-rag.js (which writes uploads)
 * and routes/boldChoices.js (which needs pdfBase64 to enqueue jobs).
 *
 * NOTE: This is in-memory and does not survive process restarts.
 * On Vercel/serverless, entries may not persist across invocations —
 * which is fine because pdfBase64 is included directly in the job payload,
 * so the Render worker gets it from BullMQ, not from this store.
 */

const uploads = {};

const MAX_ENTRIES = 500;

function storeUpload(uploadId, data) {
  uploads[uploadId] = data;

  // Evict oldest entries if we exceed the limit
  const keys = Object.keys(uploads);
  if (keys.length > MAX_ENTRIES) {
    const oldest = keys.sort((a, b) => Number(a) - Number(b)).slice(0, keys.length - MAX_ENTRIES);
    oldest.forEach((k) => delete uploads[k]);
  }
}

function getUpload(uploadId) {
  return uploads[uploadId] || null;
}

function hasUpload(uploadId) {
  return Boolean(uploads[uploadId]);
}

// The store above is in-memory. On Vercel the /api/upload call and the later
// generate call can land on different lambda instances, so a lookup often
// misses and the deep read never receives the PDF it was built to read.
// Accept a client-supplied copy as a fallback, bounded and sniffed first.
const MAX_INLINE_PDF_BYTES = 3 * 1024 * 1024;

function resolveUploadPdf(uploadEntry, body = {}) {
  if (uploadEntry?.pdfBase64) {
    return {
      pdfBase64: uploadEntry.pdfBase64,
      filename: uploadEntry.filename || "upload.pdf",
      source: "upload-store",
    };
  }

  const inline = typeof body?.pdfBase64 === "string" ? body.pdfBase64.trim() : "";
  if (!inline) return null;

  let buffer;
  try {
    buffer = Buffer.from(inline.replace(/^data:[^,]*,/, ""), "base64");
  } catch (error) {
    console.warn("[UploadStore] Ignoring unreadable inline pdfBase64:", error.message);
    return null;
  }

  if (!buffer.length || buffer.length > MAX_INLINE_PDF_BYTES) return null;
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return null;

  return {
    // Re-encode so downstream always sees clean base64.
    pdfBase64: buffer.toString("base64"),
    filename:
      typeof body?.filename === "string" && body.filename.trim()
        ? body.filename.trim()
        : "upload.pdf",
    source: "request-body",
  };
}

module.exports = { uploads, storeUpload, getUpload, hasUpload, resolveUploadPdf, MAX_INLINE_PDF_BYTES };
