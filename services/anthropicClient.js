const fetch = require("node-fetch");
const {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_CLAUDE_MAX_TOKENS,
} = require("../config/models");
const { sendOpenAIText } = require("./openaiClient");

const MODEL_CANDIDATES = [
  DEFAULT_CLAUDE_MODEL,
  process.env.CLAUDE_MODEL,
  process.env.ANTHROPIC_MODEL,
  "claude-sonnet-4-6",
  "claude-sonnet-4-6-20260219",
  "claude-sonnet-4-5",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307",
];

function getModelTokenCap(model = "") {
  const normalized = String(model || "").toLowerCase();

  if (normalized.startsWith("claude-3-7-sonnet")) return 8192;
  if (normalized.startsWith("claude-3-5-sonnet")) return 8192;
  if (normalized.startsWith("claude-3-5-haiku")) return 8192;
  if (normalized.startsWith("claude-3-haiku")) return 4096;

  return Number.POSITIVE_INFINITY;
}

function buildModelCandidates(preferredModel = DEFAULT_CLAUDE_MODEL) {
  return [...new Set([preferredModel, ...MODEL_CANDIDATES].filter(Boolean))];
}

function isModelNotFound(status, errorText = "") {
  if (status !== 404) return false;
  const normalized = String(errorText || "").toLowerCase();
  return (
    normalized.includes("not_found_error") ||
    normalized.includes("\"message\":\"model:") ||
    normalized.includes("model:")
  );
}

function flattenForOpenAI({ system, messages = [] }) {
  const chunks = [];

  if (system) {
    chunks.push(`SYSTEM:\n${String(system).trim()}`);
  }

  for (const message of messages) {
    if (!message) continue;
    const role = String(message.role || "user").toUpperCase();
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);
    chunks.push(`${role}:\n${content}`);
  }

  return chunks.join("\n\n---\n\n");
}

async function sendAnthropicMessage({
  apiKey,
  messages,
  system,
  maxTokens = DEFAULT_CLAUDE_MAX_TOKENS,
  preferredModel = DEFAULT_CLAUDE_MODEL,
  signal,
  openAIFallbackModel,
}) {
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const candidates = buildModelCandidates(preferredModel);
  let lastError = null;

  for (const model of candidates) {
    const effectiveMaxTokens = Math.min(maxTokens, getModelTokenCap(model));
    const payload = {
      model,
      max_tokens: effectiveMaxTokens,
      messages,
      ...(system ? { system } : {}),
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return { data, model, maxTokens: effectiveMaxTokens };
    }

    const errorText = await response.text();
    lastError = new Error(
      `Anthropic API error ${response.status} [model=${model}]: ${errorText}`
    );

    if (isModelNotFound(response.status, errorText)) {
      console.warn(
        `[Anthropic] Model unavailable: ${model}. Trying next fallback model.`
      );
      continue;
    }

    throw lastError;
  }

  const openAIKey = String(process.env.OPENAI_API_KEY || "").trim();
  const shouldTryOpenAIFallback =
    Boolean(openAIFallbackModel) && Boolean(openAIKey);

  if (shouldTryOpenAIFallback) {
    console.warn(
      `[Anthropic] All model attempts failed. Falling back to OpenAI ${openAIFallbackModel}.`
    );
    const input = flattenForOpenAI({ system, messages });
    const openAIResult = await sendOpenAIText({
      apiKey: openAIKey,
      model: openAIFallbackModel,
      input,
      maxTokens: Math.min(maxTokens, 8000),
      signal,
    });

    return {
      data: { content: [{ text: openAIResult.text }] },
      model: openAIResult.model,
      maxTokens: Math.min(maxTokens, 8000),
      provider: openAIResult.provider,
      api: openAIResult.api,
    };
  }

  throw (
    lastError ||
    new Error("Anthropic request failed across all fallback models.")
  );
}

module.exports = {
  sendAnthropicMessage,
};
