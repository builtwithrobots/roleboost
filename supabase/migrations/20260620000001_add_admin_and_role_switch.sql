-- Add is_admin flag and role constraint update to support super admin accounts
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Relax the role constraint to allow 'admin' as a valid role value
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('candidate', 'employer', 'admin'));

-- Admin accounts can read all user rows (needed for impersonation)
CREATE POLICY users_admin_read ON users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.clerk_user_id = requesting_user_id()
        AND u.is_admin = TRUE
    )
  );

-- Admin role-switch session table: tracks which role an admin is currently previewing
CREATE TABLE IF NOT EXISTS admin_role_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  previewing_role TEXT NOT NULL CHECK (previewing_role IN ('candidate', 'employer', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(admin_clerk_user_id)
);

ALTER TABLE admin_role_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_role_sessions_self ON admin_role_sessions
  FOR ALL TO authenticated
  USING (admin_clerk_user_id = requesting_user_id())
  WITH CHECK (admin_clerk_user_id = requesting_user_id());
