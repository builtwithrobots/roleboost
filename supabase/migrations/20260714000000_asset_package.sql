-- Asset Package -- the candidate's full career asset package (self-serve, in-app).
--
-- The AI Studio "Asset Package" tab runs the RoleBoost Candidate Asset Production
-- Skill in full (Section 1 Narrative Guide Block + Section 2, two narrative
-- perspectives each with four ready-to-run NotebookLM prompts: Deep Dive, Brief,
-- Infographic, Short Video), strategized toward a target role + optional job
-- description. The generator produces TWO perspectives; the candidate chooses one,
-- whose Section 1 renders to the active context_package_md (the single slot the
-- chat brain reads, added in the 20260705 migration). This column stages the whole
-- package + which perspective is chosen so it can be re-shown, downloaded, and
-- re-geared without regenerating.
--
-- This replaces the retired career_context_drafts staging column (left in place,
-- no longer read or written).
--
-- Security: private brain material. candidate_profiles narrows the anon role to an
-- explicit safe-column grant (see the 20260626 ai_brain migration), so columns
-- added afterwards -- including this one -- are already unreadable by anon. No
-- grant change is required here; the studio path reads/writes it server-side via
-- the authenticated client (RLS-scoped to the owner).

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS asset_package JSONB;
