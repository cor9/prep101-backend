const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PDFServicesSdk = require('@adobe/pdfservices-node-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// PostgreSQL connection using your existing credentials
const sequelize = new Sequelize(process.env.DATABASE_URL || process.env.POSTGRES_URI, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  },
  logging: false
});

// User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subscription: {
    type: DataTypes.ENUM('free', 'premium'),
    defaultValue: 'free'
  },
  guidesUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  guidesLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  }
});

// Guide model
const Guide = sequelize.define('Guide', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  guideId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  characterName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  productionTitle: {
    type: DataTypes.STRING,
    allowNull: false
  },
  productionType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  sceneText: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});

// Associations
User.hasMany(Guide, { foreignKey: 'userId' });
Guide.belongsTo(User, { foreignKey: 'userId' });

// File upload configuration
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// In-memory storage for uploads (temporary)
const uploads = {};

// Create temp directory for Adobe PDF processing
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Adobe PDF Services configuration
let adobeCredentials;
try {
  adobeCredentials = PDFServicesSdk.Credentials
    .serviceAccountCredentialsBuilder()
    .fromFile(path.join(__dirname, "pdfservices-api-credentials.json"))
    .build();
  console.log('✅ Adobe PDF Services credentials loaded');
} catch (error) {
  console.log('⚠️ Adobe PDF Services credentials not found, will use fallback OCR');
}

