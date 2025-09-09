const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { config, validateConfig } = require('./config/config');
const { sequelize, testConnection } = require('./database/connection');

// Import middleware
const { 
  authLimiter, 
  apiLimiter, 
  paymentLimiter, 
  speedLimiter, 
  corsOptions, 
  securityHeaders 
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const guidesRoutes = require('./routes/guides');
const uploadRoutes = require('./routes/upload');
const stripeWebhookRoute = require('./routes/stripeWebhook');

// Import models
const User = require('./models/User');
const Guide = require('./models/Guide');

const app = express();

// Validate configuration
validateConfig();

// Security middleware
app.use(securityHeaders);

// CORS
app.use(cors(corsOptions));

// Stripe webhook route – raw body required (must come before express.json())
app.use('/api', stripeWebhookRoute);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/payments', paymentLimiter);
app.use('/api', apiLimiter);
app.use(speedLimiter);

// File upload configuration
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// In-memory storage for uploads (for guide generation)
const uploads = new Map();

// PDF Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    console.log(`📄 Processing: ${req.file.originalname}`);
    
    // Basic text extraction (you can enhance this with pdf-parse or Adobe OCR)
    const textContent = req.file.buffer.toString('utf8');
    
    if (!textContent || textContent.trim().length < 10) {
      return res.status(400).json({ error: 'Could not extract readable text from PDF' });
    }

    const uploadId = Date.now().toString();
    uploads.set(uploadId, {
      filename: req.file.originalname,
      sceneText: textContent.trim(),
      extractionMethod: 'basic',
      uploadTime: new Date(),
      wordCount: textContent.trim().split(/\s+/).length
    });

    console.log(`✅ Extracted ${textContent.length} characters`);

    res.json({
      uploadId,
      filename: req.file.originalname,
      textLength: textContent.length,
      wordCount: uploads.get(uploadId).wordCount,
      extractionMethod: 'basic',
      extractionConfidence: 'medium',
      characterNames: [],
      preview: textContent.substring(0, 300) + '...',
      success: true
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// Load methodology files for RAG
let methodologyDatabase = {};

function loadMethodologyFiles() {
  const methodologyPath = path.join(__dirname, 'methodology');
  
  if (!fs.existsSync(methodologyPath)) {
    console.error('❌ Methodology folder not found! Please create ./methodology/ with your files');
    return;
  }
  
  console.log('📚 Loading methodology files for RAG...');
  
  try {
    const files = fs.readdirSync(methodologyPath);
    console.log(`📁 Found ${files.length} methodology files:`, files);
    
    files.forEach(filename => {
      const filePath = path.join(methodologyPath, filename);
      const content = fs.readFileSync(filePath, 'utf8');
      
      methodologyDatabase[filename] = {
        content: content,
        filename: filename,
        size: content.length,
        type: determineFileType(filename),
        keywords: extractKeywords(filename, content)
      };
      
      console.log(`✅ Loaded: ${filename} (${content.length} characters)`);
    });
    
    console.log(`🧠 RAG Database Ready: ${Object.keys(methodologyDatabase).length} methodology files loaded`);
    
  } catch (error) {
    console.error('❌ Failed to load methodology files:', error);
  }
}

function determineFileType(filename) {
  const name = filename.toLowerCase();
  if (name.includes('character')) return 'character-development';
  if (name.includes('scene')) return 'scene-work';
  if (name.includes('comedy')) return 'comedy';
  if (name.includes('uta')) return 'uta-hagen';
  if (name.includes('cece') || name.includes('eloise')) return 'example-guide';
  if (name.includes('guide') || name.includes('example')) return 'example-guide';
  return 'general-methodology';
}

function extractKeywords(filename, content) {
  const keywords = [];
  const name = filename.toLowerCase();
  
  if (name.includes('character')) keywords.push('character', 'development', 'psychology');
  if (name.includes('scene')) keywords.push('scene', 'breakdown', 'analysis');
  if (name.includes('comedy')) keywords.push('comedy', 'timing', 'humor');
  if (name.includes('uta')) keywords.push('uta hagen', '9 questions', 'methodology');
  
  const contentLower = content.toLowerCase();
  if (contentLower.includes('subtext')) keywords.push('subtext');
  if (contentLower.includes('objective')) keywords.push('objectives');
  if (contentLower.includes('physicality')) keywords.push('physicality');
  if (contentLower.includes('voice')) keywords.push('voice');
  if (contentLower.includes('audition')) keywords.push('audition');
  if (contentLower.includes('self-tape')) keywords.push('self-tape');
  
  return keywords;
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/guides', guidesRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: config.server.env,
    database: sequelize.authenticate() ? 'connected' : 'disconnected'
  });
});

