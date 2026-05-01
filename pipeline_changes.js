// CHANGES TO MAKE IN claudePipelineProcessor.js
// Three targeted edits — do not rewrite the whole file

// ============================================================
// CHANGE 1: At the top of the file, add this require
// Add after the existing requires at the top
// ============================================================

const { retrieveMethodologyChunks } = require('./ragRetrieval');


// ============================================================
// CHANGE 2: Update token constants
// Find these lines and replace them
// ============================================================

// FIND:
const GUIDE_MAX_TOKENS = 8000;

// REPLACE WITH:
const GUIDE_MAX_TOKENS = 12000;
const REPAIR_MAX_TOKENS = 14000;


// ============================================================
// CHANGE 3: In generateGuideHTML(), update the repair call
// Find the repair pass sendAnthropicMessage call and change
// maxTokens from GUIDE_MAX_TOKENS to REPAIR_MAX_TOKENS
// ============================================================

// FIND (inside the repair pass):
maxTokens: GUIDE_MAX_TOKENS,

// REPLACE WITH (only in the repair call, not the first call):
maxTokens: REPAIR_MAX_TOKENS,


// ============================================================
// CHANGE 4: In generateGuideFromPdfTwoCall(), add RAG retrieval
// Find this block:
// ============================================================

// FIND:
    // Call 2: analysis  (summarizeAnalysis step removed — saves ~15-30s per request)
    const analysisStep = await generateAnalysis({
      screenplayText,
      metadata,
      apiKey,
    });

    // Call 3: HTML guide — receives analysis directly (no intermediate summary call)
    const guideStep = await generateGuideHTML({
      analysis: analysisStep.analysis,
      screenplayText,
      metadata,
      apiKey,
    });

// REPLACE WITH:
    // Call 2: analysis
    const analysisStep = await generateAnalysis({
      screenplayText,
      metadata,
      apiKey,
    });

    // RAG: Retrieve relevant methodology chunks from Supabase
    const methodologyContext = await retrieveMethodologyChunks({
      metadata,
      screenplayText,
    });

    if (methodologyContext) {
      console.log('[ClaudePipeline] RAG context injected into guide generation');
    }

    // Call 3: HTML guide
    const guideStep = await generateGuideHTML({
      analysis: analysisStep.analysis,
      screenplayText,
      metadata,
      methodologyContext,  // <-- NEW
      apiKey,
    });


// ============================================================
// CHANGE 5: In generateGuideHTML(), accept and inject the context
// Find the function signature:
// ============================================================

// FIND:
async function generateGuideHTML({
  analysis,
  summary,
  screenplayText,
  metadata,
  preferredModel,
  apiKey,
}) {

// REPLACE WITH:
async function generateGuideHTML({
  analysis,
  summary,
  screenplayText,
  metadata,
  methodologyContext = '',  // <-- NEW
  preferredModel,
  apiKey,
}) {


// ============================================================
// CHANGE 6: In generateGuideHTML(), inject methodology into the prompt
// Find the user content message:
// ============================================================

// FIND:
        content: `Generate the full Prep101 HTML guide.

${metaBlock}

SOURCE SCREENPLAY TEXT — USE THIS AS THE GROUND TRUTH:
${scriptBlock || "No screenplay text was provided. Do not generate scene-specific claims."}

SCRIPT ANALYSIS:
${contextBlock}

GROUNDING RULES:
- Use the SOURCE SCREENPLAY TEXT for every line, scene, and relationship claim.
- Do not use outside knowledge about the project title.
- If network/studio/casting/showrunner facts are absent from metadata, do not mention them.
- If the source text is insufficient for a section, say "Not stated in sides" and keep the coaching general but playable.`,

// REPLACE WITH:
        content: `Generate the full Prep101 HTML guide.

${metaBlock}

${methodologyContext ? `COREY RALSTON'S METHODOLOGY — APPLY THIS TO THE GUIDE:
${methodologyContext}

` : ''}SOURCE SCREENPLAY TEXT — USE THIS AS THE GROUND TRUTH:
${scriptBlock || "No screenplay text was provided. Do not generate scene-specific claims."}

SCRIPT ANALYSIS:
${contextBlock}

GROUNDING RULES:
- Use the SOURCE SCREENPLAY TEXT for every line, scene, and relationship claim.
- Apply Corey's methodology from the sections above to coaching language, bold choices, and character breakdown.
- Do not use outside knowledge about the project title.
- If network/studio/casting/showrunner facts are absent from metadata, do not mention them.
- If the source text is insufficient for a section, say "Not stated in sides" and keep the coaching general but playable.`,
