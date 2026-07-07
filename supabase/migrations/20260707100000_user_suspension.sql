-- Account suspension (admin "disable user").
--
-- suspended_at is set by a superadmin to lock a user out; getUserContext() gates on
-- it (admins themselves are exempt so they can never lock themselves out). NULL =
-- active. No RLS change: the column rides the existing users policies, and only the
-- service-role admin path ever writes it.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
