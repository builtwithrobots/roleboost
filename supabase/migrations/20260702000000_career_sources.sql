-- Career Sources.
--
-- External career material a candidate brings in (LinkedIn / Indeed / GitHub /
-- performance reviews / recommendations) by upload or paste. Persisted as
-- extracted text and fed into the AI brain as additional grounding -- for brain
-- assembly, recruiter-question generation, and cross-source discrepancy checks
-- in the intake interview.
--
-- This is a TEXT INPUT to the brain, not a displayable asset, so it is a sibling
-- of resume_documents (NOT candidate_assets, which holds recruiter-facing media
-- served via signed URLs). We store only the extracted text, never the original
-- binary (mirrors the résumé-parse and transcript-hardening precedents).
--
-- Security: extracted_text is private brain material. Like intake/brain data it
-- is NEVER granted to the anon role -- only the owner reads it, via the
-- authenticated RLS client. The chat/intake paths read it server-side.

CREATE TABLE IF NOT EXISTS career_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('linkedin', 'indeed', 'github', 'portfolio', 'review', 'recommendation', 'other')),
  label TEXT NOT NULL,
  ingest_method TEXT NOT NULL CHECK (ingest_method IN ('upload', 'paste', 'link')),
  extracted_text TEXT NOT NULL DEFAULT '',
  char_count INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  file_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE career_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_sources_owner ON career_sources;
CREATE POLICY career_sources_owner ON career_sources
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS career_sources_profile_idx
  ON career_sources(candidate_profile_id, is_active);
