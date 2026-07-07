-- Transcript archive + candidate management of their own conversation records.
--
-- Candidates can archive a reviewed conversation (soft state via archived_at)
-- and permanently delete it only from the archive (chat_messages cascade on the
-- session delete). The answers a candidate teaches from a transcript live
-- independently on candidate_profiles.custom_qa_pairs, so deleting a transcript
-- never removes training, deliberately: tidying the inbox must not weaken the AI.
--
-- Reads were already covered by chat_sessions_candidate_read. These add owner-
-- scoped UPDATE (for archived_at) and DELETE so the authenticated request client
-- can manage a candidate's own sessions under RLS, no service-role bypass.

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE POLICY chat_sessions_candidate_update ON chat_sessions
  FOR UPDATE TO authenticated
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

CREATE POLICY chat_sessions_candidate_delete ON chat_sessions
  FOR DELETE TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS chat_sessions_archived_idx
  ON chat_sessions(candidate_profile_id, archived_at);
