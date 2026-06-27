-- Profile photo (avatar) support.
--
-- Avatars reuse the existing candidate_assets pipeline + the candidate-images
-- bucket (same as infographics): owner-scoped, served via signed URLs. They are
-- never shown as a gallery tab -- the dashboard and public calling card pull the
-- active 'avatar' asset out separately for the profile header.

ALTER TABLE candidate_assets DROP CONSTRAINT IF EXISTS candidate_assets_asset_type_check;
ALTER TABLE candidate_assets
  ADD CONSTRAINT candidate_assets_asset_type_check
  CHECK (asset_type IN ('audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume', 'resume_docx', 'avatar'));
