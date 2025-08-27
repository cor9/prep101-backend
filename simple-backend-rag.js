const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import new authentication and payment features
const { config, validateConfig } = require('./config/config');
const { 
  authLimiter, 
  apiLimiter, 
  paymentLimiter, 
  speedLimiter, 
  corsOptions, 
  securityHeaders 
} = require('./middleware/security');

const app = express();

// Validate configuration
validateConfig();

// Security middleware
app.use(securityHeaders);

// CORS - Allow ALL origins to eliminate CORS errors
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/auth', authLimiter);
app.use('/api/payments', paymentLimiter);
app.use('/api', apiLimiter);
app.use(speedLimiter);

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 10 * 1024 * 1024 } 
});

const uploads = {};

// Import and mount new API routes
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const guidesRoutes = require('./routes/guides');
const uploadRoutes = require('./routes/upload');
const betaRoutes = require('./routes/beta');

// Mount new API routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/guides', guidesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/beta', betaRoutes);

// Secure API key handling
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
  process.exit(1);
}

// Database initialization
const { sequelize, testConnection } = require('./database/connection');
const User = require('./models/User');
const Guide = require('./models/Guide');

// Load methodology files into memory for RAG
let methodologyDatabase = {};

async function initializeDatabase() {
  try {
    await testConnection();
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

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
      
      // Store with metadata for intelligent searching
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
  
  // Add filename-based keywords
  if (name.includes('character')) keywords.push('character', 'development', 'psychology');
  if (name.includes('scene')) keywords.push('scene', 'breakdown', 'analysis');
  if (name.includes('comedy')) keywords.push('comedy', 'timing', 'humor');
  if (name.includes('uta')) keywords.push('uta hagen', '9 questions', 'methodology');
  
  // Extract content-based keywords (simple approach)
  const contentLower = content.toLowerCase();
  if (contentLower.includes('subtext')) keywords.push('subtext');
  if (contentLower.includes('objective')) keywords.push('objectives');
  if (contentLower.includes('physicality')) keywords.push('physicality');
  if (contentLower.includes('voice')) keywords.push('voice');
  if (contentLower.includes('audition')) keywords.push('audition');
  if (contentLower.includes('self-tape')) keywords.push('self-tape');
  
  return keywords;
}

// Intelligent RAG search through methodology files
function searchMethodology(characterName, productionType, sceneContext) {
  console.log(`🔍 RAG Search: ${characterName} | ${productionType} | Context: ${sceneContext.substring(0, 100)}...`);
  
  const searchTerms = [
    characterName.toLowerCase(),
    productionType.toLowerCase(),
    'character development',
    'scene analysis',
    'uta hagen',
    'acting guide'
  ];
  
  // Add production-type specific terms
  if (productionType.toLowerCase().includes('comedy')) {
    searchTerms.push('comedy', 'timing', 'humor');
  }
  if (productionType.toLowerCase().includes('drama')) {
    searchTerms.push('drama', 'emotion', 'truth');
  }
  
  const relevantFiles = [];
  
  // Score each methodology file based on relevance
  Object.values(methodologyDatabase).forEach(file => {
    let relevanceScore = 0;
    const fileContent = file.content.toLowerCase();
    const fileKeywords = file.keywords;
    
    // Score based on keywords
    searchTerms.forEach(term => {
      if (fileKeywords.includes(term)) relevanceScore += 3;
      if (fileContent.includes(term)) relevanceScore += 1;
    });
    
    // Boost example guides
    if (file.type === 'example-guide') relevanceScore += 5;
    
    // Boost Uta Hagen methodology
    if (file.type === 'uta-hagen') relevanceScore += 4;
    
    // Boost character development for all requests
    if (file.type === 'character-development') relevanceScore += 3;
    
    if (relevanceScore > 0) {
      relevantFiles.push({
        ...file,
        relevanceScore: relevanceScore
      });
    }
  });
  
  // Sort by relevance and return top results
  const topResults = relevantFiles
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6); // Top 6 most relevant files
  
  console.log(`🎯 RAG Results: Found ${topResults.length} relevant methodology files`);
  topResults.forEach(file => {
    console.log(`   📄 ${file.filename} (score: ${file.relevanceScore}, type: ${file.type})`);
  });
  
  return topResults;
}

