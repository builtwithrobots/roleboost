-- Asset Package -- the candidate's career-context Markdown document.
--
-- A polished, single-file context doc (generated externally for now -- e.g. a
-- Fiverr service / Claude skill) that the candidate uploads to RoleBoost to
-- store, download, and reuse (NotebookLM source, AI chat context, etc.). Stored
-- as text on the profile; private (not granted to anon). A future one-time
-- roleboost.app charge will gate generation/download.

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS context_package_md TEXT,
  ADD COLUMN IF NOT EXISTS context_package_updated_at TIMESTAMPTZ;
