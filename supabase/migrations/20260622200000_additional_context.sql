-- Optional freeform "Additional Context" pitch on the candidate profile.
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS additional_context TEXT
  CHECK (additional_context IS NULL OR char_length(additional_context) <= 2000);
