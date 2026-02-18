
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// --- Configuration ---
const SCENE_TEXT = `
CASTING
ALEX SIDES #2
INT. CAR - NIGHT
JEN, a cop, pulls up alongside her daughter, ALEX.

JEN
Get in.

ALEX
Why? So you can yell at me? I’d rather go back to juvie.

JEN
Get in. You don’t even know where you are.

Alex looks around. She’s right. She gets in.

ALEX
Happy now?

JEN
Yeah, I’m psyched that my daughter was accused of breaking and entering when she is on probation.

ALEX
I didn’t break.

JEN
But you “entered”?

ALEX
You wouldn’t understand.

JEN
Try me.

ALEX
(ridiculous)
Try you?

JEN
Yes, try me.

ALEX
I have tried you so many times!

JEN
What are you talking about?

ALEX
I tried to tell you everything for years and you didn’t listen!

JEN
That’s not true.

ALEX
Your “Officer Mom” routine might play at the station but it doesn’t play here.

JEN
You wanted me to give up being a cop!

ALEX
Yeah, after dad died. Is that so much to ask?

JEN
It’s not just what I do, it’s who I am.

ALEX
Yeah. It’s who you are when our neighbor gets a parking ticket. You take care of those left and right.

JEN
Who cares about a parking ticket?

ALEX
Exactly. Who cares about a parking ticket. But when it was my turn, you were nowhere.

JEN
Arson is not a parking ticket.

ALEX
And I am not a neighbor.

JEN
I had to protect my reputation.

ALEX
I told you I didn’t do it.

JEN
You have told me you didn’t do a lot of things.

ALEX
Well, this time I was telling the truth.

JEN
How was I supposed to know that?

ALEX
(means for it to sting)
Mother’s intuition?

(then)
I know where we are now. I can walk.

Jen pulls over and Alex gets out.
`;

const CHARACTER_NAME = "ALEX";
const PRODUCTION_TITLE = "Disney Open Call";
const PRODUCTION_TYPE = "Single Cam Sitcom";
const ROLE_DETAILS = "Series Regular, Female, 15, rebel and jaded";

const DEFAULT_CLAUDE_MODEL = 'claude-3-haiku-20240307';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// --- Helper Functions ---

