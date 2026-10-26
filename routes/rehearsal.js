const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { requireBetaFeature, LINECUE_REHEARSAL_FEATURE } = require('../middleware/betaAuth');
const { ingestPdf } = require('../services/pdfIngestPipeline');
const {
  extractStructuredRehearsalScript,
  RehearsalExtractionError,
} = require('../services/rehearsalScriptService');
const { generateScenePartnerAudio, CartesiaError } = require('../services/cartesiaService');

// LineCue / Scene Rehearsal (private beta).
// Every route here costs Anthropic or Cartesia spend, so all of them require a
// valid session AND the linecue_rehearsal beta flag.

const router = express.Router();

router.use(auth, requireBetaFeature(LINECUE_REHEARSAL_FEATURE));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

// Cap per-line TTS input so one request can't run up a large Cartesia bill.
const MAX_TTS_CHARS = 1000;

// ingestPdf's cleaned text drops lines like "ALICE" or "BOB" as watermark noise,
// which strips the speaker cues rehearsal needs. Use the uncleaned text of the
// stage the pipeline picked; Claude is told to skip watermarks itself.
function getCuePreservingText(ingest) {
  const diagnostics = ingest?.diagnostics || {};
  const stage = diagnostics[`${ingest?.source}Stage`];
  const rawText = String(stage?.rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return rawText || ingest?.text || '';
}

function handleScriptUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'This PDF is too large. Please use a file under 20MB.',
        code: 'UPLOAD_FILE_TOO_LARGE',
      });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: 'File upload failed. Please try another PDF.',
        code: error.code || 'UPLOAD_ERROR',
      });
    }
    return next(error);
  });
}

// POST /api/rehearsal/process-script
// multipart/form-data with a PDF in the "file" field.
// Returns the scene's dialogue lines; the frontend then requests audio per line.
router.post('/process-script', handleScriptUpload, async (req, res) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        error: 'Please upload a PDF file in the "file" field.',
        code: 'PDF_REQUIRED',
      });
    }

    console.log(
      `[REHEARSAL] ${req.user.email || req.userId} extracting ${req.file.originalname}`
    );

    const ingest = await ingestPdf(req.file.buffer, {
      maxPages: 6,
      maxPipelineMs: 20000,
      allowLocalRaster: !process.env.VERCEL,
    });

    const scriptText = getCuePreservingText(ingest);
    if (!scriptText.trim()) {
      return res.status(422).json({
        success: false,
        error: 'We could not read any text from this PDF. Try a text-based (not scanned) copy of the sides.',
        code: 'PDF_TEXT_UNREADABLE',
      });
    }

    const { dialogueLines, characters, model, usage } =
      await extractStructuredRehearsalScript(scriptText);

    if (dialogueLines.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'No dialogue was found in this PDF.',
        code: 'NO_DIALOGUE_FOUND',
      });
    }

    console.log(
      `[REHEARSAL] Extracted ${dialogueLines.length} lines, ${characters.length} characters [model=${model}] usage=${JSON.stringify(usage)}`
    );

    res.json({
      success: true,
      dialogue_lines: dialogueLines,
      characters,
      extraction: {
        method: ingest.source || 'text',
        wordCount: ingest.wordCount || null,
        limited: Boolean(ingest.limited),
        warnings: ingest.warnings || [],
      },
    });
  } catch (error) {
    if (error instanceof RehearsalExtractionError) {
      console.warn(`[REHEARSAL] Extraction failed (${error.code}): ${error.message}`);
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }
    console.error('[REHEARSAL] process-script failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process script for rehearsal.',
      code: 'REHEARSAL_PROCESS_FAILED',
    });
  }
});

// POST /api/rehearsal/line-audio
// JSON body: { text, emotion?, voiceId?, format?: "mp3" | "pcm" }
// Proxies one line to Cartesia so the API key never reaches the browser.
router.post('/line-audio', async (req, res) => {
  try {
    const { text, emotion, voiceId, format = 'mp3' } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'text is required', code: 'EMPTY_TEXT' });
    }
    if (text.length > MAX_TTS_CHARS) {
      return res.status(413).json({
        success: false,
        error: `text must be ${MAX_TTS_CHARS} characters or fewer`,
        code: 'TEXT_TOO_LONG',
      });
    }

    const result = await generateScenePartnerAudio({
      text,
      emotion,
      voiceId: voiceId || undefined,
      format,
    });

    res.set('Content-Type', result.contentType);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Audio-Sample-Rate', String(result.sampleRate));
    res.send(result.audio);
  } catch (error) {
    if (error instanceof CartesiaError) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    }
    console.error('[REHEARSAL] line-audio failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate audio.',
      code: 'REHEARSAL_AUDIO_FAILED',
    });
  }
});

module.exports = router;
