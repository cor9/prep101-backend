// simple-backend.js - Start with this to get Adobe OCR working
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS setup
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// File upload setup
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// In-memory storage for now
const uploads = {};

// Create temp directory
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Adobe PDF Services setup (if available)
let PDFServicesSdk;
let adobeCredentials;

try {
  PDFServicesSdk = require('@adobe/pdfservices-node-sdk');
  adobeCredentials = PDFServicesSdk.Credentials
    .serviceAccountCredentialsBuilder()
    .fromFile(path.join(__dirname, "pdfservices-api-credentials.json"))
    .build();
  console.log('✅ Adobe PDF Services loaded');
} catch (error) {
  console.log('⚠️ Adobe PDF Services not available - will use fallback OCR');
  console.log('To enable Adobe OCR:');
  console.log('1. Run: npm install @adobe/pdfservices-node-sdk adm-zip');
  console.log('2. Download credentials from Adobe Developer Console');
  console.log('3. Save as pdfservices-api-credentials.json');
}

// Fallback PDF extraction
async function extractTextBasic(pdfBuffer) {
  try {
    const pdfParse = require('pdf-parse');
    console.log('📖 Using basic PDF extraction...');
    
    const pdfData = await pdfParse(pdfBuffer);
    
    return {
      text: pdfData.text,
      characterNames: [], 
      stageDirections: [],
      confidence: 'medium',
      method: 'basic'
    };
  } catch (error) {
    throw new Error('PDF extraction failed: ' + error.message);
  }
}

// Adobe PDF extraction (premium)
async function extractTextWithAdobe(pdfBuffer, filename) {
  if (!PDFServicesSdk || !adobeCredentials) {
    throw new Error('Adobe PDF Services not available');
  }

  console.log('🔍 Using Adobe PDF Services for premium OCR...');
  
  const executionContext = PDFServicesSdk.ExecutionContext.create(adobeCredentials);
  const extractPDFOperation = PDFServicesSdk.ExtractPDF.Operation.createNew();

  // Create temporary file
  const tempPath = path.join(tempDir, `${Date.now()}_${filename}`);
  fs.writeFileSync(tempPath, pdfBuffer);
  
  const input = PDFServicesSdk.FileRef.createFromLocalFile(tempPath);
  extractPDFOperation.setInput(input);

  // Configure for acting sides
  const options = new PDFServicesSdk.ExtractPDF.options.ExtractPdfOptions.Builder()
    .addElementsToExtract(PDFServicesSdk.ExtractPDF.options.ExtractElementType.TEXT)
    .addElementsToExtract(PDFServicesSdk.ExtractPDF.options.ExtractElementType.TABLES)
    .build();
  
  extractPDFOperation.setOptions(options);

  try {
    const result = await extractPDFOperation.execute(executionContext);
    const resultPath = path.join(tempDir, `extracted_${Date.now()}.zip`);
    await result.saveAsFile(resultPath);
    
    // Extract the JSON content
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(resultPath);
    const structuredData = JSON.parse(zip.readAsText('structuredData.json'));
    
    // Process extracted elements
    const textElements = structuredData.elements.filter(element => element.Text);
    const fullText = textElements.map(element => element.Text).join(' ');
    
    // Find character names (bold text) and stage directions
    const characterNames = textElements
      .filter(element => element.Font && element.Font.weight >= 700)
      .map(element => element.Text.trim())
      .filter(text => text.length > 0 && text.length < 50); // Reasonable character name length
    
    const stageDirections = textElements
      .filter(element => element.Text.includes('(') && element.Text.includes(')'))
      .map(element => element.Text.trim());

    // Clean up temp files
    fs.unlinkSync(tempPath);
    fs.unlinkSync(resultPath);

    console.log('✅ Adobe PDF extraction completed');
    console.log(`📊 Found: ${characterNames.length} character names, ${stageDirections.length} stage directions`);
    
    return {
      text: fullText,
      characterNames: [...new Set(characterNames)], // Remove duplicates
      stageDirections,
      confidence: 'high',
      method: 'adobe'
    };

  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

// PDF Upload Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('📄 Processing PDF upload...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    console.log(`File: ${req.file.originalname} (${req.file.size} bytes)`);

    let extractionResult;
    
    try {
      // Try Adobe first
      extractionResult = await extractTextWithAdobe(req.file.buffer, req.file.originalname);
    } catch (adobeError) {
      console.log('Adobe extraction failed, using fallback:', adobeError.message);
      
      // Fallback to basic extraction
      extractionResult = await extractTextBasic(req.file.buffer);
    }

    const { text: sceneText, characterNames, stageDirections, confidence, method } = extractionResult;
    
    if (!sceneText || sceneText.trim().length < 10) {
      return res.status(400).json({ 
        error: 'Could not extract readable text. The PDF may be corrupted or image-based.' 
      });
    }
    
    // Store results
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
    
    console.log(`✅ SUCCESS: ${sceneText.length} characters extracted using ${method} method`);
    
    res.json({
      uploadId,
      filename: req.file.originalname,
      textLength: sceneText.length,
      wordCount: uploads[uploadId].wordCount,
      characterNames: characterNames.slice(0, 5), // Preview
      extractionConfidence: confidence,
      extractionMethod: method,
      preview: sceneText.substring(0, 300) + (sceneText.length > 300 ? '...' : ''),
      success: true
    });
    
  } catch (error) {
    console.error('❌ PDF processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF. Please try again.',
      details: error.message
    });
  }
});

