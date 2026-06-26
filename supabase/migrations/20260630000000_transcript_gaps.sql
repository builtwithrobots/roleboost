-- Phase E2 -- transcript-to-brain gap loop.
--
-- After each recruiter conversation, the transcript is analyzed against the brain
-- and any gaps (deflections, weak answers, uncovered topics) are stored here. The
-- prompt bot surfaces them to the candidate as targeted expansion prompts. Owner-
-- scoped; never granted to anon.

CREATE TABLE IF NOT EXISTS transcript_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  question_asked TEXT NOT NULL,
  chatbot_answer TEXT NOT NULL,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('deflection', 'weak', 'new_topic')),
  suggested_prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  is_addressed BOOLEAN NOT NULL DEFAULT FALSE,
  pattern_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transcript_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY transcript_gaps_owner ON transcript_gaps
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS transcript_gaps_open_idx
  ON transcript_gaps(candidate_profile_id, is_addressed, created_at DESC);
