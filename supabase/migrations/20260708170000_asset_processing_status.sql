-- Audio Boosts uploaded from NotebookLM are DASH / fragmented MP4 that a native
-- <audio> element cannot play. The asset-upload pipeline now transcodes non-MP3
-- audio to a progressive MP3 asynchronously after upload. These columns track
-- that background job so the UI can show a "processing -> ready" state.
--
-- processing_status defaults to 'ready' so every existing row and every
-- non-audio upload is unaffected; only audio that needs conversion is flagged
-- 'processing' at insert time and flipped to 'ready' (or 'failed') by the
-- conversion step.

ALTER TABLE candidate_assets
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (processing_status IN ('processing', 'ready', 'failed')),
  ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Partial index so the cron safety-net sweep for stuck jobs stays cheap.
CREATE INDEX IF NOT EXISTS candidate_assets_processing_idx
  ON candidate_assets (created_at)
  WHERE processing_status = 'processing';
