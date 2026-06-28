-- Career Context Document -- self-serve generation staging.
--
-- The candidate can generate their career-context document in-app (the RoleBoost
-- Candidate Asset Production Skill, Section 1 only) from their résumé + career
-- sources. The generator produces TWO narrative angles; the candidate picks one,
-- whose rendered markdown becomes the active context_package_md (added in the
-- 20260705 migration). This column stages both angles + the selection so the
-- candidate can switch angles later without regenerating.
--
-- Security: this is private brain material. candidate_profiles narrows the anon
-- role to an explicit safe-column grant (see the 20260626 ai_brain migration), so
-- columns added afterwards -- including this one and context_package_md -- are
-- already unreadable by anon. No grant change is required here; the chat/studio
-- paths read it server-side via the authenticated or service-role client.

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS career_context_drafts JSONB;
