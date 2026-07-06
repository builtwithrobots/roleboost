-- Meeting request status pipeline.
--
-- Expand the two-state status (new / responded) into a lightweight inbound
-- pipeline so the candidate can track where each request stands:
--   new -> contacted -> scheduled -> closed
-- Existing 'responded' rows map to 'closed'.

ALTER TABLE meeting_requests DROP CONSTRAINT IF EXISTS meeting_requests_status_check;

UPDATE meeting_requests SET status = 'closed' WHERE status = 'responded';

ALTER TABLE meeting_requests ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE meeting_requests
  ADD CONSTRAINT meeting_requests_status_check
  CHECK (status IN ('new', 'contacted', 'scheduled', 'closed'));
