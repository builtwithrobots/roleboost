-- Secondary target roles: additional roles the candidate is open to, beyond
-- their single primary target_role. Populated from the AI role recommendations
-- ("Use" adds one here) and surfaced to the chat AI as context, so it can speak
-- to a fitting opportunity a recruiter raises.

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS secondary_target_roles TEXT[] NOT NULL DEFAULT '{}';