// Adobe PDF text extraction
async function extractTextWithAdobe(pdfBuffer, filename) {
  if (!adobeCredentials) {
    throw new Error('Adobe credentials not available');
  }

  console.log('🔍 Using Adobe PDF Services for premium text extraction...');
  
  const executionContext = PDFServicesSdk.ExecutionContext.create(adobeCredentials);
  const extractPDFOperation = PDFServicesSdk.ExtractPDF.Operation.createNew();

  // Create temporary file for Adobe SDK
  const tempPath = path.join(tempDir, `${Date.now()}_${filename}`);
  fs.writeFileSync(tempPath, pdfBuffer);
  
  const input = PDFServicesSdk.FileRef.createFromLocalFile(tempPath);
  extractPDFOperation.setInput(input);

  // Configure extraction options for acting sides
  const options = new PDFServicesSdk.ExtractPDF.options.ExtractPdfOptions.Builder()
    .addElementsToExtract(PDFServicesSdk.ExtractPDF.options.ExtractElementType.TEXT)
    .addElementsToExtract(PDFServicesSdk.ExtractPDF.options.ExtractElementType.TABLES)
    .addElementsToExtractRenditions(PDFServicesSdk.ExtractPDF.options.ExtractRenditionsElementType.TABLES)
    .build();
  
  extractPDFOperation.setOptions(options);

  try {
    const result = await extractPDFOperation.execute(executionContext);
    const resultPath = path.join(tempDir, `extracted_${Date.now()}.zip`);
    await result.saveAsFile(resultPath);
    
    // Extract and read the JSON content
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(resultPath);
    const structuredData = JSON.parse(zip.readAsText('structuredData.json'));
    
    // Process the extracted elements
    const textElements = structuredData.elements.filter(element => element.Text);
    const fullText = textElements.map(element => element.Text).join(' ');
    
    // Identify different text types (useful for acting sides)
    const characterNames = textElements
      .filter(element => element.Font && element.Font.weight >= 700) // Bold text likely character names
      .map(element => element.Text);
    
    const stageDirections = textElements
      .filter(element => element.Text.includes('(') && element.Text.includes(')'))
      .map(element => element.Text);

    // Clean up temp files
    fs.unlinkSync(tempPath);
    fs.unlinkSync(resultPath);

    console.log('✅ Adobe PDF extraction completed');
    console.log(`📊 Extracted: ${fullText.length} characters, ${characterNames.length} character names, ${stageDirections.length} stage directions`);
    
    return {
      text: fullText,
      characterNames: [...new Set(characterNames)], // Remove duplicates
      stageDirections,
      structure: structuredData.elements,
      confidence: 'high',
      method: 'adobe'
    };

  } catch (error) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

// Fallback PDF extraction using pdf-parse
async function extractTextBasic(pdfBuffer) {
  const pdfParse = require('pdf-parse');
  console.log('📖 Using basic PDF extraction...');
  
  const pdfData = await pdfParse(pdfBuffer);
  
  return {
    text: pdfData.text,
    characterNames: [], // Basic extraction can't identify these
    stageDirections: [],
    structure: null,
    confidence: 'medium',
    method: 'basic'
  };
}

// Main PDF processing endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('📄 Processing PDF upload...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`File received: ${req.file.originalname} (${req.file.size} bytes)`);

    let extractionResult;
    
    try {
      // Try Adobe PDF Services first (premium quality)
      extractionResult = await extractTextWithAdobe(req.file.buffer, req.file.originalname);
    } catch (adobeError) {
      console.log('Adobe extraction failed, using fallback method:', adobeError.message);
      
      try {
        // Fallback to basic pdf-parse
        extractionResult = await extractTextBasic(req.file.buffer);
      } catch (fallbackError) {
        console.error('All extraction methods failed:', fallbackError);
        return res.status(500).json({ 
          error: 'Could not extract text from PDF. Please ensure the file is not password-protected or corrupted.' 
        });
      }
    }

    const { text: sceneText, characterNames, stageDirections, confidence, method } = extractionResult;
    
    if (!sceneText || sceneText.trim().length < 10) {
      return res.status(400).json({ 
        error: 'Could not extract readable text from PDF. The file may be an image-based PDF or corrupted.' 
      });
    }
    
    // Store the extracted data
    const uploadId = Date.now().toString();
    uploads[uploadId] = {
      filename: req.file.originalname,
      sceneText: sceneText.trim(),
      characterNames,
      stageDirections,
      extractionConfidence: confidence,
      extractionMethod: method,
      uploadTime: new Date(),
      wordCount: sceneText.trim().split(/\s+/).length
    };
    
    console.log(`✅ PDF processed: ${sceneText.length} characters, ${uploads[uploadId].wordCount} words`);
    console.log(`📊 Extraction: ${confidence} confidence using ${method} method`);
    
    res.json({
      uploadId,
      filename: req.file.originalname,
      textLength: sceneText.length,
      wordCount: uploads[uploadId].wordCount,
      characterNames: characterNames.slice(0, 5), // Send first 5 for preview
      extractionConfidence: confidence,
      extractionMethod: method,
      preview: sceneText.substring(0, 300) + (sceneText.length > 300 ? '...' : ''),
      success: true
    });
    
  } catch (error) {
    console.error('❌ PDF processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF. Please try again or contact support.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Guide generation endpoint with Anthropic integration
app.post('/api/guides/generate', async (req, res) => {
  try {
    const { uploadId, characterName, productionTitle, productionType, additionalNotes } = req.body;
    
    if (!uploadId || !uploads[uploadId]) {
      return res.status(400).json({ error: 'Invalid upload ID or expired session' });
    }

    const uploadData = uploads[uploadId];
    
    console.log('🎭 Generating professional acting guide...');
    console.log(`Character: ${characterName}`);
    console.log(`Production: ${productionTitle} (${productionType})`);
    console.log(`Script length: ${uploadData.wordCount} words`);
    console.log(`OCR method: ${uploadData.extractionMethod}`);

    // Generate acting guide using your Corey Ralston methodology
    const guideContent = await generateActingGuide({
      sceneText: uploadData.sceneText,
      characterName,
      productionTitle,
      productionType,
      additionalNotes,
      characterNames: uploadData.characterNames,
      stageDirections: uploadData.stageDirections,
      extractionConfidence: uploadData.extractionConfidence,
      extractionMethod: uploadData.extractionMethod
    });

    // Save to database
    try {
      const guide = await Guide.create({
        guideId: `guide_${uploadId}`,
        characterName,
        productionTitle,
        productionType,
        content: guideContent,
        sceneText: uploadData.sceneText,
        userId: null // Add user ID when authentication is implemented
      });
      
      console.log('✅ Guide saved to PostgreSQL database');
    } catch (dbError) {
      console.log('⚠️ Database save failed, continuing without persistence:', dbError.message);
    }

    res.json({
      success: true,
      guideId: `guide_${uploadId}`,
      guideContent,
      generatedAt: new Date(),
      metadata: {
        characterName,
        productionTitle,
        productionType,
        scriptWordCount: uploadData.wordCount,
        extractionConfidence: uploadData.extractionConfidence,
        extractionMethod: uploadData.extractionMethod,
        characterNamesFound: uploadData.characterNames.length
      }
    });

  } catch (error) {
    console.error('❌ Guide generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate acting guide. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Acting guide generation using Anthropic API and your methodology
async function generateActingGuide(data) {
  const Anthropic = require('@anthropic-ai/sdk');
  
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Your expert acting coach prompt based on Corey Ralston's methodology
  const prompt = `You are an expert acting coach trained by Corey Ralston (child actor, talent manager, and industry educator). Your job is to analyze audition sides provided in PDF format and deliver a detailed, customized preparation guide to the actor.

AUDITION DETAILS:
- Character: ${data.characterName}
- Production: ${data.productionTitle}
- Production Type: ${data.productionType}
- Additional Notes: ${data.additionalNotes || 'None'}

SCRIPT TEXT:
${data.sceneText}

TECHNICAL INFO:
- Text extraction method: ${data.extractionMethod}
- Extraction confidence: ${data.extractionConfidence}
- Character names found: ${data.characterNames.join(', ') || 'None detected'}
- Stage directions found: ${data.stageDirections.length} instances

Generate a comprehensive acting guide that includes:

1. CHARACTER ANALYSIS using Uta Hagen's 9 Questions
2. SCENE BREAKDOWN with beat analysis
3. PRODUCTION TYPE SPECIFIC GUIDANCE (single-cam vs multi-cam sitcom, drama, etc.)
4. SELF-TAPE DIRECTION if applicable
5. MOTIVATIONAL COACHING in Corey's supportive style

Format as HTML with proper styling for professional presentation. Make it specific to this script and character, not generic advice.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Anthropic API error:', error);
    
    // Fallback guide if API fails
    return generateFallbackGuide(data);
  }
}

// Fallback guide generation
function generateFallbackGuide(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Acting Guide for ${data.characterName}</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #2dd4bf; border-bottom: 2px solid #2dd4bf; }
            h2 { color: #0f766e; margin-top: 30px; }
            .metadata { background: #f0fdfa; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .scene-text { background: #f8f9fa; padding: 15px; border-left: 4px solid #2dd4bf; }
            .character-analysis { background: #fff7ed; padding: 15px; border-radius: 8px; }
        </style>
    </head>
    <body>
        <h1>🎭 Acting Guide for ${data.characterName}</h1>
        
        <div class="metadata">
            <h2>Production Information</h2>
            <p><strong>Production:</strong> ${data.productionTitle}</p>
            <p><strong>Type:</strong> ${data.productionType}</p>
            <p><strong>Script Analysis:</strong> ${data.extractionMethod} extraction (${data.extractionConfidence} confidence)</p>
            <p><strong>Characters Found:</strong> ${data.characterNames.join(', ') || 'Analyzing script structure...'}</p>
        </div>

        <h2>📋 Scene Analysis</h2>
        <div class="scene-text">
            <p><strong>Script Text (${data.sceneText.split(' ').length} words):</strong></p>
            <p>${data.sceneText.substring(0, 500)}${data.sceneText.length > 500 ? '...' : ''}</p>
        </div>

        <div class="character-analysis">
            <h2>🎯 Character Development</h2>
            <h3>Uta Hagen's 9 Questions for ${data.characterName}:</h3>
            <ol>
                <li><strong>Who am I?</strong> - Character identity and background</li>
                <li><strong>What time is it?</strong> - Time period and circumstances</li>
                <li><strong>Where am I?</strong> - Physical and emotional environment</li>
                <li><strong>What surrounds me?</strong> - Objects and atmosphere</li>
                <li><strong>What are given circumstances?</strong> - Script facts</li>
                <li><strong>What are my relationships?</strong> - Character connections</li>
                <li><strong>What do I want?</strong> - Character objective</li>
                <li><strong>What is in my way?</strong> - Obstacles and conflict</li>
                <li><strong>What do I do to get what I want?</strong> - Actions and tactics</li>
            </ol>
        </div>

        <h2>🎬 ${data.productionType} Specific Guidance</h2>
        <p>Tailored direction for ${data.productionType} performance style and energy.</p>

        <h2>🎥 Self-Tape Preparation</h2>
        <p>Professional self-tape guidance based on the character and scene requirements.</p>

        <p><em>Guide generated on ${new Date().toLocaleDateString()} using PREP101 professional acting guide system.</em></p>
    </body>
    </html>
  `;
}

// Database connection
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected to Render database');
    await sequelize.sync();
    console.log('✅ Database tables synced');
    return true;
  } catch (error) {
    console.log('⚠️ PostgreSQL connection failed:', error.message);
    console.log('📝 App will run with in-memory storage');
    return false;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'running', 
    timestamp: new Date(),
    activeUploads: Object.keys(uploads).length,
    adobeEnabled: !!adobeCredentials,
    database: 'PostgreSQL'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5001;

async function startServer() {
  const dbConnected = await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 PREP101 backend running on port ${PORT}`);
    console.log('📋 Available endpoints:');
    console.log('  POST /api/upload - PDF processing with Adobe OCR');
    console.log('  POST /api/guides/generate - Professional guide generation');
    console.log('  GET /api/health - Health check');
    console.log(`📊 Features enabled:`);
    console.log(`  ✅ PostgreSQL Database: ${dbConnected ? 'Connected' : 'Fallback mode'}`);
    console.log(`  ✅ Adobe PDF OCR: ${adobeCredentials ? 'Enabled' : 'Fallback to basic'}`);
    console.log(`  ✅ Anthropic AI: ${process.env.ANTHROPIC_API_KEY ? 'Enabled' : 'Fallback mode'}`);
    console.log(`  ✅ Corey Ralston methodology: Active`);
  });
}

startServer();