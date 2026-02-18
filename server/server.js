const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const path = require('path');

// Load env vars
dotenv.config();

// Import shared database connection and models
// Note: We are in server/ directory, so we go up one level
const { sequelize } = require('../database/connection');
const User = require('../models/User');
const Guide = require('../models/Guide');

const app = express();
const PORT = process.env.PORT || 5001;

// ----------------- CORS -----------------
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      process.env.BASE_URL,
      'https://prep101-frontend.vercel.app'
    ];
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow Vercel previews
    if (origin.endsWith('.vercel.app')) return callback(null, true);

    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma']
}));

// ----------------- Middleware -----------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------- Health -----------------
app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend running', timestamp: new Date(), database: 'Postgres', status: 'healthy' });
});

// ----------------- Auth -----------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password too short' });

    // Check if models are loaded
    if (!User) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    // Note: Password hashing is handled by User model hooks (beforeCreate)
    // We pass the plain password here.
    const newUser = await User.create({ name, email, password });

    const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ message: 'User registered', token, user: { id: newUser.id, name, email } });
  } catch (e) {
    console.error(e); res.status(500).json({ message: 'Registration error', error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email & password required' });

    // Check if models are loaded
    if (!User) {
      return res.status(500).json({ message: 'Database connection failed' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Use model method or bcrypt directly
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Login error', error: e.message }); }
});

// ----------------- Upload + Generate -----------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadedTexts = new Map();

// quick quality check: if too few letters, treat as garbage
function looksLikeGarbage(s = '') {
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  return s.length < 50 || letters / Math.max(1, s.length) < 0.15;
}

// Try real text first (pdf-parse). If junk, try OCR as a fallback.
async function extractText(buffer) {
  const parsed = await pdfParse(buffer).catch(() => ({ text: '' }));
  if (parsed.text && !looksLikeGarbage(parsed.text)) return parsed.text;

  try {
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    if (text && !looksLikeGarbage(text)) return text;
  } catch (_) { /* ignore */ }

  return parsed.text || '';
}

app.post('/api/upload/pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No PDF uploaded' });

    const text = await extractText(req.file.buffer);
    const uploadId = 'upl_' + Date.now();
    uploadedTexts.set(uploadId, { text, filename: req.file.originalname });

    return res.json({
      ok: true,
      uploadId,
      textLength: text.length,
      filename: req.file.originalname
    });
  } catch (e) {
    console.error('PDF parse/OCR error:', e);
    return res.status(500).json({ ok: false, message: 'Failed to process PDF', error: e.message });
  }
});

app.post('/api/upload/text', (req, res) => {
  const text = (req.body && req.body.text) ? String(req.body.text) : '';
  if (!text) return res.status(400).json({ ok: false, message: 'No text provided' });
  const uploadId = 'upl_' + Date.now();
  uploadedTexts.set(uploadId, { text, filename: 'manual.txt' });
  return res.json({ ok: true, uploadId, textLength: text.length, filename: 'manual.txt' });
});

app.post('/api/guides/generate', async (req, res) => {
  const {
    uploadId,
    sceneText,
    characterName = 'Unknown',
    productionTitle = 'Unknown',
    productionType = 'Unknown'
  } = req.body || {};

  let text = sceneText || '';
  if (!text && uploadId) text = uploadedTexts.get(uploadId)?.text || '';
  if (!text) return res.status(400).json({ ok: false, message: 'Upload a PDF or provide sceneText' });

  const guideHtml = `
    <h1>${characterName}'s Audition Guide</h1>
    <p><b>Project:</b> ${productionTitle} — ${productionType}</p>
    <h2>Extracted Scene Text (first 400 chars):</h2>
    <pre>${text.slice(0, 400).replace(/[<>&]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[s]))}${text.length > 400 ? '…' : ''}</pre>
    <p>✅ Upload + Generate path is working.</p>
  `;
  return res.json({ ok: true, guideHtml });
});

// ----------------- Startup -----------------
if (sequelize) {
  sequelize.sync().then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  }).catch(e => console.error('DB Sync Error:', e));
} else {
  console.error('❌ Failed to connect to database. Server starting without DB...');
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT} (No DB)`);
  });
}