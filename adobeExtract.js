// server/adobeExtract.js
const {
  ServicePrincipalCredentials, PDFServices, MimeType,
  ExtractPDFJob, ExtractPDFParams, ExtractRenditionsElementType, ExtractPDFResult
} = require("@adobe/pdfservices-node-sdk");
const { Readable } = require("stream");
const fs = require("fs");

async function extractWithAdobe(pdfBuffer) {
  try {
    const creds = JSON.parse(fs.readFileSync("./pdfservices-api-credentials.json","utf8"));
    const credentials = new ServicePrincipalCredentials({
      clientId: creds.client_credentials.client_id,
      clientSecret: creds.client_credentials.client_secret
    });
    const pdfServices = new PDFServices({ credentials });

    const inputAsset = await pdfServices.upload({
      readStream: Readable.from(pdfBuffer),
      mimeType: MimeType.PDF
    });

    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractRenditionsElementType.TEXT, ExtractRenditionsElementType.TABLES],
      ocrLang: "en-US"
    });

    const job = new ExtractPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });
    const { result } = await pdfServices.getJobResult({ pollingURL, resultType: ExtractPDFResult });

    const jsonAsset = result.elementsInfo;
    const { readStream } = await pdfServices.getContent({ asset: jsonAsset });
    const chunks = [];
    for await (const c of readStream) chunks.push(c);
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    const lines = [];
    let lastPage = 1;
    for (const el of data.elements || []) {
      const pg = el.Path?.[0]?.page;
      if (typeof pg === "number" && pg !== lastPage) {
        lines.push(`\n\n=== PAGE ${pg} ===\n`);
        lastPage = pg;
      }
      if (el.Text) lines.push(el.Text.replace(/\r\n/g,"\n"));
    }

    const text = lines.join("\n").replace(/\n{3,}/g,"\n\n").trim();
    const wordCount = (text.match(/\b\w+\b/g) || []).length;
    const confidence = wordCount > 150 ? "high" : wordCount > 60 ? "medium" : "low";
    const speakers = [...new Set((text.match(/^(?:[A-Z][A-Z.\s]{1,40}):/gm) || []).map(s => s.replace(":","").trim()))];

    return { text, method: "adobe-extract", confidence, wordCount, speakers };
  } catch (error) {
    console.error('❌ Adobe Extract failed:', error);
    throw error;
  }
}

module.exports = { extractWithAdobe };
