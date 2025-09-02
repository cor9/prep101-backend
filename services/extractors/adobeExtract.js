// server/services/extractors/adobeExtract.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFJob,
  ExtractPDFParams,
  ExtractElementType,
  PDFServicesResponse,
} = require('@adobe/pdfservices-node-sdk');

function creds() {
  const p = process.env.ADOBE_PDF_CREDENTIALS_PATH || './pdfservices-api-credentials.json';
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return new ServicePrincipalCredentials({
    clientId: raw.client_credentials.client_id,
    clientSecret: raw.client_credentials.client_secret,
  });
}

async function extractWithAdobe(pdfBuffer) {
  if (process.env.ADOBE_PDF_EXTRACT_ENABLED !== 'true') {
    return { method: 'adobe-extract', success: false, reason: 'disabled' };
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adobe-extract-'));
  const inputPath = path.join(tmp, 'input.pdf');
  fs.writeFileSync(inputPath, pdfBuffer);

  const pdfServices = new PDFServices({ credentials: creds() });

  const inputAsset = await pdfServices.upload({
    readStream: fs.createReadStream(inputPath),
    mimeType: MimeType.PDF,
  });

  const params = new ExtractPDFParams({
    elementsToExtract: [ExtractElementType.TEXT],
    getStylingInfo: false,
  });

  const job = new ExtractPDFJob({ inputAsset, params });
  const pollingURL = await pdfServices.submit({ job });

  const r = await pdfServices.getJobResult({
    pollingURL,
    resultType: PDFServicesResponse.ResultType.ExtractPDF,
  });

  const resultAsset = r.result.asset;
  const content = await pdfServices.getContent({ asset: resultAsset });

  // The extract job gives a ZIP; we'll parse the JSON manifest quickly
  const unzip = require('unzipper');
  const entries = {};
  await new Promise((resolve, reject) => {
    content.readStream
      .pipe(unzip.Parse())
      .on('entry', async entry => {
        const name = entry.path;
        const chunks = [];
        entry.on('data', d => chunks.push(d));
        entry.on('end', () => (entries[name] = Buffer.concat(chunks)));
        entry.on('error', reject);
        entry.autodrain();
      })
      .on('close', resolve)
      .on('error', reject);
  });

  // Adobe provides structured JSON at "structuredData.json"
  const structured = entries['structuredData.json'];
  if (!structured) {
    return { method: 'adobe-extract', success: false, reason: 'no structuredData.json' };
  }

  const data = JSON.parse(structured.toString('utf8'));

  // Concatenate text in reading order
  // Adobe's structure varies; this robustly walks blocks
  const lines = [];
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.Text) lines.push(node.Text);
    if (node.Elements) walk(node.Elements);
    if (node.Children) walk(node.Children);
    if (node.Table) walk(node.Table);
    if (node.Cells) walk(node.Cells);
    if (node.Paragraphs) walk(node.Paragraphs);
    if (node.Lines) walk(node.Lines);
    if (node.Spans) walk(node.Spans);
    if (node.content) walk(node.content);
  }
  walk(data.elements || data);

  let text = lines
    .join('\n')
    .replace(/\r/g, '')
    // strip common junk (Adjust patterns as you see them)
    .replace(/Sides by Breakdown Services - Actors Access/gi, '')
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const wc = (text.match(/\b\w+\b/g) || []).length;
  const confidence = wc > 400 ? 'high' : wc > 200 ? 'medium' : 'low';

  return {
    method: 'adobe-extract',
    success: true,
    text,
    wordCount: wc,
    confidence,
  };
}

module.exports = { extractWithAdobe };
