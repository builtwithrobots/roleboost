import 'server-only';
import { NextRequest } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';

// Fixed-window rate limiting for the public, anonymous endpoints. Backed by the
// rate_limits table + check_rate_limit() RPC (see 20260709 migration), which
// increments and evaluates a bucket atomically. Runs through the service-role
// client because the callers are unauthenticated recruiters.
//
// Fail-open by design: if the limiter itself errors (DB hiccup, missing env),
// we allow the request rather than lock out a legitimate recruiter. Turnstile
// and the per-candidate email cap provide defense in depth.

/**
 * Records a hit against `key` and returns whether the caller is still within
 * `max` requests per `windowSeconds`. Returns true (allowed) on any limiter
 * error so an infra blip never breaks the chat.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await (adminClient.rpc as any)('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('checkRateLimit: rpc error', key, error);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error('checkRateLimit: threw', key, e);
    return true;
  }
}

/**
 * Best-effort client IP from the standard proxy headers. Vercel sets
 * x-forwarded-for; we take the first hop. Falls back to a constant so a missing
 * header degrades to a shared bucket rather than throwing.
 */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