// Guide Generation Endpoint
app.post('/api/guides/generate', async (req, res) => {
  try {
    const { uploadId, characterName, productionTitle, productionType, additionalNotes } = req.body;
    
    if (!uploadId || !uploads[uploadId]) {
      return res.status(400).json({ error: 'Invalid upload ID or expired session' });
    }

    const uploadData = uploads[uploadId];
    
    console.log('🎭 Generating acting guide...');
    console.log(`Character: ${characterName} | Production: ${productionTitle}`);

    // Generate guide using Anthropic (if available) or fallback
    const guideContent = await generateActingGuide({
      sceneText: uploadData.sceneText,
      characterName,
      productionTitle,
      productionType,
      additionalNotes,
      characterNames: uploadData.characterNames,
      stageDirections: uploadData.stageDirections,
      extractionMethod: uploadData.extractionMethod
    });

    res.json({
      success: true,
      guideId: `guide_${uploadId}`,
      guideContent,
      generatedAt: new Date(),
      metadata: {
        characterName,
        productionTitle,
        productionType,
        extractionMethod: uploadData.extractionMethod,
        scriptWordCount: uploadData.wordCount
      }
    });

  } catch (error) {
    console.error('❌ Guide generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate guide. Please try again.',
      details: error.message
    });
  }
});

// Acting guide generation
async function generateActingGuide(data) {
  // Try Anthropic API if available
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-key-here',
    });

    const prompt = `You are an expert acting coach trained by Corey Ralston. Analyze this audition script and create a comprehensive preparation guide.

CHARACTER: ${data.characterName}
PRODUCTION: ${data.productionTitle} (${data.productionType})
NOTES: ${data.additionalNotes || 'None'}

SCRIPT TEXT:
${data.sceneText}

TECHNICAL INFO:
- OCR Method: ${data.extractionMethod}
- Characters Found: ${data.characterNames.join(', ') || 'None'}
- Stage Directions: ${data.stageDirections.length} found

Create a professional HTML acting guide that includes:
1. Character Analysis using Uta Hagen's 9 Questions
2. Scene Breakdown with beat analysis  
3. Production-specific guidance for ${data.productionType}
4. Self-tape direction
5. Motivational coaching in Corey's supportive style

Format as clean HTML with professional styling.`;

    const message = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    });

    return message.content[0].text;

  } catch (error) {
    console.log('Using fallback guide generation:', error.message);
    return generateFallbackGuide(data);
  }
}