// Guide generation endpoint with subscription checking
app.post('/api/guides/generate', async (req, res) => {
  try {
    // Check if user is authenticated
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify token and get user
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check subscription limits
    if (user.subscription === 'free' && user.guidesUsed >= user.guidesLimit) {
      return res.status(403).json({ 
        message: 'Monthly guide limit reached. Upgrade your subscription for more guides.',
        guidesUsed: user.guidesUsed,
        guidesLimit: user.guidesLimit
      });
    }

    const { 
      uploadId, 
      uploadIds, 
      characterName, 
      productionTitle, 
      productionType, 
      roleSize, 
      genre, 
      storyline, 
      characterBreakdown, 
      callbackNotes, 
      focusArea 
    } = req.body;

    if (!uploadId && !uploadIds) {
      return res.status(400).json({ message: 'No upload ID provided' });
    }

    // Get upload data from memory storage
    const uploadData = uploads.get(uploadId) || uploads.get(uploadIds?.[0]);
    if (!uploadData) {
      return res.status(400).json({ message: 'Upload data not found or expired' });
    }

    // Generate a basic guide content (you can enhance this with AI)
    const guideContent = `
      <h1>Audition Guide for ${characterName}</h1>
      <h2>Production: ${productionTitle}</h2>
      <h3>Type: ${productionType}</h3>
      <h3>Genre: ${genre}</h3>
      <h3>Role Size: ${roleSize}</h3>
      
      <h2>Script Analysis</h2>
      <p>Script length: ${uploadData.sceneText.length} characters</p>
      <p>Word count: ${uploadData.wordCount} words</p>
      
      <h2>Character Notes</h2>
      <p>Storyline: ${storyline || 'Not provided'}</p>
      <p>Character Breakdown: ${characterBreakdown || 'Not provided'}</p>
      <p>Focus Area: ${focusArea || 'Balanced approach'}</p>
      
      <h2>Script Content</h2>
      <pre>${uploadData.sceneText.substring(0, 1000)}...</pre>
    `;

    // Create guide data for database
    const guideData = {
      userId: user.id,
      guideId: `guide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      characterName,
      productionTitle,
      productionType,
      roleSize: roleSize || 'supporting',
      genre,
      storyline,
      characterBreakdown,
      callbackNotes,
      focusArea,
      sceneText: uploadData.sceneText,
      generatedHtml: guideContent,
      status: 'completed'
    };

    // Save guide to database
    const guide = await Guide.create(guideData);

    // Increment guides used for free users
    if (user.subscription === 'free') {
      await user.increment('guidesUsed');
    }

    // Clean up upload data from memory
    uploads.delete(uploadId);
    if (uploadIds) {
      uploadIds.forEach(id => uploads.delete(id));
    }

    res.json({
      success: true,
      guideId: guide.id,
      guideContent: guide.generatedHtml,
      generatedAt: new Date(),
      metadata: {
        characterName,
        productionTitle,
        productionType,
        guideLength: guide.generatedHtml.length
      }
    });

  } catch (error) {
    console.error('Guide generation error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Guide generation failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: config.server.env === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// For Vercel serverless functions, export the app instead of starting a server
module.exports = app;