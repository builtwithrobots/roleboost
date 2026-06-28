-- Meeting requests.
--
-- When the candidate's Personal Assistant cannot answer a recruiter's question,
-- it offers to schedule a live conversation. The recruiter submits a couple of
-- availability ranges plus their email from the chat; that lands here for the
-- candidate to action. Inserts come from the public chat via the service-role
-- client (the recruiter is anonymous); the candidate reads/updates their own.

CREATE TABLE IF NOT EXISTS meeting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  recruiter_email TEXT NOT NULL,
  recruiter_name TEXT,
  availability TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'responded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

-- The candidate who owns the profile can read and manage their own requests.
DROP POLICY IF EXISTS meeting_requests_owner ON meeting_requests;
CREATE POLICY meeting_requests_owner ON meeting_requests
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  )
  WITH CHECK (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Recruiter submissions are inserted via the service-role client (bypasses RLS),
-- so no anon insert policy is granted here.

CREATE INDEX IF NOT EXISTS meeting_requests_profile_idx
  ON meeting_requests(candidate_profile_id, created_at DESC);
