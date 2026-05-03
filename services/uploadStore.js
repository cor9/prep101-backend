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

module.exports = { uploads, storeUpload, getUpload, hasUpload };
