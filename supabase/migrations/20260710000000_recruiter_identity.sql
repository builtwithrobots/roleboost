-- Optional recruiter self-identification on a chat session.
--
-- Anonymous recruiters can (optionally, never required) share who they are so
-- the candidate knows who reached out and can follow up, and so the recruiter
-- gets their own copy of the transcript by email. Company reuses the existing
-- employer_company_name column. Written via the service-role client from the
-- public /api/chat/identify endpoint.

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS recruiter_name TEXT;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS recruiter_email TEXT;
