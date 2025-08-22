const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { sequelize, testConnection } = require('./database/connection');
require('dotenv').config();

const app = express();

// ---------- Security & logging ----------
app.use(helmet());
app.use(morgan('combined'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// ---------- CORS ----------
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://prep101.app', 'https://www.prep101.app']
    : ['http://localhost:3000','http://localhost:3001','http://localhost:3002'],
  credentials: true
}));

// ---------- Body parsing ----------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------- Static test pages (optional) ----------
app.use(express.static('public'));

// ---------- DB init ----------
const initializeDatabase = async () => {
  await testConnection();
  if (process.env.NODE_ENV === 'development') {
    await sequelize.sync({ alter: true });
    console.log('✅ Database synced');
  } else {
    await sequelize.sync();
  }
};
initializeDatabase();

// ---------- Minimal Upload + Generate wiring (DEV) ----------
const multer = require('multer');
const pdfParse = require('pdf-parse');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadedTexts = global.uploadedTexts || new Map();
global.uploadedTexts = uploadedTexts;

/**
 * POST /api/upload/pdf
 * form-data field: pdf
 * Response: { ok, uploadId, textLength, filename }
 */
app.post('/api/upload/pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok:false, message: 'No PDF uploaded (field name must be "pdf")' });
    }
    const parsed = await pdfParse(req.file.buffer).catch(() => ({ text: '' }));
    const text = parsed.text || '';
    const uploadId = 'upl_' + Date.now();
    uploadedTexts.set(uploadId, text);
    return res.json({ ok:true, uploadId, textLength: text.length, filename: req.file.originalname });
  } catch (err) {
    console.error('PDF parse error:', err);
    return res.status(500).json({ ok:false, message: 'Failed to process PDF' });
  }
});

/**
 * POST /api/guides/generate
 * Body: { uploadId? , sceneText?, characterName, productionTitle, productionType }
 * Response: { ok, guideHtml }
 */
app.post('/api/guides/generate', async (req, res) => {
  const { uploadId, sceneText, characterName='Unknown', productionTitle='Unknown', productionType='Unknown' } = req.body || {};
  let text = sceneText || '';
  if (!text && uploadId) text = uploadedTexts.get(uploadId) || '';
  if (!text) return res.status(400).json({ ok:false, message:'Upload a PDF first or provide sceneText' });

  const guideHtml = `
    <h1>${characterName}'s Audition Guide</h1>
    <p><strong>Project:</strong> ${productionTitle} – ${productionType}</p>
    <h2>Extracted Scene Text (first 400 chars):</h2>
    <pre>${text.slice(0, 400).replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}${text.length>400?'…':''}</pre>
    <p>✅ Upload + Generate path is working.</p>`;
  return res.json({ ok:true, guideHtml });
});

// ---------- Mount your other routers AFTER the specific routes above ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/guides', require('./routes/guides'));

// IMPORTANT: comment this out if it defines a /pdf stub that conflicts
// app.use('/api/upload', require('./routes/upload'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 PREP101 server running on port ${PORT}`);
});