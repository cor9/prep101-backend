// server/services/extractors/adobeExtract.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const unzipper = require('unzipper');
const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFJob,
  ExtractPDFParams,
  ExtractElementType,
  PDFServicesResponse,
} = require('@adobe/pdfservices-node-sdk');

const ADOBE_ENABLED = process.env.ADOBE_PDF_EXTRACT_ENABLED === 'true';
const TOP_BOTTOM_BAND = 0.08; // drop top/bottom 8% to kill headers/footers

function getCredentials() {
  const credentialsPath = process.env.ADOBE_PDF_CREDENTIALS_PATH || './pdfservices-api-credentials.json';
  const raw = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  return new ServicePrincipalCredentials({
    clientId: raw.client_credentials.client_id,
    clientSecret: raw.client_credentials.client_secret,
  });
}

function isWatermarkText(s) {
  if (!s) return false;
  const t = String(s).trim();
  if (!t) return true;
  const patterns = [
    /Sides by Breakdown Services - Actors Access/i,
    /Page \d+\s+of\s+\d+/i,
    /B\d{3,}CR-\w*/i,
    /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i,
    /This document.*confidential/i,
    // Enhanced patterns for better watermark detection
    /\b\d{5,}\b/g, // Repeated numeric watermarks
    /^\d{1,2}:\d{2}:\d{2}\s*$/i, // Timestamps
    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/i, // Date-time stamps
    /^[0-9\s\-_:]+$/i, // Lines with only numbers, spaces, dashes, underscores, colons
    /[A-Za-z]{1,2}\s*$/i, // Single or double letter lines
  ];
  return patterns.some(re => re.test(t));
}

// Enhanced text cleaning function
function cleanExtractedText(text) {
  if (!text) return '';
  
  return text
    .replace(/\r/g, '')
    .replace(/Sides by Breakdown Services - Actors Access/gi, '')
    .replace(/Page \d+ of \d+/gi, '')
    // Enhanced cleaning patterns
    .replace(/\b\d{5,}\b/g, '') // Remove numeric watermarks
    .replace(/^\d{1,2}:\d{2}:\d{2}\s*$/gm, '') // Remove timestamp lines
    .replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*$/gm, '') // Remove date-time lines
    .replace(/^[0-9\s\-_:]+$/gm, '') // Remove lines with only numbers/symbols
    .replace(/^[A-Za-z]{1,2}\s*$/gm, '') // Remove single/double letter lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function summarize(text) {
  return (text || '').replace(/\s+/g, ' ').slice(0, 180);
}

async function parseStructuredZip(stream) {
  // return parsed JSON from structuredData.json
  return new Promise((resolve, reject) => {
    const files = {};
    stream
      .pipe(unzipper.Parse())
      .on('entry', entry => {
        const name = entry.path;
        const chunks = [];
        entry.on('data', d => chunks.push(d));
        entry.on('end', () => { files[name] = Buffer.concat(chunks); });
        entry.on('error', reject);
        entry.autodrain();
      })
      .on('close', () => {
        if (!files['structuredData.json']) return reject(new Error('structuredData.json missing'));
        try {
          const json = JSON.parse(files['structuredData.json'].toString('utf8'));
          resolve(json);
        } catch (e) { reject(e); }
      })
      .on('error', reject);
  });
}

function collectTextWithCharBounds(structured) {
  const elements = structured?.elements || structured || [];
  const nodes = [];
  const perPageHeights = new Map(); // pageNum -> maxY observed

  function visit(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    const text = node.Text;
    const bounds = node.CharBounds;
    const pathSeg = node.Path && Array.isArray(node.Path) ? node.Path[0] : null;
    const page = node.Page || node.page || (pathSeg && (pathSeg.page || pathSeg.Page)) || 1;
    if (Array.isArray(bounds) && bounds.length) {
      // Track page height as max y1 seen
      const maxY = Math.max(...bounds.map(b => b[3]));
      const prev = perPageHeights.get(page) || 0;
      if (maxY > prev) perPageHeights.set(page, maxY);
    }
    if (text) nodes.push({ text, bounds, page });

    ['Elements','Children','Paragraphs','Lines','Spans','Cells','Table','content'].forEach(k => {
      if (node[k]) visit(node[k]);
    });
  }
  visit(elements);

  const kept = [];
  for (const n of nodes) {
    if (!n.text || isWatermarkText(n.text)) continue;

    if (Array.isArray(n.bounds) && n.bounds.length) {
      const yMax = perPageHeights.get(n.page) || Math.max(...n.bounds.map(b => b[3]));
      const yMin = Math.min(...n.bounds.map(b => b[1]));
      const yUpper = Math.max(...n.bounds.map(b => b[3]));
      const avgY = (yMin + yUpper) / 2;
      if (avgY < yMax * TOP_BOTTOM_BAND) continue; // top band
      if (avgY > yMax * (1 - TOP_BOTTOM_BAND)) continue; // bottom band
    }
    kept.push(n.text);
  }

  let text = cleanExtractedText(kept.join('\n'));

  const wordCount = (text.match(/\b\w+\b/g) || []).length;
  const confidence = wordCount > 600 ? 'high' : wordCount > 300 ? 'medium' : 'low';
  const characterPattern = /^[A-Z][A-Z\s]+:/gm;
  const characterNames = [...new Set((text.match(characterPattern) || []).map(n => n.replace(':', '').trim()))];
  return { text, wordCount, confidence, characterNames };
}

async function extractWithAdobe(pdfBuffer) {
  try {
    if (!ADOBE_ENABLED) throw new Error('Adobe Extract disabled');

    // temp file only to upload (streaming also OK)
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'adobe-extract-'));
    const inputPath = path.join(tmp, 'input.pdf');
    fs.writeFileSync(inputPath, pdfBuffer);

    const pdfServices = new PDFServices({ credentials: getCredentials() });

    const inputAsset = await pdfServices.upload({
      readStream: fs.createReadStream(inputPath),
      mimeType: MimeType.PDF,
    });

    const params = new ExtractPDFParams({
      elementsToExtract: [ExtractElementType.TEXT, ExtractElementType.TABLES],
      getCharBounds: true,
    });

    const job = new ExtractPDFJob({ inputAsset, params });
    const pollingURL = await pdfServices.submit({ job });

    const r = await pdfServices.getJobResult({
      pollingURL,
      resultType: 'ExtractPDFResult',
    });

    const resultAsset = r.result.asset;
    const streamAsset = await pdfServices.getContent({ asset: resultAsset });

    const structured = await parseStructuredZip(streamAsset.readStream);
    const { text, wordCount, confidence, characterNames } = collectTextWithCharBounds(structured);
    if (!text) throw new Error('Adobe returned empty text');

    return {
      success: true,
      method: 'adobe',
      text,
      wordCount,
      confidence,
      characterNames,
      preview: summarize(text),
    };
  } catch (err) {
    // Throw to trigger fallback in caller
    err.message = `Adobe Extract failed: ${err.message}`;
    throw err;
  }
}

module.exports = { extractWithAdobe };
