-- Resume → ATS pipeline.
--
-- resume_documents holds the canonical structured résumé (JSON) + its editable
-- Markdown source, and links to the generated .docx / .pdf candidate_assets rows.
-- Kept in a separate table (not columns on candidate_profiles) to keep the large
-- JSON/markdown off the hot profile row and to support multiple variants later.

CREATE TABLE IF NOT EXISTS resume_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  source_asset_id UUID REFERENCES candidate_assets(id) ON DELETE SET NULL,
  canonical_json JSONB NOT NULL DEFAULT '{}',
  canonical_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'ready', 'approved')),
  docx_asset_id UUID REFERENCES candidate_assets(id) ON DELETE SET NULL,
  pdf_asset_id UUID REFERENCES candidate_assets(id) ON DELETE SET NULL,
  derived_suggestions JSONB,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active résumé document per candidate for now (Phase 4 relaxes this for variants).
CREATE UNIQUE INDEX IF NOT EXISTS resume_documents_one_per_profile
  ON resume_documents(candidate_profile_id);

ALTER TABLE resume_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resume_documents_owner ON resume_documents;
CREATE POLICY resume_documents_owner ON resume_documents
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());

-- Extend the asset_type CHECK to allow the generated ATS .docx (resume_docx).
-- Also fixes the pre-existing gap: 'debate_audio' is used in app code but was
-- missing from the original constraint.
ALTER TABLE candidate_assets DROP CONSTRAINT IF EXISTS candidate_assets_asset_type_check;
ALTER TABLE candidate_assets
  ADD CONSTRAINT candidate_assets_asset_type_check
  CHECK (asset_type IN ('audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume', 'resume_docx'));
