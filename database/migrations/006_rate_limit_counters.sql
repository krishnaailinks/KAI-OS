-- Migration 006: Persistent, multi-instance rate limiting
-- Run AFTER 005_invoices_task_id_unique.sql
--
-- Replaces the in-process rateLimitMap (Map<string, ...>) in security.ts.
-- The old map is wiped on every process restart and not shared across
-- serverless invocations or PM2 cluster workers, so rate limits had
-- zero effect in those environments.
--
-- This table + function gives atomic, durable, multi-instance rate limiting
-- in a single DB round-trip per request.
--
-- Cleanup: expired rows are reset in-place by the upsert logic — the table
-- size is bounded by (unique IPs × unique rate-limit keys), not by time.
-- An optional periodic cleanup can remove rows with reset_at far in the past.

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key      TEXT        PRIMARY KEY,
  count    INTEGER     NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_reset_at_idx
  ON public.rate_limit_counters (reset_at);

-- check_rate_limit: atomically increment the counter for a key and return
-- whether the request is allowed.
--
-- Parameters:
--   p_key         — rate limit bucket key (e.g. 'messages:1.2.3.4')
--   p_max         — maximum requests allowed in the window
--   p_window_ms   — window length in milliseconds
--
-- Returns: (allowed, remaining, reset_at)
--   allowed   — true if this request is within the limit
--   remaining — how many requests remain in the window after this one
--   reset_at  — when the current window expires

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key       TEXT,
  p_max       INTEGER,
  p_window_ms BIGINT
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql AS $$
DECLARE
  v_now      TIMESTAMPTZ := NOW();
  v_reset    TIMESTAMPTZ := v_now + (p_window_ms * INTERVAL '1 millisecond');
  v_count    INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- One atomic statement: insert-or-reset-and-increment.
  -- If the stored reset_at has passed, the window has expired → treat as a
  -- fresh window (count = 1).  Otherwise increment within the existing window.
  INSERT INTO public.rate_limit_counters AS rl (key, count, reset_at)
  VALUES (p_key, 1, v_reset)
  ON CONFLICT (key) DO UPDATE SET
    count    = CASE WHEN rl.reset_at <= v_now THEN 1 ELSE rl.count + 1 END,
    reset_at = CASE WHEN rl.reset_at <= v_now THEN v_reset ELSE rl.reset_at END
  RETURNING count, rate_limit_counters.reset_at
  INTO v_count, v_reset_at;

  RETURN QUERY SELECT
    (v_count <= p_max)              AS allowed,
    GREATEST(0, p_max - v_count)    AS remaining,
    v_reset_at                      AS reset_at;
END;
$$;
