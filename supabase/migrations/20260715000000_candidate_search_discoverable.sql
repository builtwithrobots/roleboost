-- Per-candidate search discoverability opt-in.
--
-- Candidate calling cards (/c/[slug]) are noindex by default, so a candidate's
-- personal career data does not surface in Google. This column lets a candidate
-- opt in from Settings: when true AND the profile is published, their page
-- becomes indexable and is added to the sitemap. Default false keeps it opt-in
-- and privacy-preserving.
--
-- Not added to the anon column grant: the public /c metadata read and the sitemap
-- read this through the service-role client, so anon never needs it. The owning
-- candidate reads/writes it through their RLS-scoped client on their own row.

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS search_discoverable BOOLEAN NOT NULL DEFAULT false;
