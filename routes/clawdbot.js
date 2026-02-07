const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Middleware to validate API Key
const validateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  const validApiKey = process.env.CLAWDBOT_API_KEY;

  console.log('🔐 Clawdbot Auth Check:');
  console.log(`   - Received Key: ${apiKey ? 'Yes (len=' + apiKey.length + ')' : 'No'}`);
  console.log(`   - Configured Key: ${validApiKey ? 'Yes (len=' + validApiKey.length + ')' : 'Missng in Env'}`);

  if (!apiKey || apiKey !== validApiKey) {
    console.log('❌ Auth Failed: Key mismatch or missing');
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing API Key',
      debug: {
        received: !!apiKey,
        configured: !!validApiKey
      }
    });
  }
  console.log('✅ Auth Successful');
  next();
};

// POST /generate
router.post('/generate', validateApiKey, async (req, res) => {
  try {
    const {
      characterName,
      actorName,
      actorAge,
      productionTitle,
      productionType,
      roleSize,
      genre,
      storyline,
      characterBreakdown,
      sceneText,
      pdfUrl
    } = req.body;

    // Validate required fields
    if (!characterName || !productionTitle || !sceneText) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: characterName, productionTitle, sceneText'
      });
    }

    // Call Anthropic API
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is missing');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    const systemPrompt = `You are a professional acting coach and script analyst. You are helping an actor prepare for an audition.
    Based on the provided details (character, production, scene), create a comprehensive audition guide.
    The response MUST be a JSON object with two fields:
    1. "guideHtml": A fully formatted HTML string (using tags like <h2>, <h3>, <p>, <ul>, <li>, <strong>) that presents the guide beautifully.
    2. "guidePlainText": A markdown version of the same guide.

    The guide should include:
    - Character Analysis (Archetype, Objective, Obstacles)
    - Scene Breakdown (Beats, emotional shifts)
    - Acting Choices (Physicality, Vocal quality)
    - "Moment Before" and "Moment After" suggestions`;

    const userPrompt = `
    Character Name: ${characterName}
    Actor Name: ${actorName} (${actorAge})
    Production: ${productionTitle} (${productionType}, ${genre})
    Role Size: ${roleSize}
    Storyline: ${storyline}
    Character Breakdown: ${characterBreakdown}

    Scene Text:
    ${sceneText}

    ${pdfUrl ? `PDF URL: ${pdfUrl}` : ''}
    `;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Anthropic API Error Details:');
        console.error(`   - Status: ${response.status} ${response.statusText}`);
        console.error(`   - Model Used: claude-3-5-sonnet-20241022`);
        console.error(`   - Error Body: ${errorText}`);

        throw new Error(`Anthropic API failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Attempt to parse JSON from Claude's response if it wrapped it in code blocks or just text
    // We asked for specific JSON fields, but LLMs sometimes add extra text.
    // Ideally we should use tool use or stricter prompting, but for now we'll parse.

    let guideHtml = "<h2>Analysis Generated</h2><p>Could not parse structured output.</p>";
    let guidePlainText = "Analysis Generated\n\nCould not parse structured output.";

    try {
        // Try to find JSON object in the text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            guideHtml = parsed.guideHtml || guideHtml;
            guidePlainText = parsed.guidePlainText || guidePlainText;
        } else {
            // Fallback if not JSON
            guidePlainText = content;
            guideHtml = `
                <div class="audition-guide">
                    <h2>Audition Guide for ${characterName}</h2>
                    ${content.replace(/\n/g, '<br/>')}
                </div>
            `;
        }
    } catch (e) {
        console.error('Error parsing Claude response:', e);
         // Fallback
         guidePlainText = content;
         guideHtml = `<div class="audition-guide"><h2>Audition Guide</h2><pre>${content}</pre></div>`;
    }

    res.json({
      success: true,
      guideHtml,
      guidePlainText
    });

  } catch (error) {
    console.error('Error in /api/clawdbot/generate:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

module.exports = router;
