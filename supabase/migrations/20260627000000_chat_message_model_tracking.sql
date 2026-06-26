-- Phase B -- model + validation tracking on chat turns.
--
-- The complexity router escalates adversarial / multi-part questions from Haiku
-- to Sonnet; the post-generation validation pass runs on answers that contain
-- numbers or credential claims. These columns record both, for analytics. They
-- are populated on the assistant turn (the generated message); the user turn
-- leaves them at their defaults.

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS was_complex BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS was_validated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chat_messages.model_used IS
  'claude-haiku-4-5-20251001 or claude-sonnet-4-6 -- which model generated this assistant turn';
COMMENT ON COLUMN chat_messages.was_complex IS
  'true if the complexity router escalated this question to Sonnet';
COMMENT ON COLUMN chat_messages.was_validated IS
  'true if the post-generation validation pass ran on this response';
