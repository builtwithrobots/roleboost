import 'server-only';

// Cloudflare Turnstile server-side verification for the public chat surface.
// Invisible/managed mode: real recruiters never see a challenge; automated bots
// fail the token check. Graceful degradation is the whole point here -- until
// the keys are provisioned, turnstileEnabled() is false and the chat works
// exactly as before, so this is safe to ship ahead of the env vars.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** True only when the secret is configured; callers skip the check otherwise. */
export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * Verifies a Turnstile token with Cloudflare. Returns true when the token is
 * valid, or when Turnstile is not configured (degrade open). Only returns false
 * for a present-but-invalid token, so genuine bot failures are the only block.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured -> do not block
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    // Network/verify failure: degrade open rather than lock out real recruiters.
    // Rate limiting still applies as the backstop.
    console.error('verifyTurnstile: failed', e);
    return true;
  }
}
