const multer = require('multer');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

dotenv.config();

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
      'http://127.0.0.1:3002'
    ];
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Origin','X-Requested-With','Content-Type','Accept','Authorization','Cache-Control','Pragma']
}));

// ----------------- Middleware -----------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------- DB -----------------
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false,
});

// Models
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true }},
  password: { type: DataTypes.STRING, allowNull: false },
  subscription: { type: DataTypes.STRING, defaultValue: 'free' },
  guidesUsed: { type: DataTypes.INTEGER, defaultValue: 0 },
  guidesLimit: { type: DataTypes.INTEGER, defaultValue: 3 }
});

const Guide = sequelize.define('Guide', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  guideId: { type: DataTypes.STRING, allowNull: false, unique: true },
  characterName: { type: DataTypes.STRING, allowNull: false },
  productionTitle: { type: DataTypes.STRING, allowNull: false },
  productionType: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false }
});

User.hasMany(Guide, { foreignKey: 'userId' });
Guide.belongsTo(User, { foreignKey: 'userId' });

// ----------------- Health -----------------
app.get('/api/health', (req,res) => {
  res.json({ message:'Backend running', timestamp:new Date(), database:'Postgres', status:'healthy' });
});

// ----------------- Auth -----------------
app.post('/api/auth/register', async (req,res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message:'All fields required' });
    if (password.length < 6) return res.status(400).json({ message:'Password too short' });

    const existing = await User.findOne({ where:{ email } });
    if (existing) return res.status(400).json({ message:'User already exists' });

    const hashed = await bcrypt.hash(password, 12);
    const newUser = await User.create({ name,email,password:hashed });

    const token = jwt.sign({ userId:newUser.id }, process.env.JWT_SECRET, { expiresIn:'24h' });
    res.status(201).json({ message:'User registered', token, user:{ id:newUser.id, name, email } });
  } catch(e) {
    console.error(e); res.status(500).json({ message:'Registration error', error:e.message });
  }
});

app.post('/api/auth/login', async (req,res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message:'Email & password required' });
    const user = await User.findOne({ where:{ email } });
    if (!user) return res.status(400).json({ message:'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message:'Invalid credentials' });
    const token = jwt.sign({ userId:user.id }, process.env.JWT_SECRET, { expiresIn:'24h' });
    res.json({ message:'Login successful', token, user:{ id:user.id, name:user.name, email:user.email } });
  } catch(e) { console.error(e); res.status(500).json({ message:'Login error', error:e.message }); }
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
    <pre>${text.slice(0, 400).replace(/[<>&]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))}${text.length > 400 ? '…' : ''}</pre>
    <p>✅ Upload + Generate path is working.</p>
  `;
  return res.json({ ok: true, guideHtml });
});