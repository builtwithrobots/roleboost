-- Abuse control: a shared fixed-window rate-limit counter.
--
-- Backs the anti-spam layer on the public chat pipeline (/api/chat,
-- /api/transcripts/deliver, /api/chat/schedule) and the per-candidate
-- transcript-email cap. Keyed by an opaque bucket string (ip:route,
-- session:id, transcript-email:profile, ...). Written only by the
-- service-role client via check_rate_limit(); never exposed to anon or
-- authenticated roles.

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (which bypasses RLS) touches this
-- table, and only through the function below. Lock the table down explicitly.
REVOKE ALL ON rate_limits FROM anon, authenticated;

-- Atomically records a hit against a bucket and returns whether the caller is
-- still within the limit. Fixed-window: the window resets once window_start
-- ages past p_window_seconds. Returns TRUE when the request is allowed.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limits (bucket_key, window_start, count)
  VALUES (p_key, NOW(), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET count = CASE
          WHEN rate_limits.window_start < NOW() - make_interval(secs => p_window_seconds)
            THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < NOW() - make_interval(secs => p_window_seconds)
            THEN NOW()
          ELSE rate_limits.window_start
        END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- Only the service-role client may execute the limiter.
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
