// Single source of truth for Claude model IDs. Two models, two purposes
// (see CLAUDE.md "Claude API Usage"):
//   - CHAT_MODEL: live recruiter chat — fast and cheap.
//   - GENERATION_MODEL: one-time generation (resume parsing, summaries) — higher quality.
export const CHAT_MODEL = 'claude-haiku-4-5-20251001';
export const GENERATION_MODEL = 'claude-sonnet-4-6';
