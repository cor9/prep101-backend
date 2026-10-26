const fetch = require("node-fetch");

// Cartesia text-to-speech for the LineCue scene partner.
// Uses the REST /tts/bytes endpoint (one request in, one audio file out) via
// node-fetch rather than the SDK, matching how we call Anthropic and OpenAI.

const CARTESIA_TTS_URL = "https://api.cartesia.ai/tts/bytes";
const CARTESIA_VERSION = process.env.CARTESIA_VERSION || "2026-03-01";
// Sonic 3.6. "sonic-3.6" tracks the latest stable 3.6 snapshot; pin a dated
// snapshot (e.g. "sonic-3.6-2026-08-27") through the env var if voices drift.
const CARTESIA_MODEL_ID = process.env.CARTESIA_MODEL_ID || "sonic-3.6";
const DEFAULT_VOICE_ID = process.env.CARTESIA_DEFAULT_VOICE_ID || "";
const REQUEST_TIMEOUT_MS = 20000;

// LineCue emotions (from the Claude extraction schema) -> Cartesia emotion tags.
const EMOTION_MAP = {
  anger: "angry",
  sadness: "sad",
  surprise: "surprised",
  neutral: "neutral",
};

const OUTPUT_FORMATS = {
  mp3: {
    contentType: "audio/mpeg",
    body: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
  },
  // Raw 16-bit little-endian PCM, mono, for Web Audio playback with no decode step.
  pcm: {
    contentType: "audio/pcm",
    body: { container: "raw", encoding: "pcm_s16le", sample_rate: 24000 },
  },
};

class CartesiaError extends Error {
  constructor(message, { status = 502, code = "CARTESIA_TTS_FAILED" } = {}) {
    super(message);
    this.name = "CartesiaError";
    this.status = status;
    this.code = code;
  }
}

async function generateScenePartnerAudio({
  text,
  emotion = "neutral",
  voiceId = DEFAULT_VOICE_ID,
  format = "mp3",
  speed,
  signal,
} = {}) {
  const apiKey = String(process.env.CARTESIA_API_KEY || "").trim();
  if (!apiKey) {
    throw new CartesiaError("CARTESIA_API_KEY not configured", {
      status: 503,
      code: "CARTESIA_NOT_CONFIGURED",
    });
  }

  const transcript = String(text || "").trim();
  if (!transcript) {
    throw new CartesiaError("No text provided for speech synthesis", {
      status: 400,
      code: "EMPTY_TEXT",
    });
  }
  if (!voiceId) {
    throw new CartesiaError(
      "No voiceId provided and CARTESIA_DEFAULT_VOICE_ID is not set",
      { status: 400, code: "MISSING_VOICE_ID" }
    );
  }

  const outputFormat = OUTPUT_FORMATS[format];
  if (!outputFormat) {
    throw new CartesiaError(`Unsupported audio format: ${format}`, {
      status: 400,
      code: "UNSUPPORTED_FORMAT",
    });
  }

  const generationConfig = {
    emotion: EMOTION_MAP[emotion] || EMOTION_MAP.neutral,
    ...(typeof speed === "number" ? { speed } : {}),
  };

  const payload = {
    model_id: CARTESIA_MODEL_ID,
    transcript,
    voice: { mode: "id", id: voiceId },
    output_format: outputFormat.body,
    language: "en",
    generation_config: generationConfig,
  };

  // Abort on our own timeout or when the caller's signal fires.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onCallerAbort, { once: true });

  let response;
  try {
    response = await fetch(CARTESIA_TTS_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Cartesia-Version": CARTESIA_VERSION,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new CartesiaError("Cartesia TTS request timed out", {
        status: 504,
        code: "CARTESIA_TIMEOUT",
      });
    }
    throw new CartesiaError(`Cartesia TTS request failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener("abort", onCallerAbort);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[Cartesia] TTS error ${response.status} [model=${CARTESIA_MODEL_ID}]: ${errorText}`
    );
    throw new CartesiaError(
      `Cartesia TTS error ${response.status}: ${errorText.slice(0, 300)}`,
      // Pass through bad-input errors; anything else (auth, quota, outage) is
      // our upstream's problem, not the caller's.
      { status: [400, 422].includes(response.status) ? 400 : 502 }
    );
  }

  const audio = await response.buffer();

  return {
    audio,
    contentType: outputFormat.contentType,
    format,
    sampleRate: outputFormat.body.sample_rate,
    model: CARTESIA_MODEL_ID,
  };
}

module.exports = {
  CartesiaError,
  EMOTION_MAP,
  generateScenePartnerAudio,
};
