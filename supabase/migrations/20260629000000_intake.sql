-- Phase D -- AI intake interview.
--
-- The document-aware, multi-pass interview that builds the brain. Raw answers are
-- stored in intake_answers; they are then synthesized into the candidate_profiles
-- brain fields (one source of truth, editable in AI Studio). The new profile
-- columns track interview progress + the brain-readiness score. None of these are
-- granted to the anon role (the Phase A migration grants anon only the public-safe
-- column set), so intake data is never exposed on the public profile.

CREATE TABLE IF NOT EXISTS intake_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  answer_source TEXT NOT NULL DEFAULT 'typed' CHECK (answer_source IN ('typed', 'voice')),
  pass_number INTEGER NOT NULL CHECK (pass_number IN (1, 2, 3)),
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE intake_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY intake_answers_owner ON intake_answers
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS intake_answers_profile_idx
  ON intake_answers(candidate_profile_id, pass_number);

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS intake_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS intake_pass1_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_pass2_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_pass3_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brain_readiness_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inconsistencies_found JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS inconsistencies_resolved JSONB NOT NULL DEFAULT '[]';
