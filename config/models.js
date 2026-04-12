const DEFAULT_CLAUDE_MODEL =
  process.env.CLAUDE_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-sonnet-4-6";

// Central place to control maximum output tokens for Claude.
// Can be overridden via CLAUDE_MAX_TOKENS, then clamped by known model limits.
const REQUESTED_CLAUDE_MAX_TOKENS = parseInt(
  process.env.CLAUDE_MAX_TOKENS || "16000",
  10
);

function getModelTokenCap(model = "") {
  const normalized = String(model || "").toLowerCase();

  // Claude 3.7 Sonnet rejects requests above 8192 output tokens.
  if (normalized.startsWith("claude-3-7-sonnet")) return 8192;

  return Number.POSITIVE_INFINITY;
}

const DEFAULT_CLAUDE_MAX_TOKENS = Math.min(
  REQUESTED_CLAUDE_MAX_TOKENS,
  getModelTokenCap(DEFAULT_CLAUDE_MODEL)
);

module.exports = { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS };
