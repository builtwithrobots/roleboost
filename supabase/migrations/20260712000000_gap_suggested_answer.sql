-- One-click learning for the transcript-gap loop.
--
-- The gap analyzer now drafts a ready-to-approve answer (grounded only in the
-- brain's existing data) alongside the expansion prompt. The candidate approves
-- it with one click and it lands in custom_qa_pairs. NULL when the brain lacks
-- the substance to draft from (the candidate must write it themselves).
-- Same sensitivity as the sibling columns; owner-scoped via the existing RLS
-- policy, never granted to anon.

ALTER TABLE transcript_gaps ADD COLUMN IF NOT EXISTS suggested_answer TEXT;
