const fetch = require("node-fetch");
const FormData = require("form-data");

function decodePageBase64(page = {}) {
  const imageBase64 = page.image_base64 || page.imageBase64 || "";
  if (!imageBase64) {
    throw new Error("Purifier response missing page image_base64.");
  }
  return {
    page: page.page,
    width: page.width,
    height: page.height,
    imageBuffer: Buffer.from(imageBase64, "base64"),
  };
}

async function purifyPdfWithWorker(pdfBuffer, options = {}) {
  const workerUrl = process.env.PDF_PURIFIER_URL;
  if (!workerUrl) {
    throw new Error("PDF_PURIFIER_URL is not configured.");
  }

  const form = new FormData();
  form.append("file", pdfBuffer, {
    filename: options.filename || "upload.pdf",
    contentType: "application/pdf",
  });
  form.append("dpi", String(options.dpi || 300));
  form.append("max_pages", String(options.maxPages || 10));

  const response = await fetch(`${workerUrl.replace(/\/$/, "")}/purify`, {
    method: "POST",
    headers: form.getHeaders(),
    body: form,
    timeout: options.timeoutMs || 120000,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Purifier request failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  const pages = Array.isArray(payload.pages) ? payload.pages.map(decodePageBase64) : [];
  if (!pages.length) {
    throw new Error("Purifier returned no pages.");
  }

  return {
    pages,
    source: "python-purifier",
  };
}

module.exports = {
  purifyPdfWithWorker,
};
