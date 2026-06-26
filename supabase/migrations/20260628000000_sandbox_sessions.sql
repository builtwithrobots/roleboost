-- Phase C -- sandbox self-testing.
--
-- Every time a candidate runs one of their own AI's answers through the sandbox
-- analyzer, the verdict + coaching is stored here. Used for the per-answer
-- analysis card, the full-diagnostic report, and the lightweight pattern signal
-- (a category that keeps producing weak/hallucinated answers). Owner-scoped --
-- this is the candidate's private practice data, never recruiter-facing.

CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_category TEXT NOT NULL,
  ai_answer TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('strong', 'adequate', 'weak', 'hallucinated')),
  diagnosis TEXT NOT NULL,
  prescription TEXT NOT NULL,
  brain_field_target TEXT,
  expansion_prompt TEXT,
  pattern_signal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sandbox_sessions_owner ON sandbox_sessions
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS sandbox_sessions_profile_created_idx
  ON sandbox_sessions(candidate_profile_id, created_at DESC);
