const DEFAULT_CLAUDE_MODEL =
  process.env.CLAUDE_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "claude-3-7-sonnet-20250219";

// Central place to control maximum output tokens for Claude
// Can be overridden via CLAUDE_MAX_TOKENS if needed.
const DEFAULT_CLAUDE_MAX_TOKENS = parseInt(
  process.env.CLAUDE_MAX_TOKENS || '16000',
  10
);

module.exports = { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS };
