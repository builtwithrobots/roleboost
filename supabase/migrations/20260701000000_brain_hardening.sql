-- Phase E3 -- external transcript hardening.
--
-- Candidates paste or upload a real conversation transcript (a recruiter screen,
-- a practice session with another AI, interview-debrief notes) and the platform
-- analyzes it against their brain to produce a prioritized hardening plan. The
-- raw transcript is processed in-request and NEVER stored -- only the resulting
-- plan + counts land here. Owner-scoped; never granted to anon.

CREATE TABLE IF NOT EXISTS brain_hardening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  transcript_source TEXT NOT NULL CHECK (transcript_source IN ('paste', 'file')),
  source_context TEXT,
  questions_found INTEGER NOT NULL DEFAULT 0,
  gaps_identified INTEGER NOT NULL DEFAULT 0,
  gaps_addressed INTEGER NOT NULL DEFAULT 0,
  hardening_plan JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reanalyzed_at TIMESTAMPTZ
);

ALTER TABLE brain_hardening_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY hardening_sessions_owner ON brain_hardening_sessions
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS brain_hardening_sessions_recent_idx
  ON brain_hardening_sessions(candidate_profile_id, created_at DESC);