// PDF extraction
async function extractTextBasic(pdfBuffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(pdfBuffer);
  
  let cleanText = data.text
    .replace(/74222 - Aug 20, 2025 9:42 AM -/g, '')
    .replace(/B568CR-/g, '')
    .replace(/Sides by Breakdown Services - Actors Access/g, '')
    .replace(/Page \d+ of \d+/g, '')
    .replace(/\d{1,2}\.\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  const characterPattern = /^[A-Z][A-Z\s]+:/gm;
  const characterNames = [...new Set(
    (cleanText.match(characterPattern) || [])
      .map(name => name.replace(':', '').trim())
  )];
  
  return { 
    text: cleanText, 
    method: 'basic', 
    confidence: 'medium', 
    characterNames 
  };
}

// RAG-Enhanced Guide Generation using your methodology files
async function generateActingGuideWithRAG(data) {
  const fetch = require('node-fetch');
  
  try {
    console.log('🧠 Step 1: RAG - Searching your methodology files...');
    
    // Search your methodology files for relevant content
    const relevantMethodology = searchMethodology(
      data.characterName, 
      data.productionType, 
      data.sceneText
    );
    
    // Build context from your methodology files
    let methodologyContext = '';
    if (relevantMethodology.length > 0) {
      methodologyContext = relevantMethodology.map(file => 
        `=== COREY RALSTON METHODOLOGY: ${file.filename} (Relevance: ${file.relevanceScore}) ===\n${file.content}\n\n`
      ).join('');
    }
    
    console.log(`🎭 Step 2: Generating guide using ${relevantMethodology.length} methodology files...`);
    console.log(`📊 Total methodology context: ${methodologyContext.length} characters`);
    
    // Generate guide using your methodology as context
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: `You are PREP101, created by Corey Ralston. You have access to Corey's complete methodology and example guides below. Generate a professional acting guide that perfectly matches Corey's distinctive "Actor Motivator" coaching voice and methodology.

**COREY RALSTON'S METHODOLOGY & EXAMPLES:**
${methodologyContext}

**CURRENT AUDITION:**
CHARACTER: ${data.characterName}
PRODUCTION: ${data.productionTitle} (${data.productionType})

SCRIPT:
${data.sceneText}

**CRITICAL STYLE REQUIREMENTS - "ACTOR MOTIVATOR" VOICE:**

1. **Use Corey's signature empowering language:**
   - "This scene is DYNAMITE" / "This is GOLD" 
   - "Bold Choice:" callouts
   - "Gold Acting Moment:" highlights
   - Direct, confident statements

2. **Include specific action-oriented sections:**
   - "Key Emotional Notes:"
   - "Acting Choices to Make:"
   - "Three-Take Approach:" (Natural/Bold/Vulnerable)
   - "Pitfalls to Avoid:"

3. **Match the motivational coaching tone:**
   - Enthusiastic and encouraging
   - Industry-insider knowledge
   - Specific, actionable direction (not just analysis)
   - Personal connection to the character

4. **Use Corey's structural elements:**
   - Scene breakdowns with emotional beats
   - Physical direction and mannerisms
   - Subtext analysis
   - Self-tape specific guidance
   - "Why This Scene Works:" explanations

5. **Maintain professional authenticity:**
   - Reference specific acting techniques from the methodology
   - Include Uta Hagen's 9 Questions when relevant
   - Apply character development frameworks
   - Production-type specific guidance (comedy vs drama)

**GENERATE A COMPLETE HTML ACTING GUIDE THAT:**
- Sounds exactly like Corey Ralston wrote it personally
- Uses the "Actor Motivator" voice throughout
- Includes bold callouts and specific direction
- Feels encouraging and empowering
- Provides actionable choices, not just theory
- Matches the energy and enthusiasm of the example guides

**OUTPUT FORMAT:** Output ONLY the raw HTML content without any markdown formatting, code blocks, or \`\`\`html wrappers. The response should be pure HTML that can be directly inserted into a web page. Make it worthy of the PREP101 brand and indistinguishable from Corey's personal coaching.`
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ RAG Guide Generation Error:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.content && result.content[0] && result.content[0].text) {
      console.log(`✅ RAG Guide generated using Corey's methodology!`);
      console.log(`📊 Guide length: ${result.content[0].text.length} characters`);
      console.log(`🎯 Methodology files used: ${relevantMethodology.length}`);
     return result.content[0].text;
   } else {
     throw new Error('Invalid response format from API');
   }

 } catch (error) {
   console.error('❌ RAG guide generation failed:', error.message);
   throw error;
 }
}

