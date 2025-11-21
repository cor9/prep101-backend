const DEFAULT_CLAUDE_MODEL =
  process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';

// Central place to control maximum output tokens for Claude
// Can be overridden via CLAUDE_MAX_TOKENS if needed.
const DEFAULT_CLAUDE_MAX_TOKENS = parseInt(
  process.env.CLAUDE_MAX_TOKENS || '9000',
  10
);

module.exports = { DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_MAX_TOKENS };

