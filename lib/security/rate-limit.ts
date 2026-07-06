import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// Application-level fixed-window rate limiting, backed by the rate_limits table +
// check_rate_limit() RPC (see 20260709 migration). Edge/IP flood protection now
// lives in the Vercel WAF (@vercel/firewall); this remains for app-domain limits
// the platform cannot express, e.g. "transcript emails per candidate per hour".
// Runs through the service-role client (callers may be anonymous recruiters).
//
// Fail-open by design: if the limiter itself errors, we allow rather than block.

/**
 * Records a hit against `key` and returns whether the caller is still within
 * `max` events per `windowSeconds`. Returns true (allowed) on any error so an
 * infra blip never breaks the flow.
 */
export async function checkAppRateLimit(
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
      console.error('checkAppRateLimit: rpc error', key, error);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error('checkAppRateLimit: threw', key, e);
    return true;
  }
}
