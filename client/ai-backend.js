const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const uploads = {};

// PDF upload and text extraction
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('📄 Processing PDF upload...');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Please upload a PDF file' });
    }

    // Extract text from PDF using pdf-parse
    console.log('🔍 Extracting text from PDF...');
    const pdfData = await pdfParse(req.file.buffer);
    const sceneText = pdfData.text;
    
    if (!sceneText || sceneText.trim().length < 10) {
      return res.status(400).json({ error: 'Could not extract readable text from PDF' });
    }
    
    const uploadId = Date.now().toString();
    uploads[uploadId] = {
      filename: req.file.originalname,
      sceneText: sceneText.trim(),
      uploadTime: new Date()
    };
    
    console.log(`✅ PDF processed: ${sceneText.length} characters extracted from ${req.file.originalname}`);
    
    res.json({
      uploadId,
      filename: req.file.originalname,
      textLength: sceneText.length,
      preview: sceneText.substring(0, 200) + '...'
    });
    
  } catch (error) {
    console.error('❌ PDF processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF',
      details: error.message
    });
  }
});

// Generate acting guide
app.post('/api/guides/generate', async (req, res) => {
  try {
    const { characterName, productionTitle, productionType, uploadId } = req.body;
    
    console.log(`🎭 Generating guide for: ${characterName}`);
    
    if (!uploadId || !uploads[uploadId]) {
      return res.status(400).json({ error: 'No script uploaded' });
    }
    
    const script = uploads[uploadId].sceneText;
    
    // Analyze the script for character insights
    const lines = script.split('\n').filter(line => line.trim());
    const characterLines = lines.filter(line => 
      line.toUpperCase().includes(characterName.toUpperCase())
    );
    
    const dialogueLines = lines.filter(line => 
      line.includes(':') || 
      (line.length > 10 && !line.match(/^[A-Z\s]+$/))
    );

    // Create comprehensive acting guide
    const guideHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Acting Guide - ${characterName}</title>
      <style>
        body { 
          font-family: 'Georgia', serif; 
          max-width: 900px; 
          margin: 0 auto; 
          padding: 40px 20px; 
          line-height: 1.7;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          color: #374151;
        }
        .header {
          text-align: center;
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          margin-bottom: 40px;
          border-top: 5px solid #2dd4bf;
        }
        .header h1 { 
          color: #2dd4bf; 
          margin: 0;
          font-size: 3em;
          font-weight: bold;
        }
        .content {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }
        h2 { 
          color: #14b8a6; 
          border-bottom: 3px solid #2dd4bf; 
          padding-bottom: 15px;
          font-size: 1.8em;
        }
        .highlight { 
          background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%); 
          padding: 20px; 
          border-left: 5px solid #2dd4bf; 
          margin: 20px 0;
          border-radius: 10px;
        }
        .script-excerpt {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 20px;
          border-radius: 10px;
          font-family: 'Courier New', monospace;
          margin: 20px 0;
          white-space: pre-wrap;
          font-size: 0.9em;
          max-height: 400px;
          overflow-y: auto;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }
        .stat-box {
          background: #f0fdfa;
          padding: 15px;
          border-radius: 10px;
          text-align: center;
          border: 1px solid #2dd4bf;
        }
        .stat-number {
          font-size: 2em;
          font-weight: bold;
          color: #14b8a6;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎭 Acting Guide</h1>
        <div style="color: #6b7280; font-size: 1.2em; margin: 15px 0;">
          <strong>${characterName}</strong><br>
          ${productionTitle} (${productionType})
        </div>
        <div style="font-size: 0.9em; color: #9ca3af;">
          Generated from: ${uploads[uploadId].filename}
        </div>
      </div>
      
      <div class="content">
        <h2>📊 Script Analysis</h2>
        <div class="stats">
          <div class="stat-box">
            <div class="stat-number">${script.length}</div>
            <div>Total Characters</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${lines.length}</div>
            <div>Total Lines</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${characterLines.length}</div>
            <div>${characterName} References</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${dialogueLines.length}</div>
            <div>Dialogue Lines</div>
          </div>
        </div>

        <h2>📝 Script Preview</h2>
        <div class="script-excerpt">${script.substring(0, 1500)}${script.length > 1500 ? '\n\n[Full script continues...]' : ''}</div>
        
        <h2>🎭 Character Analysis for ${characterName}</h2>
        
        <div class="highlight">
          <h3>🎯 Key Focus Areas</h3>
          <ul>
            <li><strong>Character Voice:</strong> Pay attention to how ${characterName} speaks compared to other characters</li>
            <li><strong>Emotional Range:</strong> Look for moments of vulnerability, strength, humor, or intensity</li>
            <li><strong>Relationships:</strong> How does ${characterName} interact with different characters?</li>
            <li><strong>Character Arc:</strong> What journey does ${characterName} go through in these scenes?</li>
          </ul>
        </div>

        <h3>💬 Dialogue Analysis</h3>
        <p>Based on the script, consider these aspects of ${characterName}'s communication style:</p>
        <ul>
          <li><strong>Formality Level:</strong> Does the character speak formally or casually?</li>
          <li><strong>Emotional Subtext:</strong> What might they be feeling but not saying directly?</li>
          <li><strong>Speech Patterns:</strong> Do they speak quickly when excited? Slowly when thinking?</li>
          <li><strong>Vocabulary:</strong> What kind of words does this character choose?</li>
        </ul>

        <h3>🎬 Scene Objectives</h3>
        <div class="highlight">
          <p>For each scene, identify:</p>
          <ul>
            <li><strong>What does ${characterName} want?</strong> (Their objective)</li>
            <li><strong>Why do they want it?</strong> (Their motivation)</li>
            <li><strong>How do they try to get it?</strong> (Their tactics)</li>
            <li><strong>What's stopping them?</strong> (Obstacles)</li>
          </ul>
        </div>

        <h2>🎯 Acting Preparation Tips</h2>
        
        <h3>🧠 Character Development</h3>
        <ul>
          <li>Create a detailed backstory for ${characterName} that explains their behavior</li>
          <li>Define their relationships with every other character in the script</li>
          <li>Identify their biggest fear and greatest desire</li>
          <li>Consider how they would behave in situations not shown in the script</li>
        </ul>

        <h3>🗣️ Voice & Physicality</h3>
        <ul>
          <li><strong>Vocal Choices:</strong> Develop a unique vocal signature for ${characterName}</li>
          <li><strong>Physical Gestures:</strong> How do they move? Stand? Sit?</li>
          <li><strong>Nervous Habits:</strong> What do they do when uncomfortable?</li>
          <li><strong>Confident Moments:</strong> How does their posture change when they feel strong?</li>
        </ul>

        <h3>🎭 Scene Work</h3>
        <div class="highlight">
          <p><strong>Before each take or performance:</strong></p>
          <ul>
            <li>Review your character's objective for this specific scene</li>
            <li>Consider what happened to them right before this scene starts</li>
            <li>Identify the emotional temperature at the beginning and end</li>
            <li>Practice different ways to achieve your character's goal</li>
          </ul>
        </div>

        <h2>📚 Next Steps</h2>
        <ol>
          <li><strong>Read through the full script</strong> multiple times, focusing on ${characterName}</li>
          <li><strong>Highlight every line</strong> your character speaks</li>
          <li><strong>Make notes</strong> about their emotional state in each moment</li>
          <li><strong>Practice with scene partners</strong> if possible</li>
          <li><strong>Record yourself</strong> reading the lines and listen back</li>
        </ol>
      </div>
      
      <div style="text-align: center; color: #9ca3af; font-style: italic; margin-top: 40px;">
        <p>✨ Generated by PREP101 • ${new Date().toLocaleDateString()} ✨</p>
        <p>Professional Acting Guide from PDF Audition Sides</p>
      </div>
    </body>
    </html>`;
    
    console.log('✅ Acting guide generated successfully!');
    
    res.json({
      ok: true,
      guideHtml: guideHtml
    });
    
  } catch (error) {
    console.error('❌ Guide generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate guide',
      message: error.message
    });
  }
});

// Auth endpoints (keep these for login)
app.post('/api/auth/login', (req, res) => {
  res.json({ 
    token: 'fake-token',
    user: { id: 1, name: 'Test User', email: req.body.email, subscription: 'free', guidesUsed: 0, guidesLimit: 3 }
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ id: 1, name: 'Test User', email: 'test@test.com', subscription: 'free', guidesUsed: 0, guidesLimit: 3 });
});

app.get('/api/guides/my-guides', (req, res) => {
  res.json([]);
});

app.listen(5000, () => {
  console.log('🚀 PREP101 AI Backend running on port 5000');
  console.log('📄 Ready to process PDF audition sides!');
  console.log('🎭 Generating professional acting guides');
});
