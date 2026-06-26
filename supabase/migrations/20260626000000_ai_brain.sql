-- AI Brain -- Phase A.
--
-- Adds the candidate "brain" context fields that feed the career-AI system
-- prompt, plus the chat_sessions / chat_messages tables that log every recruiter
-- conversation. Resume text is NOT duplicated here -- it is sourced from
-- resume_documents.canonical_markdown at prompt-build time.
--
-- Security note: candidate_profiles has a public-read RLS policy for the anon
-- role (is_published = TRUE), which exposes every granted column of a published
-- row. Several of the new fields are sensitive (honest weaknesses, departure
-- reasons, refined answers) and must never be scrapeable by an anonymous client.
-- This migration therefore narrows the anon role's column grants to the
-- public-safe set only. The chat path reads the full brain server-side via the
-- service-role client, so restricting anon does not affect the chatbot.

-- 1. Brain context fields on candidate_profiles --------------------------------
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS leadership_philosophy TEXT,
  ADD COLUMN IF NOT EXISTS key_wins TEXT,
  ADD COLUMN IF NOT EXISTS departure_reasons TEXT,
  ADD COLUMN IF NOT EXISTS biggest_challenge TEXT,
  ADD COLUMN IF NOT EXISTS ideal_environment TEXT,
  ADD COLUMN IF NOT EXISTS manager_needs TEXT,
  ADD COLUMN IF NOT EXISTS honest_weaknesses TEXT,
  ADD COLUMN IF NOT EXISTS wish_questions TEXT,
  ADD COLUMN IF NOT EXISTS custom_qa_pairs JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS redirect_topics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Narrow anon column access ------------------------------------------------
-- Replace the anon role's table-wide SELECT with an explicit safe-column grant.
-- The sensitive brain columns are intentionally omitted, so an anonymous client
-- can never read them even on a published profile. RLS (public_read) still gates
-- which rows are visible; this gates which columns. The authenticated role is
-- untouched -- candidates read their own full row in the dashboard, and the
-- owner RLS policy already scopes that to their own profile only.
REVOKE SELECT ON candidate_profiles FROM anon;
GRANT SELECT (
  id,
  clerk_user_id,
  slug,
  full_name,
  headline,
  target_role,
  location,
  linkedin_url,
  summary_bullets,
  additional_context,
  is_published,
  ai_enabled,
  created_at,
  updated_at
) ON candidate_profiles TO anon;

-- 3. Chat sessions ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  viewer_clerk_user_id TEXT REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE SET NULL,
  employer_company_name TEXT,
  is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  transcript_sent BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Candidate can read sessions on their own profile.
CREATE POLICY chat_sessions_candidate_read ON chat_sessions
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Employer team members can read sessions tied to their account.
CREATE POLICY chat_sessions_employer_read ON chat_sessions
  FOR SELECT TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Anonymous recruiters start sessions from the public modal. The write path uses
-- the service-role client, but this policy keeps the door open for future
-- client-side inserts without weakening read isolation above.
CREATE POLICY chat_sessions_insert ON chat_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS chat_sessions_candidate_profile_id_idx
  ON chat_sessions(candidate_profile_id);

-- 4. Chat messages ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Messages are readable by the candidate who owns the profile or the employer
-- team on the session. Inserts run via the service-role client.
CREATE POLICY chat_messages_session_access ON chat_messages
  FOR ALL TO anon, authenticated
  USING (
    chat_session_id IN (
      SELECT id FROM chat_sessions
      WHERE
        candidate_profile_id IN (
          SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
        )
        OR employer_account_id IN (
          SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
        )
    )
  );

CREATE INDEX IF NOT EXISTS chat_messages_chat_session_id_idx
  ON chat_messages(chat_session_id);