// Fallback guide
function generateFallbackGuide(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Acting Guide for ${data.characterName}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #2dd4bf; border-bottom: 3px solid #2dd4bf; padding-bottom: 10px; }
        h2 { color: #0f766e; margin-top: 30px; }
        .metadata { background: linear-gradient(135deg, #f0fdfa, #e6fffa); padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 5px solid #2dd4bf; }
        .scene-text { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #2dd4bf; font-family: 'Courier New', monospace; }
        .character-analysis { background: #fff7ed; padding: 20px; border-radius: 10px; }
        .ocr-badge { background: ${data.extractionMethod === 'adobe' ? '#10b981' : '#f59e0b'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
        .character-names { background: #ede9fe; padding: 10px; border-radius: 5px; margin: 10px 0; }
        ol li { margin: 10px 0; }
        .tip { background: #dbeafe; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 3px solid #3b82f6; }
    </style>
</head>
<body>
    <h1>🎭 Professional Acting Guide for ${data.characterName}</h1>
    
    <div class="metadata">
        <h2>📋 Production Information</h2>
        <p><strong>Production:</strong> ${data.productionTitle}</p>
        <p><strong>Type:</strong> ${data.productionType}</p>
        <p><strong>OCR Quality:</strong> <span class="ocr-badge">${data.extractionMethod.toUpperCase()}</span></p>
        ${data.characterNames.length > 0 ? `
        <div class="character-names">
            <strong>Characters Detected:</strong> ${data.characterNames.join(', ')}
        </div>` : ''}
    </div>

    <h2>📝 Scene Analysis</h2>
    <div class="scene-text">
        <p><strong>Script Text (${data.sceneText.split(' ').length} words):</strong></p>
        <p>${data.sceneText.length > 1000 ? data.sceneText.substring(0, 1000) + '...' : data.sceneText}</p>
    </div>

    <div class="character-analysis">
        <h2>🎯 Character Development - Uta Hagen's 9 Questions</h2>
        <p>Work through these fundamental questions for <strong>${data.characterName}</strong>:</p>
        <ol>
            <li><strong>Who am I?</strong> - Define ${data.characterName}'s identity, background, and core personality</li>
            <li><strong>What time is it?</strong> - When does this scene take place? What's the urgency?</li>
            <li><strong>Where am I?</strong> - Physical location and emotional environment</li>
            <li><strong>What surrounds me?</strong> - Objects, atmosphere, and sensory details</li>
            <li><strong>What are given circumstances?</strong> - Facts directly from the script</li>
            <li><strong>What are my relationships?</strong> - How does ${data.characterName} relate to others in the scene?</li>
            <li><strong>What do I want?</strong> - ${data.characterName}'s objective in this moment</li>
            <li><strong>What is in my way?</strong> - Obstacles preventing ${data.characterName} from getting what they want</li>
            <li><strong>What do I do to get what I want?</strong> - Specific actions and tactics</li>
        </ol>
    </div>

    <h2>🎬 ${data.productionType} Performance Notes</h2>
    <div class="tip">
        <strong>Production Type Guidance:</strong> Tailor your performance energy and style for ${data.productionType}. 
        ${data.productionType.toLowerCase().includes('comedy') ? 
          'Comedy requires precise timing, clear reactions, and heightened energy.' : 
          'Focus on authentic emotional truth and naturalistic delivery.'}
    </div>

    <h2>🎥 Self-Tape Best Practices</h2>
    <ul>
        <li>Frame from mid-chest up, eyes in upper third of frame</li>
        <li>Use natural lighting, avoid shadows on face</li>
        <li>Keep background simple and non-distracting</li>
        <li>Record in landscape mode for professional appearance</li>
        <li>Do multiple takes, choose your best work</li>
        <li>Keep energy up - camera absorbs 20% of your energy</li>
    </ul>

    <div class="tip">
        <strong>🌟 Corey's Coaching Tip:</strong> Remember, every audition is practice for the next one. 
        Approach this role with curiosity and playfulness. You've got this! The casting team wants you to succeed.
    </div>

    <p style="margin-top: 40px; text-align: center; color: #6b7280; font-style: italic;">
        Guide generated by PREP101 on ${new Date().toLocaleDateString()} • 
        OCR: ${data.extractionMethod} • 
        Professional Acting Methodology by Corey Ralston
    </p>
</body>
</html>`;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'running',
    adobe_ocr: !!adobeCredentials,
    active_uploads: Object.keys(uploads).length,
    temp_dir: fs.existsSync(tempDir)
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`🚀 PREP101 Simple Backend running on port ${PORT}`);
  console.log('📋 Ready for PDF processing with advanced OCR');
  console.log(`🔧 Adobe PDF Services: ${adobeCredentials ? '✅ ENABLED' : '⚠️ FALLBACK MODE'}`);
  console.log('');
  console.log('📖 To enable Adobe PDF OCR:');
  console.log('1. npm install @adobe/pdfservices-node-sdk adm-zip');
  console.log('2. Get credentials from https://developer.adobe.com/document-services/');
  console.log('3. Save as pdfservices-api-credentials.json');
  console.log('');
  console.log('📍 Endpoints:');
  console.log('  POST /api/upload - PDF processing');
  console.log('  POST /api/guides/generate - Guide generation');
  console.log('  GET /api/health - System status');
});