async function generateGuide() {
    if (!ANTHROPIC_API_KEY) {
        console.error('❌ ANTHROPIC_API_KEY is missing');
        return;
    }

    console.log('📚 Reading methodology files...');
    let methodologyContext = "";
    try {
        const guidePath = path.join(__dirname, '../example_guides.md');
        if (fs.existsSync(guidePath)) {
            methodologyContext = fs.readFileSync(guidePath, 'utf8');
            console.log(`✅ Loaded methodology (${methodologyContext.length} chars)`);
        } else {
            console.warn('⚠️ methodology file not found, using default context');
        }
    } catch (e) {
        console.error('Error reading methodology:', e.message);
    }

    const POLICY = `
SCRIPT INTEGRITY:
- Use ONLY facts present in SCRIPT below. If key facts (title, studio, location, time period) are not in the script, write "Not stated in sides" rather than inventing.
- Do NOT hallucinate project names, franchises, or studio info not explicitly in the script.
- For sparse scripts: acknowledge limited information, focus on what IS present, and give MORE imaginative/empathetic coaching to compensate.
- NO EVIDENCE TAGS or inline citations—trust the reader knows you're referencing the script. Just COACH.
- Tone: warm, direct, industry-savvy; balance encouragement with honest craft notes. Avoid generic motivational fluff.
`;

    const systemPrompt = `
You are PREP101, Corey Ralston's elite acting coach persona. You have access to Corey's complete methodology and reference files. Use them to deliver a personalized coaching guide that feels like Corey wrote it.

**COREY RALSTON'S METHODOLOGY:**
${methodologyContext.substring(0, 50000)}

**CURRENT AUDITION:**
CHARACTER: ${CHARACTER_NAME} (${ROLE_DETAILS})
PRODUCTION: ${PRODUCTION_TITLE} (${PRODUCTION_TYPE})

SCRIPT:
${SCENE_TEXT}

**VOICE & PERSONALITY**
- Talk directly to the actor ("You're about to...", "Your job is...").
- Open with a vivid hook that reframes the character's essence.
- Use emphatic caps sparingly and bold callouts (e.g., **Bold Choice:**, **Gold Acting Moment:**).
- Mix warmth, humor, and industry-truth honesty; always end with a FINAL PEP TALK.

**REQUIRED SECTIONS (IN THIS ORDER):**

1. **PROJECT OVERVIEW**
   - Project type, genre, tone/style.
   - Name 3-5 comparable projects with 1-sentence explanations of WHY they're relevant.
   - Scene context + "Casting Director Mindset" (what they're REALLY looking for).

2. **CHARACTER BREAKDOWN**
   - Lead with a vivid character essence hook.
   - **Who They REALLY Are** (lived-in truth).
   - **How They See Themselves vs How Others See Them**.
   - **Your Bridge to [Character]** (5+ personal prompts).
   - **The Empathy Stretch** (Accessing difference).
   - **Character Shortcut** (Metaphor).
   - **The Type (And How to Transcend It)**.
   - **Character Archetypes to Study**: List 3-5 SPECIFIC archetypes and characters from the uploaded \`character_archetype_comparables.md\` that match this vibe (e.g., "The Wounded Teen With Walls", "The Young Rebel With a Golden Heart"). Explain WHY for each.

3. **UTA HAGEN'S 9 QUESTIONS**
   - Answer ALL NINE in first-person character voice. **KEEP IT CONCISE** (1-2 sentences per question maximum).

4. **SCENE-BY-SCENE BREAKDOWN**
   - One-sentence emotional arc summary.
   - Beat-by-beat breakdown: **Briefly** state Action/Subtext/Physicality (Bullet points).
   - Identify the scene's emotional climax.

5. **PHYSICALITY & MOVEMENT**
   - Body language, vocal life, signature moves.
   - Self-tape framing notes.

6. **SUBTEXT & EMOTIONAL LAYERS**
   - Select **ONLY 3 KEY LINES** to analyze (Text -> Subtext).
   - "Trap to Avoid" and "Secret Weapon".

7. **BOLD ACTING CHOICES**
   - **Trap vs Truth** table (Line | The Cliché Delivery | The Bold Choice).
   - 2-3 "Surprising Shifts to Try".
   - Genre-specific strategy.
   - "The Audition Trap".

8. **MOMENT BEFORE & BUTTON**
   - Prep beats (Concise).
   - Button options.

9. **REHEARSAL STRATEGY** (PRIORITY SECTION)
   - **Your 10+ Takes Strategy**: Explicitly list 10 unique ways to run the scene (e.g., 1. Naturalist, 2. Angry, 3. Whisper, etc.).
   - **Alternative Callback Take**.
   - **Memorization Strategy**.
   - **Working with Reader**.

10. **ACTION PLAN**
    - Brief Checklist.

11. **FINAL PEP TALK**
    - Short & Punchy.

**OUTPUT FORMAT RULES:**
- **OUTPUT RAW HTML ONLY**. Do NOT encompass in markdown code blocks.
- Use semantic HTML tags: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>.
- **NO CSS/STYLE TAGS**: Do not include <style> blocks.
- **NO MARKDOWN**: Do not use **, ##, etc. Use <strong> and <h2>.
- Ensure text is readable on a dark background (avoid stating colors, just use default text).
`;

    console.log('🤖 Sending request to Anthropic...');

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: DEFAULT_CLAUDE_MODEL,
                max_tokens: 4096,
                messages: [{ role: "user", content: systemPrompt + POLICY }]
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const guideContent = result.content[0].text;

        console.log('✅ Guide generated successfully!');
        fs.writeFileSync(path.join(__dirname, '../guide_output.md'), guideContent);
        console.log('📄 Saved to guide_output.md');

    } catch (error) {
        console.error('❌ Generation failed:', error.message);
    }
}

generateGuide();
