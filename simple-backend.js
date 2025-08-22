const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: ['http://localhost:3000'] }));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploads = {};

// Adobe PDF Services
let adobeCredentials = null;
try {
  const PDFServicesSdk = require('@adobe/pdfservices-node-sdk');
  const creds = JSON.parse(fs.readFileSync('./pdfservices-api-credentials.json', 'utf8'));
  adobeCredentials = new PDFServicesSdk.ServicePrincipalCredentials({
    clientId: creds.client_credentials.client_id,
    clientSecret: creds.client_credentials.client_secret
  });
  console.log('✅ Adobe OCR ENABLED');
} catch (e) {
  console.log('⚠️ Adobe OCR disabled, using basic extraction');
}

// PDF extraction with text cleaning
async function extractTextBasic(pdfBuffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(pdfBuffer);
  
  // Clean the text
  let cleanText = data.text
    .replace(/74222 - Aug 20, 2025 9:42 AM -/g, '')
    .replace(/B568CR-/g, '')
    .replace(/Sides by Breakdown Services - Actors Access/g, '')
    .replace(/\d{1,2}\.\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log('🧹 Cleaned text from', data.text.length, 'to', cleanText.length, 'characters');
  
  return { text: cleanText, method: 'basic', confidence: 'medium', characterNames: [], stageDirections: [] };
}

// PDF Upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    console.log(`📄 Processing: ${req.file.originalname}`);
    
    const result = await extractTextBasic(req.file.buffer);
    
    if (!result.text || result.text.trim().length < 10) {
      return res.status(400).json({ error: 'Could not extract readable text from PDF' });
    }

    const uploadId = Date.now().toString();
    uploads[uploadId] = {
      filename: req.file.originalname,
      sceneText: result.text.trim(),
      extractionMethod: result.method,
      uploadTime: new Date(),
      wordCount: result.text.trim().split(/\s+/).length
    };

    console.log(`✅ Extracted ${result.text.length} characters using ${result.method}`);

    res.json({
      uploadId,
      filename: req.file.originalname,
      textLength: result.text.length,
      wordCount: uploads[uploadId].wordCount,
      extractionMethod: result.method,
      extractionConfidence: result.confidence,
      characterNames: [],
      preview: result.text.substring(0, 300) + '...',
      success: true
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// DYNAMIC PROMPT GENERATION BASED ON GENRE
const generateUserPrompt = (data) => {
  // Detect script genre/tone for appropriate guidance
  const scriptText = data.sceneText.toLowerCase();
  const isComedy = scriptText.includes('laugh') || scriptText.includes('funny') || 
                   data.productionType.toLowerCase().includes('comedy') ||
                   data.productionType.toLowerCase().includes('sitcom');
  
  const isDrama = data.productionType.toLowerCase().includes('drama') ||
                  scriptText.includes('cry') || scriptText.includes('serious');

  return `You are an expert acting coach analyzing an audition script. Create a professional preparation guide that helps the actor book this job.

CHARACTER: ${data.characterName}
PRODUCTION: ${data.productionTitle} (${data.productionType})
GENRE: ${isComedy ? 'Comedy' : isDrama ? 'Drama' : 'Mixed Genre'}

SCRIPT TO ANALYZE:
${data.sceneText}

Create a comprehensive acting guide with these sections (use proper markdown formatting):

## CHARACTER ESSENCE
Write 3-4 sentences capturing this character's core psychology and what makes them unique. Go beyond demographics to their emotional core and worldview.

## SCRIPT BREAKDOWN  
Analyze 3-4 specific moments from the provided script. For each moment, include:
- The actual line or action from the script
- What's really happening beneath the surface
- The character's emotional state and objective

## UTA HAGEN'S 9 QUESTIONS

Answer each question specifically for this character and script:

**Who am I?** (Character background in first person)
**Where am I?** (Location analysis and character's relationship to space)  
**What time is it?** (Time context and energy impact)
**What surrounds me?** (Environment and its emotional effect)
**What are the relationships?** (Dynamic with each character mentioned)
**What are the circumstances?** (Events leading to this scene)
**What do I want?** (Scene objectives moment by moment)
**What's in my way?** (Obstacles and conflicts)
**How do I get what I want?** (Tactics and behaviors)

## SUBTEXT ANALYSIS
For 3-4 actual lines from the script, reveal what the character is REALLY saying:
- "Line from script" = What they really mean
- Include the psychological motivation behind each line

## PHYSICALITY & VOICE
Based on the script, describe:
- How this character moves and uses their body
- Vocal qualities that serve the character
- Physical actions that reveal personality

${isComedy ? 
`## COMEDY STRATEGY
- Where are the laugh moments in this script?
- How to land jokes without "trying to be funny"
- Timing and rhythm specific to this scene` : 
isDrama ? 
`## DRAMATIC TECHNIQUE  
- Emotional peaks and valleys in the script
- How to build genuine emotion
- Vulnerability and truth moments` :
`## GENRE APPROACH
- How to balance different tonal elements
- Moments that require different acting approaches`}

## BOLD CHOICES
Provide 3 specific, unexpected choices the actor could make that would:
- Serve the story authentically
- Make them memorable to casting
- Differentiate them from obvious interpretations

## MOMENT BEFORE & BUTTON
- **Moment Before**: What happened 30 seconds before this scene starts?
- **The Button**: 2-3 options for how to end the scene memorably

## ACTION PLAN
Create 8 specific preparation tasks for this actor and this script.

CRITICAL REQUIREMENTS:
- Reference actual dialogue from the script throughout your analysis
- Make every piece of advice specific to THIS character and script
- Write with professional coaching expertise
- Provide actionable, not theoretical advice
- Focus on choices that help the actor book the job

Generate this as clean, well-formatted content (no HTML tags in your response - just clear markdown formatting).`;
};

// ENHANCED GUIDE GENERATION FUNCTION
async function generateActingGuide(data) {
  const fetch = require('node-fetch');
  
  const systemPrompt = `You are a professional acting coach with 20+ years of industry experience. You've coached actors who've booked major TV shows, films, and theater productions. 

Your expertise includes:
- Uta Hagen's 9 Questions methodology
- Script analysis and subtext work  
- Genre-specific techniques (comedy timing, dramatic truth, etc.)
- Self-tape and audition strategy
- Character development techniques

You provide practical, actionable coaching that helps actors book jobs. Your advice is specific, never generic, and always serves the story while helping the actor stand out.`;

  const userPrompt = generateUserPrompt(data);

  try {
    console.log(`🎭 Generating professional guide for ${data.characterName}...`);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': "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",
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: userPrompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.content && result.content[0] && result.content[0].text) {
      console.log(`✅ Professional guide generated successfully`);
      return formatGuideAsHTML(result.content[0].text, data);
    } else {
      throw new Error('Invalid response format from API');
    }

  } catch (error) {
    console.error('❌ Guide generation failed:', error.message);
    throw error;
  }
}

// Fallback template 
function generateFallbackGuide(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Acting Guide for ${data.characterName}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #2dd4bf; border-bottom: 3px solid #2dd4bf; padding-bottom: 10px; }
        .script { background: #f8f9fa; padding: 20px; border-radius: 8px; font-family: monospace; }
        .error { background: #fee2e2; padding: 20px; border-radius: 8px; color: #dc2626; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>🎭 Acting Guide for ${data.characterName}</h1>
    <h2>Production: ${data.productionTitle} (${data.productionType})</h2>
    <div class="script">
        <h3>Script:</h3>
        <p>${data.sceneText}</p>
    </div>
    <div class="error">
        <h3>⚠️ AI Guide Generation Failed</h3>
        <p>All Claude models failed to generate the professional guide. Check your API key and internet connection.</p>
        <p>This fallback template shows your script was processed successfully.</p>
    </div>
</body>
</html>`;
}

// GUIDE GENERATION ENDPOINT
app.post('/api/guides/generate', async (req, res) => {
  try {
    const { uploadId, characterName, productionTitle, productionType } = req.body;
    
    if (!uploadId || !uploads[uploadId]) {
      return res.status(400).json({ error: 'Invalid upload ID or expired session' });
    }

    const uploadData = uploads[uploadId];
    
    console.log(`🎭 Generating PROFESSIONAL GUIDE for ${characterName}`);
    console.log(`🎬 Production: ${productionTitle} (${productionType})`);
    console.log('📊 Upload data found:', !!uploadData);
    console.log('📊 Scene text length:', uploadData.sceneText.length);

    const guideContent = await generateActingGuide({
      sceneText: uploadData.sceneText,
      characterName,
      productionTitle,
      productionType,
      extractionMethod: uploadData.extractionMethod
    });

    console.log('✅ PROFESSIONAL GUIDE generated and ready!');
    console.log(`📊 Guide content length: ${guideContent.length} characters`);

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
        guideLength: guideContent.length
      }
    });

  } catch (error) {
    console.error('❌ Guide generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate professional guide. Please try again.',
      details: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'running', 
    adobe: !!adobeCredentials,
    message: 'PREP101 Professional Acting Guide Generator',
    features: [
      'Enhanced Claude API with professional methodology',
      'Uta Hagen 9 Questions framework',
      'Industry-specific production guidance',
      'Professional HTML guide generation',
      'Corey Ralston coaching methodology'
    ]
  });
});

app.listen(5001, () => {
  console.log('🎭 PREP101 PROFESSIONAL GUIDE GENERATOR');
  console.log('🚀 Server running on port 5001');
  console.log(`📊 Adobe OCR: ${adobeCredentials ? 'ENABLED' : 'DISABLED'}`);
  console.log('🎯 Enhanced Claude API with Corey Ralston Methodology: ENABLED');
  console.log('✅ Ready to generate COMPLETE professional acting guides!');
  console.log('🎬 Features: Uta Hagen 9 Questions, Subtext Analysis, Production Guidance');
  console.log('💼 Professional coaching quality in every guide');
});
// ENHANCED HTML FORMATTER WITH MARKDOWN SUPPORT
function formatGuideAsHTML(markdownContent, data) {
  // Convert markdown to HTML (install marked: npm install marked)
  const marked = require('marked');
  const htmlContent = marked.parse(markdownContent);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.characterName} - Audition Preparation Guide</title>
    <style>
        body {
            font-family: 'Georgia', serif;
            line-height: 1.6;
            max-width: 850px;
            margin: 0 auto;
            padding: 25px;
            color: #2c3e50;
            background-color: #fdfef8;
        }
        h1 {
            color: #8b0000;
            text-align: center;
            border-bottom: 4px solid #daa520;
            padding-bottom: 15px;
            font-size: 2.2em;
        }
        h2 {
            color: #8b0000;
            margin-top: 35px;
            font-size: 1.5em;
            border-left: 5px solid #daa520;
            padding-left: 15px;
            background-color: #fff9e6;
            padding: 15px;
            border-radius: 5px;
        }
        h3 {
            color: #2c5aa0;
            margin-top: 25px;
            font-size: 1.2em;
        }
        ul, ol { 
            padding-left: 30px; 
        }
        li { 
            margin-bottom: 10px; 
        }
        strong {
            color: #8b0000;
        }
    </style>
</head>
<body>
    <h1>${data.characterName} Audition Guide</h1>
    <div style="text-align: center; margin: 25px 0; color: #8b0000; font-style: italic; padding: 20px; background-color: #f0f8ff; border-radius: 8px;">
        ${data.productionTitle} - ${data.productionType}<br>
        Professional Acting Preparation Guide
    </div>
    
    ${htmlContent}
    
    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; text-align: center; margin-top: 40px; font-style: italic; color: #2c5aa0;">
        <strong>Remember:</strong> This guide is your roadmap to booking this role. 
        Use it as a foundation, then trust your instincts and make bold choices that feel authentic to you.
    </div>
</body>
</html>`;
}
