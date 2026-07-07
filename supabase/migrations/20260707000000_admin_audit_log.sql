-- Superadmin accountability trail.
--
-- Every privileged superadmin action (impersonate, stop-impersonate, grant/revoke
-- admin) writes a row here. Reads are admin-only; writes happen exclusively through
-- the service-role client, so there is no INSERT policy (RLS denies by default and
-- the service role bypasses RLS). This is the audit backbone the superadmin tools
-- rely on, nothing privileged happens without a record.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_clerk_user_id TEXT REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Any admin can read the full audit trail (it is a shared operational record).
CREATE POLICY admin_audit_log_admin_read ON admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_user_id = requesting_user_id()
        AND u.is_admin = TRUE
    )
  );

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log (target_clerk_user_id);