// PDF Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
 try {
   if (!req.file || req.file.mimetype !== 'application/pdf') {
     return res.status(400).json({ error: 'Please upload a PDF file' });
   }

   console.log(`📄 Processing: ${req.file.originalname}`);
   
   const result = await extractTextBasic(req.file.buffer);
   
   if (!result.text || result.text.trim().length < 50) {
     return res.status(400).json({ 
       error: 'Could not extract enough readable text from PDF.' 
     });
   }

   const uploadId = Date.now().toString();
   uploads[uploadId] = {
     filename: req.file.originalname,
     sceneText: result.text.trim(),
     characterNames: result.characterNames,
     extractionMethod: result.method,
     uploadTime: new Date(),
     wordCount: result.text.trim().split(/\s+/).length
   };

   console.log(`✅ Extracted ${result.text.length} characters`);

   res.json({
     uploadId,
     filename: req.file.originalname,
     textLength: result.text.length,
     wordCount: uploads[uploadId].wordCount,
     characterNames: result.characterNames,
     preview: result.text.substring(0, 400) + '...',
     success: true
   });

 } catch (error) {
   console.error('❌ Upload error:', error);
   res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
 }
});

// RAG-Enhanced Guide Generation Endpoint
app.post('/api/guides/generate', async (req, res) => {
 try {
   const { uploadId, uploadIds, characterName, productionTitle, productionType, roleSize, genre, storyline, characterBreakdown, callbackNotes, focusArea } = req.body;
   
   // Handle both single and multiple upload IDs
   const uploadIdList = uploadIds || [uploadId];
   
   if (!uploadIdList.length || uploadIdList.some(id => !uploads[id])) {
     return res.status(400).json({ error: 'Invalid upload ID(s) or expired session' });
   }

   if (!characterName || !productionTitle || !productionType) {
     return res.status(400).json({ 
       error: 'Missing required fields' 
     });
   }

   // Combine all upload data
   const allUploadData = uploadIdList.map(id => uploads[id]);
   const combinedSceneText = allUploadData.map(data => data.sceneText).join('\n\n--- NEW SCENE ---\n\n');
   const combinedWordCount = allUploadData.reduce((total, data) => total + (data.wordCount || 0), 0);
   
   console.log(`🎭 COREY RALSTON RAG Guide Generation...`);
   console.log(`🎬 ${characterName} | ${productionTitle} (${productionType})`);
   console.log(`🧠 Using ${Object.keys(methodologyDatabase).length} methodology files`);

   const guideContent = await generateActingGuideWithRAG({
     sceneText: combinedSceneText,
     characterName: characterName.trim(),
     productionTitle: productionTitle.trim(),
     productionType: productionType.trim(),
     extractionMethod: allUploadData[0].extractionMethod
   });

   console.log(`✅ Corey Ralston RAG Guide Complete!`);

        // Save guide to database
     try {
       const Guide = require('./models/Guide');
       const User = require('./models/User');
       
       // Get user from auth token
       const authHeader = req.headers.authorization;
       let userId = null;
       
       if (authHeader && authHeader.startsWith('Bearer ')) {
         const token = authHeader.substring(7);
         const jwt = require('jsonwebtoken');
         const JWT_SECRET = process.env.JWT_SECRET;
         
         try {
           const decoded = jwt.verify(token, JWT_SECRET);
           userId = decoded.userId;
           
           // Verify user exists in database
           const user = await User.findByPk(userId);
           if (!user) {
             console.log('User not found in database, cannot save guide');
             throw new Error('User not found');
           }
         } catch (jwtError) {
           console.log('JWT verification failed or user not found, cannot save guide to database');
           throw new Error('Authentication required to save guide');
         }
       } else {
         console.log('No authorization header, cannot save guide to database');
         throw new Error('Authentication required to save guide');
       }

       const guideId = `corey_rag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
       
       const guide = await Guide.create({
         guideId,
         userId: userId, // Now guaranteed to be valid
         characterName: characterName.trim(),
         productionTitle: productionTitle.trim(),
         productionType: productionType.trim(),
         roleSize: roleSize || 'Supporting',
         genre: genre || 'Drama',
         storyline: storyline || '',
         characterBreakdown: characterBreakdown || '',
         callbackNotes: callbackNotes || '',
         focusArea: focusArea || '',
         sceneText: combinedSceneText,
         generatedHtml: guideContent
       });

     console.log(`💾 Guide saved to database with ID: ${guide.id}`);

     res.json({
       success: true,
       guideId: guide.guideId,
       guideContent: guideContent,
       generatedAt: new Date(),
       savedToDatabase: true,
       metadata: {
         characterName,
         productionTitle,
         productionType,
         scriptWordCount: combinedWordCount,
         guideLength: guideContent.length,
         model: 'claude-sonnet-4-20250514',
         ragEnabled: true,
         methodologyFiles: Object.keys(methodologyDatabase).length,
         contentQuality: 'corey-ralston-methodology-enhanced',
         fileCount: uploadIdList.length,
         uploadedFiles: uploadIdList.map(id => uploads[id].filename)
       }
     });
   } catch (dbError) {
     console.error('❌ Database save error:', dbError);
     
     // Check if it's an authentication error
     if (dbError.message.includes('Authentication required') || dbError.message.includes('User not found')) {
       return res.status(401).json({
         success: false,
         error: 'Authentication required to save guide',
         message: 'Please log in to save your guide to your account',
         guideContent: guideContent, // Still provide the guide content
         generatedAt: new Date(),
         savedToDatabase: false
       });
     }
     
     // Still return the guide content even if save fails for other reasons
     res.json({
       success: true,
       guideId: `corey_rag_${uploadIdList[0] || uploadId}`,
       guideContent: guideContent,
       generatedAt: new Date(),
       savedToDatabase: false,
       saveError: dbError.message,
       metadata: {
         characterName,
         productionTitle,
         productionType,
         scriptWordCount: combinedWordCount,
         guideLength: guideContent.length,
         model: 'claude-sonnet-4-20250514',
         ragEnabled: true,
         methodologyFiles: Object.keys(methodologyDatabase).length,
         contentQuality: 'corey-ralston-methodology-enhanced',
         fileCount: uploadIdList.length,
         uploadedFiles: uploadIdList.map(id => uploads[id].filename)
       }
     });
   }

 } catch (error) {
   console.error('❌ Corey Ralston RAG error:', error);
   
   res.status(500).json({ 
     error: 'Failed to generate Corey Ralston methodology guide. Please try again.',
     details: process.env.NODE_ENV === 'development' ? error.message : undefined
   });
 }
});

// Methodology API endpoint to view loaded files
app.get('/api/methodology', (req, res) => {
 const summary = Object.values(methodologyDatabase).map(file => ({
   filename: file.filename,
   type: file.type,
   size: file.size,
   keywords: file.keywords
 }));
 
 res.json({
   totalFiles: Object.keys(methodologyDatabase).length,
   files: summary,
   ragEnabled: true,
   message: 'Corey Ralston methodology files loaded and ready for RAG'
 });
});

// Get user's guides
app.get('/api/guides', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const Guide = require('./models/Guide');
    const guides = await Guide.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'guideId', 'characterName', 'productionTitle', 'productionType', 'roleSize', 'genre', 'createdAt', 'viewCount']
    });

    res.json({
      success: true,
      guides: guides,
      total: guides.length
    });
  } catch (error) {
    console.error('❌ Error fetching guides:', error);
    res.status(500).json({ error: 'Failed to fetch guides' });
  }
});

// Get specific guide by ID
app.get('/api/guides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const Guide = require('./models/Guide');
    const guide = await Guide.findOne({
      where: { id, userId },
      attributes: ['id', 'guideId', 'characterName', 'productionTitle', 'productionType', 'roleSize', 'genre', 'storyline', 'characterBreakdown', 'callbackNotes', 'focusArea', 'sceneText', 'generatedHtml', 'createdAt', 'viewCount']
    });

    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    // Increment view count
    await guide.increment('viewCount');

    res.json({
      success: true,
      guide: guide
    });
  } catch (error) {
    console.error('❌ Error fetching guide:', error);
    res.status(500).json({ error: 'Failed to fetch guide' });
  }
});

// Download guide as PDF
app.get('/api/guides/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const Guide = require('./models/Guide');
    const guide = await Guide.findOne({
      where: { id, userId },
      attributes: ['id', 'guideId', 'characterName', 'productionTitle', 'productionType', 'roleSize', 'genre', 'storyline', 'characterBreakdown', 'callbackNotes', 'focusArea', 'sceneText', 'generatedHtml', 'createdAt', 'viewCount']
    });

    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    console.log(`📄 Generating PDF for guide: ${guide.characterName} - ${guide.productionTitle}`);

    // Use Adobe PDF Services to convert HTML to PDF
    const {
      ServicePrincipalCredentials,
      PDFServices,
      MimeType,
      HTMLToPDFJob,
      HTMLToPDFResult,
      PageLayout,
      HTMLToPDFParams
    } = require("@adobe/pdfservices-node-sdk");

    // Load Adobe credentials from JSON file
    const credentialsPath = './pdfservices-api-credentials.json';
    const credentialsData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    
    // Create credentials instance
    const credentials = new ServicePrincipalCredentials({
      clientId: credentialsData.client_credentials.client_id,
      clientSecret: credentialsData.client_credentials.client_secret
    });

    // Create PDF Services instance
    const pdfServices = new PDFServices({credentials});

    // Create HTML content with proper styling
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
          h2 { color: #34495e; margin-top: 30px; }
          h3 { color: #7f8c8d; }
          .guide-section { margin-bottom: 25px; }
          .character-info { background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .script-content { background: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0; }
          .footer { margin-top: 40px; text-align: center; color: #7f8c8d; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>🎭 Audition Guide: ${guide.characterName}</h1>
        
        <div class="character-info">
          <h2>Production Details</h2>
          <p><strong>Production:</strong> ${guide.productionTitle}</p>
          <p><strong>Type:</strong> ${guide.productionType}</p>
          <p><strong>Role Size:</strong> ${guide.roleSize}</p>
          <p><strong>Genre:</strong> ${guide.genre}</p>
          <p><strong>Created:</strong> ${new Date(guide.createdAt).toLocaleDateString()}</p>
        </div>

        <div class="guide-section">
          <h2>Character Analysis</h2>
          ${guide.storyline ? `<p><strong>Storyline:</strong> ${guide.storyline}</p>` : ''}
          ${guide.characterBreakdown ? `<p><strong>Character Breakdown:</strong> ${guide.characterBreakdown}</p>` : ''}
          ${guide.focusArea ? `<p><strong>Focus Area:</strong> ${guide.focusArea}</p>` : ''}
        </div>

        <div class="guide-section">
          <h2>Generated Guide</h2>
          ${guide.generatedHtml}
        </div>

        <div class="footer">
          <p>Generated by Prep101 - Professional Acting Guide Generator</p>
          <p>Corey Ralston Methodology</p>
        </div>
      </body>
      </html>
    `;

    // Create a temporary HTML file
    const tempHtmlPath = `./temp_guide_${id}.html`;
    fs.writeFileSync(tempHtmlPath, htmlContent);

    // Create input asset from HTML file
    const readStream = fs.createReadStream(tempHtmlPath);
    const inputAsset = await pdfServices.upload({
      readStream,
      mimeType: MimeType.HTML
    });

    // Create parameters for the job
    const pageLayout = new PageLayout({
      pageHeight: 11,
      pageWidth: 8.5
    });

    const params = new HTMLToPDFParams({
      pageLayout,
      includeHeaderFooter: false
    });

    // Create and submit the job
    const job = new HTMLToPDFJob({inputAsset, params});
    const pollingURL = await pdfServices.submit({job});
    
    // Wait for job completion and get result
    const pdfServicesResponse = await pdfServices.getJobResult({
      pollingURL,
      resultType: HTMLToPDFResult
    });

    // Get content from the resulting asset
    const resultAsset = pdfServicesResponse.result.asset;
    const streamAsset = await pdfServices.getContent({asset: resultAsset});

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="guide_${guide.characterName}_${guide.productionTitle}.pdf"`);
    res.setHeader('Content-Length', streamAsset.asset.size);

    // Stream the PDF to the response
    streamAsset.readStream.pipe(res);

    // Clean up temporary files
    setTimeout(() => {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (err) {
        console.log('Could not delete temp HTML file:', err.message);
      }
    }, 5000);

  } catch (error) {
    console.error('❌ PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Email guide to user
app.post('/api/guides/:id/email', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const Guide = require('./models/Guide');
    const User = require('./models/User');
    
    const guide = await Guide.findOne({
      where: { id, userId },
      attributes: ['id', 'guideId', 'characterName', 'productionTitle', 'productionType', 'roleSize', 'genre', 'storyline', 'characterBreakdown', 'callbackNotes', 'focusArea', 'sceneText', 'generatedHtml', 'createdAt', 'viewCount']
    });

    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`📧 Sending guide email to: ${user.email}`);

    // Configure nodemailer
    const nodemailer = require('nodemailer');
    
    // Create transporter (you'll need to configure this with your email service)
    const transporter = nodemailer.createTransporter({
      service: 'gmail', // or your preferred email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Create email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2dd4bf 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .guide-section { margin-bottom: 25px; }
          .character-info { background: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 25px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🎭 Your Prep101 Audition Guide</h1>
            <p>Professional acting guidance delivered to your inbox</p>
          </div>
          
          <div class="content">
            <div class="character-info">
              <h2>${guide.characterName} - ${guide.productionTitle}</h2>
              <p><strong>Production Type:</strong> ${guide.productionType}</p>
              <p><strong>Role Size:</strong> ${guide.roleSize}</p>
              <p><strong>Genre:</strong> ${guide.genre}</p>
              <p><strong>Created:</strong> ${new Date(guide.createdAt).toLocaleDateString()}</p>
            </div>

            <div class="guide-section">
              <h3>Character Analysis</h3>
              ${guide.storyline ? `<p><strong>Storyline:</strong> ${guide.storyline}</p>` : ''}
              ${guide.characterBreakdown ? `<p><strong>Character Breakdown:</strong> ${guide.characterBreakdown}</p>` : ''}
              ${guide.focusArea ? `<p><strong>Focus Area:</strong> ${guide.focusArea}</p>` : ''}
            </div>

            <div class="guide-section">
              <h3>Your Professional Guide</h3>
              <p>Your personalized audition guide has been generated using Corey Ralston's professional methodology. This guide includes:</p>
              <ul>
                <li>Character essence and psychology</li>
                <li>Script breakdown and analysis</li>
                <li>Uta Hagen's 9 Questions framework</li>
                <li>Subtext analysis and objectives</li>
                <li>Professional coaching insights</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">View Full Guide Online</a>
              <a href="${process.env.API_BASE || 'http://localhost:3001'}/api/guides/${guide.id}/pdf" class="button">Download as PDF</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Generated by Prep101 - Professional Acting Guide Generator</p>
            <p>Corey Ralston Methodology</p>
            <p><small>This email was sent to ${user.email}</small></p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `🎭 Your Prep101 Guide: ${guide.characterName} - ${guide.productionTitle}`,
      html: emailHtml
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ Guide email sent successfully to ${user.email}`);

    res.json({
      success: true,
      message: 'Guide sent to your email successfully',
      email: user.email
    });

  } catch (error) {
    console.error('❌ Email sending error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
 res.json({ 
   status: 'running',
   model: 'claude-sonnet-4-20250514',
   maxTokens: 8000,
   ragEnabled: true,
   methodologyFiles: Object.keys(methodologyDatabase).length,
   coreyRalstonMethodology: true,
   apiKey: ANTHROPIC_API_KEY ? 'configured' : 'missing',
   uploadsCount: Object.keys(uploads).length,
   features: [
     'True RAG with Corey Ralston methodology',
     'Intelligent methodology file search',
     'Example guide pattern matching',
     'Professional coaching voice replication',
     'Claude Sonnet 4 + 16K tokens',
     'PREP101 authentic methodology',
     'Actor Motivator writing style',
     'User authentication & authorization',
     'Stripe payment integration',
     'Subscription management',
     'Guide usage tracking'
   ],
   message: 'PREP101 Corey Ralston RAG-Enhanced Guide Generator with Actor Motivator Style + Full Auth & Payment System'
 });
});

// Enhanced health check with new features
app.get('/health', (req, res) => {
 res.json({ 
   status: 'healthy',
   timestamp: new Date().toISOString(),
   environment: config.server.env,
   features: {
     rag: true,
     authentication: true,
     payments: true,
     guides: true,
     uploads: true
   },
   server: 'PREP101 Enhanced Backend'
 });
});

// Initialize server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Load methodology files
    loadMethodologyFiles();
    
    // Start server
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, '0.0.0.0', () => {
 console.log('🎭 PREP101 COREY RALSTON RAG-ENHANCED GENERATOR');
 console.log(`🚀 Server running on port ${PORT}`);
 console.log(`🤖 Model: Claude Sonnet 4 ✅`);
 console.log(`⚡ Max Tokens: 16,000 ✅`);
 console.log(`🧠 RAG: Corey Ralston Methodology ✅`);
 console.log(`📚 Files Loaded: ${Object.keys(methodologyDatabase).length} ✅`);
 console.log(`🎯 Actor Motivator Style: ENABLED ✅`);
 console.log('');
 console.log('🎯 Corey Ralston RAG Features:');
 console.log('   • True file-based RAG system');
 console.log('   • Intelligent methodology search');
 console.log('   • Example guide pattern matching');
 console.log('   • Professional coaching voice replication');
 console.log('   • PREP101 authentic methodology');
 console.log('   • Actor Motivator writing style');
 console.log('');
 console.log('🔐 NEW: Authentication & Payment System');
 console.log('   • User registration & login');
 console.log('   • Stripe subscription management');
 console.log('   • Guide usage tracking');
 console.log('   • Subscription-based access control');
 console.log('');
 console.log('✅ Ready to generate authentic Corey Ralston guides with full auth & payments!');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

// Serve static files from React build

// Catch all handler for React Router  
app.get('*', (req, res) => {
 if (!req.path.startsWith('/api')) {
   res.sendFile(path.join(__dirname, "index.html"));
 }
});
