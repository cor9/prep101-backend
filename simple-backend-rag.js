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

// Debug environment variables
console.log('🔧 Environment variables loaded:');
console.log('  - JWT_SECRET present:', !!process.env.JWT_SECRET);
console.log('  - EMAIL_USER present:', !!process.env.EMAIL_USER);
console.log('  - EMAIL_PASS present:', !!process.env.EMAIL_PASS);
console.log('  - EMAIL_SERVICE:', process.env.EMAIL_SERVICE);
console.log('  - EMAIL_SECURE:', process.env.EMAIL_SECURE);
console.log('  - EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('  - FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('  - API_BASE:', process.env.API_BASE);

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

// Analyze script content to determine color theme
function determineColorTheme(characterName, productionTitle, productionType, sceneText) {
  const text = `${characterName} ${productionTitle} ${productionType} ${sceneText}`.toLowerCase();
  
  // Gender-specific themes (check character names first)
  const characterNameLower = characterName.toLowerCase();
  
  // Princess/Female character themes
  if (characterNameLower.includes('princess') || characterNameLower.includes('queen') || 
      characterNameLower.includes('fairy') || characterNameLower.includes('rose') ||
      characterNameLower.includes('lily') || characterNameLower.includes('belle') ||
      characterNameLower.includes('ariel') || characterNameLower.includes('snow')) {
    return {
      primary: '#EC4899',    // Pink
      secondary: '#F59E0B',  // Gold
      accent: '#8B5CF6',     // Purple
      background: '#FDF2F8', // Light pink
      name: 'Princess'
    };
  }
  
  // Prince/Male character themes
  if (characterNameLower.includes('prince') || characterNameLower.includes('king') || 
      characterNameLower.includes('knight') || characterNameLower.includes('hero') ||
      characterNameLower.includes('warrior') || characterNameLower.includes('dragon') ||
      characterNameLower.includes('max') || characterNameLower.includes('leo')) {
    return {
      primary: '#3B82F6',    // Blue
      secondary: '#F59E0B',  // Gold
      accent: '#10B981',     // Green
      background: '#EFF6FF', // Light blue
      name: 'Prince'
    };
  }
  
  // Adventure/Action themes
  if (text.includes('adventure') || text.includes('action') || text.includes('quest') || 
      text.includes('hero') || text.includes('battle') || text.includes('journey') ||
      text.includes('explorer') || text.includes('warrior') || text.includes('knight')) {
    return {
      primary: '#4F46E5',    // Vibrant blue
      secondary: '#F59E0B',  // Orange
      accent: '#10B981',     // Green
      background: '#EFF6FF', // Light blue
      name: 'Adventure'
    };
  }
  
  // Comedy/Fun themes
  if (text.includes('comedy') || text.includes('funny') || text.includes('humor') ||
      text.includes('silly') || text.includes('joke') || text.includes('laugh') ||
      text.includes('playful') || text.includes('wacky') || text.includes('goofy')) {
    return {
      primary: '#EC4899',    // Pink
      secondary: '#F59E0B',  // Yellow
      accent: '#8B5CF6',     // Purple
      background: '#FDF2F8', // Light pink
      name: 'Comedy'
    };
  }
  
  // Fantasy/Magical themes
  if (text.includes('fantasy') || text.includes('magic') || text.includes('wizard') ||
      text.includes('fairy') || text.includes('dragon') || text.includes('spell') ||
      text.includes('enchanted') || text.includes('mythical') || text.includes('wonder')) {
    return {
      primary: '#8B5CF6',    // Purple
      secondary: '#EC4899',  // Pink
      accent: '#F59E0B',     // Gold
      background: '#F5F3FF', // Light purple
      name: 'Fantasy'
    };
  }
  
  // Drama/Serious themes
  if (text.includes('drama') || text.includes('serious') || text.includes('emotional') ||
      text.includes('intense') || text.includes('deep') || text.includes('powerful') ||
      text.includes('meaningful') || text.includes('touching') || text.includes('heartfelt')) {
    return {
      primary: '#7C3AED',    // Purple
      secondary: '#14B8A6',  // Teal
      accent: '#6B7280',     // Gray
      background: '#F0FDFA', // Light teal
      name: 'Drama'
    };
  }
  
  // Modern/Urban themes
  if (text.includes('modern') || text.includes('urban') || text.includes('city') ||
      text.includes('contemporary') || text.includes('trendy') || text.includes('cool') ||
      text.includes('street') || text.includes('hip') || text.includes('current')) {
    return {
      primary: '#3B82F6',    // Blue
      secondary: '#6B7280',  // Gray
      accent: '#EF4444',     // Red
      background: '#F8FAFC', // Light gray
      name: 'Modern'
    };
  }
  
  // Princess/Royal themes
  if (text.includes('princess') || text.includes('royal') || text.includes('queen') ||
      text.includes('king') || text.includes('crown') || text.includes('castle') ||
      text.includes('noble') || text.includes('elegant') || text.includes('regal')) {
    return {
      primary: '#EC4899',    // Pink
      secondary: '#F59E0B',  // Gold
      accent: '#8B5CF6',     // Purple
      background: '#FDF2F8', // Light pink
      name: 'Royal'
    };
  }
  
  // Superhero themes
  if (text.includes('superhero') || text.includes('hero') || text.includes('power') ||
      text.includes('save') || text.includes('rescue') || text.includes('strong') ||
      text.includes('mighty') || text.includes('brave') || text.includes('courage')) {
    return {
      primary: '#EF4444',    // Red
      secondary: '#F59E0B',  // Gold
      accent: '#3B82F6',     // Blue
      background: '#FEF2F2', // Light red
      name: 'Superhero'
    };
  }
  
  // Nature/Outdoor themes
  if (text.includes('nature') || text.includes('outdoor') || text.includes('forest') ||
      text.includes('garden') || text.includes('animal') || text.includes('tree') ||
      text.includes('flower') || text.includes('mountain') || text.includes('river')) {
    return {
      primary: '#10B981',    // Green
      secondary: '#F59E0B',  // Orange
      accent: '#8B5CF6',     // Purple
      background: '#F0FDF4', // Light green
      name: 'Nature'
    };
  }
  
  // Production type specific themes
  if (productionType.toLowerCase().includes('musical')) {
    return {
      primary: '#EC4899',    // Pink
      secondary: '#F59E0B',  // Gold
      accent: '#8B5CF6',     // Purple
      background: '#FDF2F8', // Light pink
      name: 'Musical'
    };
  }
  
  if (productionType.toLowerCase().includes('comedy')) {
    return {
      primary: '#F59E0B',    // Yellow
      secondary: '#EC4899',  // Pink
      accent: '#10B981',     // Green
      background: '#FFFBEB', // Light yellow
      name: 'Comedy'
    };
  }
  
  if (productionType.toLowerCase().includes('drama')) {
    return {
      primary: '#7C3AED',    // Purple
      secondary: '#14B8A6',  // Teal
      accent: '#6B7280',     // Gray
      background: '#F0FDFA', // Light teal
      name: 'Drama'
    };
  }
  
    if (productionType.toLowerCase().includes('action') || productionType.toLowerCase().includes('adventure')) {
    return {
      primary: '#EF4444',    // Red
      secondary: '#F59E0B',  // Gold
      accent: '#3B82F6',     // Blue
      background: '#FEF2F2', // Light red
      name: 'Action'
    };
  }
  
  // Seasonal and holiday themes
  if (text.includes('christmas') || text.includes('holiday') || text.includes('winter')) {
    return {
      primary: '#EF4444',    // Red
      secondary: '#10B981',  // Green
      accent: '#F59E0B',     // Gold
      background: '#FEF2F2', // Light red
      name: 'Christmas'
    };
  }
  
  if (text.includes('halloween') || text.includes('spooky') || text.includes('ghost')) {
    return {
      primary: '#8B5CF6',    // Purple
      secondary: '#F59E0B',  // Orange
      accent: '#EF4444',     // Red
      background: '#F5F3FF', // Light purple
      name: 'Halloween'
    };
  }
  
  if (text.includes('easter') || text.includes('spring') || text.includes('bunny')) {
    return {
      primary: '#EC4899',    // Pink
      secondary: '#10B981',  // Green
      accent: '#FCD34D',     // Yellow
      background: '#FDF2F8', // Light pink
      name: 'Easter'
    };
  }
  
  if (text.includes('summer') || text.includes('beach') || text.includes('ocean')) {
    return {
      primary: '#3B82F6',    // Blue
      secondary: '#FCD34D',  // Yellow
      accent: '#10B981',     // Green
      background: '#EFF6FF', // Light blue
      name: 'Summer'
    };
  }
  
  // Default: Friendly and approachable
  let theme = {
    primary: '#10B981',      // Green
    secondary: '#F59E0B',    // Orange
    accent: '#3B82F6',       // Blue
    background: '#F0FDF4',   // Light green
    name: 'Friendly'
  };
  
  // Age-specific color adjustments
  if (text.includes('baby') || text.includes('toddler') || text.includes('little')) {
    // Softer, pastel colors for very young characters
    theme.primary = '#F472B6';   // Soft pink
    theme.secondary = '#FCD34D'; // Soft yellow
    theme.accent = '#A78BFA';    // Soft purple
    theme.background = '#FDF2F8'; // Very light pink
    theme.name = 'Baby-Friendly';
  } else if (text.includes('teen') || text.includes('older') || text.includes('mature')) {
    // More sophisticated colors for older characters
    theme.primary = '#7C3AED';   // Deeper purple
    theme.secondary = '#14B8A6'; // Teal
    theme.accent = '#6B7280';    // Gray
    theme.background = '#F8FAFC'; // Light gray
    theme.name = 'Teen-Friendly';
  }
  
  return theme;
}

// Generate sample HTML template with the determined color theme
function generateHTMLTemplate(colorTheme, characterName, productionTitle) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${characterName} - ${productionTitle} - Child's Guide</title>
    <link href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Fredoka+One&family=Bubblegum+Sans&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Comic Neue', cursive;
            background: linear-gradient(135deg, ${colorTheme.background} 0%, #ffffff 100%);
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, ${colorTheme.primary} 0%, ${colorTheme.secondary} 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-family: 'Fredoka One', cursive;
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
        }
        
        .section {
            margin-bottom: 30px;
            padding: 25px;
            background: ${colorTheme.background};
            border-radius: 15px;
            border-left: 5px solid ${colorTheme.accent};
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        
        .section h2 {
            font-family: 'Bubblegum Sans', cursive;
            color: ${colorTheme.primary};
            font-size: 1.8rem;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .section h3 {
            color: ${colorTheme.secondary};
            font-size: 1.4rem;
            margin: 20px 0 10px 0;
            font-weight: 700;
        }
        
        .highlight-box {
            background: ${colorTheme.accent};
            color: white;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            font-weight: 700;
        }
        
        .tip-box {
            background: ${colorTheme.secondary};
            color: white;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            font-weight: 700;
        }
        
        .number-list {
            list-style: none;
            counter-reset: item;
        }
        
        .number-list li {
            counter-increment: item;
            margin-bottom: 15px;
            padding: 15px;
            background: white;
            border-radius: 10px;
            border: 2px solid ${colorTheme.primary};
            position: relative;
        }
        
        .number-list li::before {
            content: counter(item);
            background: ${colorTheme.primary};
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            left: -15px;
            top: 50%;
            transform: translateY(-50%);
            font-weight: 700;
        }
        
        .number-list li strong {
            color: ${colorTheme.primary};
            font-weight: 700;
        }
        
        .emoji {
            font-size: 1.5rem;
        }
        
        .footer {
            background: linear-gradient(135deg, ${colorTheme.secondary} 0%, ${colorTheme.primary} 100%);
            color: white;
            text-align: center;
            padding: 20px;
            font-weight: 700;
        }
        
        @media (max-width: 600px) {
            .header h1 { font-size: 2rem; }
            .content { padding: 20px; }
            .section { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌟 ${characterName} 🌟</h1>
            <p>Your Awesome Acting Guide for ${productionTitle}</p>
        </div>
        
        <div class="content">
            <!-- Your guide content will go here -->
        </div>
        
        <div class="footer">
            <p>🎭 You've got this! Break a leg! 🎭</p>
        </div>
    </div>
</body>
</html>`;
}

// Child's Guide Generation Function
async function generateChildGuide(data) {
  const fetch = require('node-fetch');
  
  try {
    console.log('🌟 Generating simplified Child\'s Guide...');
    
    // Search methodology for child-friendly examples
    const childMethodology = searchMethodology(
      data.characterName, 
      data.productionType, 
      data.sceneText
    );
    
    // Build context from child-friendly methodology
    let childMethodologyContext = '';
    if (childMethodology.length > 0) {
      childMethodologyContext = childMethodology.map(file => 
        `=== CHILD-FRIENDLY METHODOLOGY: ${file.filename} ===\n${file.content}\n\n`
      ).join('');
    }

         console.log(`🎭 Generating child guide using ${childMethodology.length} methodology files...`);
     
     // Determine color theme based on content
     const colorTheme = determineColorTheme(
       data.characterName, 
       data.productionTitle, 
       data.productionType, 
       data.sceneText
     );
     console.log(`🎨 Using ${colorTheme.name} color theme for child guide`);
     
     // Generate child guide using the parent guide as reference
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
              body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 6000,
          messages: [{
            role: "user",
            content: `You are Corey Ralston, a witty, experienced youth acting coach.  
Your task is to create a simplified, fun, and empowering "Child's Guide" for young actors (ages 8–12), based on the parent-facing audition prep guide.  

## Voice & Style
- Friendly, encouraging, and conversational — talk **to the child directly**.  
- Keep language simple but not babyish.  
- Fun tone with positive energy, like a coach who believes in them.  
- Use emojis sparingly for emphasis (🌟, 🎭, 🎬) — no overuse.  
- Add clear, bold section headers for easy reading.  
- Keep paragraphs short and scannable.

## Structure
Your guide must follow this flow:
1. **Big Welcome**
   - Greet the actor, mention the role name and project title, and remind them they've got this.
2. **About Your Character**
   - Describe who they are, what makes them unique, and their personality.
   - Keep it relatable and fun, like explaining to a friend.
3. **What's Happening in the Scene**
   - Explain the scene setup in simple language.
4. **Acting Jobs (Action Plan)**
   - Numbered list of 3–5 specific things they need to focus on in the scene.
   - Use bold keywords for clarity.
5. **Fun Acting Tips**
   - Ideas for how they can explore choices (different voices, physicality, emotions).
6. **Moment Before & Button**
   - A simple explanation of what happens right before the scene and how to finish strong.
7. **Practice Ideas**
   - Easy practice tasks or "games" to rehearse their choices.
8. **Final Encouragement**
   - Short, upbeat closing that reminds them they are ready and capable.

## HTML Styling & Colors
Create a complete HTML document with embedded CSS using this EXACT color theme:

**${colorTheme.name.toUpperCase()} THEME COLORS:**
- Primary: ${colorTheme.primary}
- Secondary: ${colorTheme.secondary}  
- Accent: ${colorTheme.accent}
- Background: ${colorTheme.background}

**HTML TEMPLATE REFERENCE:**
Use this structure and styling approach (replace the placeholder content with your guide):

${generateHTMLTemplate(colorTheme, data.characterName, data.productionTitle)}

**IMPORTANT:** 
- Use the exact colors provided above
- Follow the CSS class names from the template (.section, .highlight-box, .tip-box, .number-list)
- Keep the fun, youthful design with rounded corners, shadows, and gradients
- Make sure all content is properly wrapped in the HTML structure

2. **Youthful Design Elements**:
   - Rounded corners (border-radius: 12px)
   - Soft shadows (box-shadow: 0 4px 20px rgba(0,0,0,0.1))
   - Fun fonts (Google Fonts: 'Comic Neue', 'Fredoka One', 'Bubblegum Sans')
   - Gradient backgrounds
   - Emoji icons for section headers
   - Colorful accent borders

3. **Responsive Layout**:
   - Mobile-friendly design
   - Easy-to-read typography
   - Clear visual hierarchy
   - Comfortable spacing

## Rules
- NO overly adult jargon — explain complex ideas in kid-friendly terms.
- NO summarizing or shortening beyond what's needed for age clarity — keep the guide complete and helpful.
- Reference the parent guide's insights for accuracy but rewrite it in a playful, empowering style.
- When the role skews younger (under 8), simplify even further and lean into fun phrasing and examples.
- ALWAYS include complete HTML with embedded CSS styling and appropriate colors.

## References
Match the tone, depth, and structure of these examples:
- Tucker's Guide (age 9)  
- Eloise's Guide (age 10)  
- Alanna's Guide (age 4–6)  
- Alma's Guide (age 8)  

## Current Project
CHARACTER: ${data.characterName}
PRODUCTION: ${data.productionTitle} (${data.productionType})

SCRIPT:
${data.sceneText}

## Parent Guide Reference
${data.parentGuideContent.substring(0, 2000)}...

## Child-Friendly Methodology
${childMethodologyContext}

**OUTPUT FORMAT:** Output ONLY the raw HTML content without any markdown formatting, code blocks, or \`\`\`html wrappers. The response should be a complete HTML document with embedded CSS styling, fun colors, and perfect for young actors!`
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Child Guide Generation Error:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.content && result.content[0] && result.content[0].text) {
      console.log(`✅ Child's Guide generated successfully!`);
      console.log(`📊 Child guide length: ${result.content[0].text.length} characters`);
      return result.content[0].text;
    } else {
      throw new Error('Invalid response format from API');
    }

  } catch (error) {
    console.error('❌ Child guide generation failed:', error.message);
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
   const { uploadId, uploadIds, characterName, productionTitle, productionType, roleSize, genre, storyline, characterBreakdown, callbackNotes, focusArea, childGuideRequested } = req.body;
   
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
         generatedHtml: guideContent,
         childGuideRequested: childGuideRequested || false,
         childGuideCompleted: false
       });

     console.log(`💾 Guide saved to database with ID: ${guide.id}`);

     // Second Pass: Generate Child's Guide if requested
     let childGuideContent = null;
     if (childGuideRequested) {
       console.log(`🌟 Starting second pass: Child's Guide generation for ${characterName}`);
       console.log(`🌟 Child guide request details:`, {
         characterName: characterName.trim(),
         productionTitle: productionTitle.trim(),
         productionType: productionType.trim(),
         sceneTextLength: combinedSceneText.length,
         parentGuideLength: guideContent.length
       });
       
       try {
         console.log(`🌟 Calling generateChildGuide function...`);
         const startTime = Date.now();
         
         childGuideContent = await generateChildGuide({
           sceneText: combinedSceneText,
           characterName: characterName.trim(),
           productionTitle: productionTitle.trim(),
           productionType: productionType.trim(),
           parentGuideContent: guideContent,
           extractionMethod: allUploadData[0].extractionMethod
         });

         const endTime = Date.now();
         console.log(`🌟 Child guide generation completed in ${endTime - startTime}ms`);
         console.log(`🌟 Child guide content length: ${childGuideContent ? childGuideContent.length : 0}`);

         // Update guide with child guide content
         await guide.update({
           childGuideHtml: childGuideContent,
           childGuideCompleted: true
         });

         console.log(`✅ Child's Guide completed and saved for ${characterName}`);
       } catch (childGuideError) {
         console.error('❌ Child guide generation error:', childGuideError);
         console.error('❌ Error stack:', childGuideError.stack);
         // Don't fail the entire request, just log the error
         await guide.update({
           childGuideCompleted: false
         });
       }
     } else {
       console.log(`🌟 Child guide not requested for ${characterName}`);
     }

     // Log the response being sent
     const responseData = {
       success: true,
       guideId: guide.guideId,
       guideContent: guideContent,
       childGuideRequested: childGuideRequested || false,
       childGuideCompleted: childGuideRequested ? !!childGuideContent : false,
       childGuideContent: childGuideContent,
       generatedAt: new Date(),
       savedToDatabase: true,
       metadata: {
         characterName,
         productionTitle,
         productionType,
         scriptWordCount: combinedWordCount,
         guideLength: guideContent.length,
         childGuideLength: childGuideContent ? childGuideContent.length : 0,
         model: 'claude-sonnet-4-20250514',
         ragEnabled: true,
         methodologyFiles: Object.keys(methodologyDatabase).length,
         contentQuality: 'corey-ralston-methodology-enhanced',
         fileCount: uploadIdList.length,
         uploadedFiles: uploadIdList.map(id => uploads[id].filename)
       }
     };
     
     console.log(`🌟 Sending response to frontend:`, {
       childGuideRequested: responseData.childGuideRequested,
       childGuideCompleted: responseData.childGuideCompleted,
       hasChildGuideContent: !!responseData.childGuideContent,
       childGuideContentLength: responseData.childGuideContent ? responseData.childGuideContent.length : 0
     });
     
     res.json(responseData);
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
    
    console.log('🔐 PDF endpoint - Auth header:', authHeader ? 'present' : 'missing');
    console.log('🔐 PDF endpoint - Full auth header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ PDF endpoint - No Bearer token found');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    console.log('🔐 PDF endpoint - Token length:', token.length);
    console.log('🔐 PDF endpoint - Token preview:', token.substring(0, 20) + '...');
    
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    
    console.log('🔐 PDF endpoint - JWT_SECRET present:', !!JWT_SECRET);
    console.log('🔐 PDF endpoint - JWT_SECRET length:', JWT_SECRET ? JWT_SECRET.length : 0);
    
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('🔐 PDF endpoint - JWT decoded successfully, userId:', decoded.userId);
      userId = decoded.userId;
    } catch (jwtError) {
      console.log('❌ PDF endpoint - JWT verification failed:', jwtError.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

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
    
    // Get content length safely
    const contentLength = streamAsset.asset?.size || 'unknown';
    if (contentLength !== 'unknown') {
      res.setHeader('Content-Length', contentLength);
    }

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
    
    console.log('📧 Email endpoint - Auth header:', authHeader ? 'present' : 'missing');
    console.log('📧 Email endpoint - Full auth header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Email endpoint - No Bearer token found');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    console.log('📧 Email endpoint - Token length:', token.length);
    console.log('📧 Email endpoint - Token preview:', token.substring(0, 20) + '...');
    
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    
    console.log('📧 Email endpoint - JWT_SECRET present:', !!JWT_SECRET);
    console.log('📧 Email endpoint - JWT_SECRET length:', JWT_SECRET ? JWT_SECRET.length : 0);
    
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('📧 Email endpoint - JWT decoded successfully, userId:', decoded.userId);
      userId = decoded.userId;
    } catch (jwtError) {
      console.log('❌ Email endpoint - JWT verification failed:', jwtError.message);
      return res.status(500).json({ error: 'Invalid token' });
    }

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
    
    console.log('📧 Email endpoint - EMAIL_USER:', process.env.EMAIL_USER);
    console.log('📧 Email endpoint - EMAIL_PASS present:', !!process.env.EMAIL_PASS);
    
    // Create transporter with modern Gmail configuration
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Use environment variables for security settings
      secure: process.env.EMAIL_SECURE === 'true',
      port: parseInt(process.env.EMAIL_PORT) || 465,
      tls: {
        rejectUnauthorized: false
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

    // Send email with better error handling
    console.log('📧 Attempting to send email...');
    
    try {
      const info = await transporter.sendMail({
        from: `"Prep101 Guide Generator" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `🎭 Your Prep101 Guide: ${guide.characterName} - ${guide.productionTitle}`,
        html: emailHtml
      });
      
      console.log('✅ Email sent successfully:', info.messageId);
      
      res.json({
        success: true,
        message: 'Guide email sent successfully',
        email: user.email,
        messageId: info.messageId
      });
      
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError.message);
      
      // Provide specific error messages for common Gmail issues
      let errorMessage = 'Failed to send email';
      
      if (emailError.code === 'EAUTH') {
        errorMessage = 'Email authentication failed. Please check your Gmail credentials and ensure 2FA is enabled with an app-specific password.';
      } else if (emailError.code === 'ECONNECTION') {
        errorMessage = 'Email connection failed. Please check your internet connection and Gmail settings.';
      } else if (emailError.message.includes('Username and Password not accepted')) {
        errorMessage = 'Gmail rejected credentials. Please verify your app-specific password is correct and not expired.';
      }
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        details: emailError.message
      });
    }
  } catch (error) {
    console.error('❌ Email sending error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Test email configuration
app.get('/api/test-email', async (req, res) => {
  try {
    console.log('🧪 Testing MailerSend configuration...');
    console.log('MAILERSEND_API_KEY present:', !!process.env.MAILERSEND_API_KEY);
    
    const EmailService = require('./services/emailService');
    const emailService = new EmailService();
    
    // Test the MailerSend configuration
    const testResult = await emailService.testConfiguration();
    
    if (testResult.success) {
      res.json({
        success: true,
        message: 'MailerSend configuration is valid',
        apiKey: 'Present',
        config: 'MailerSend with secure connection'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'MailerSend configuration failed',
        details: testResult.error,
        message: testResult.message
      });
    }
    
  } catch (error) {
    console.log('❌ MailerSend configuration test failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'MailerSend configuration failed',
      details: error.message
    });
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
