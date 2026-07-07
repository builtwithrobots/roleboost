import 'server-only';
import { getAdminClient } from '@/lib/supabase/admin';

// ── First-admin bootstrap ────────────────────────────────────────────────────
//
// is_admin lives only in Supabase (never in Clerk metadata, never trusted from the
// client). That leaves a chicken-and-egg problem: you cannot grant admin from an
// admin-only UI when no admin exists yet. SUPERADMIN_EMAILS solves it, any user
// whose email is in the allowlist is self-healed to is_admin = TRUE the first time
// they resolve their context. After that the flag persists in the DB and the
// allowlist is only a safety net. Grant/revoke of every OTHER admin happens through
// the audited server action, not this env var.

/** Parsed, lowercased set of bootstrap-admin emails from SUPERADMIN_EMAILS. */
export function getBootstrapAdminEmails(): Set<string> {
  const raw = process.env.SUPERADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getBootstrapAdminEmails().has(email.toLowerCase());
}

/**
 * If the user is on the bootstrap allowlist but not yet flagged admin in the DB,
 * flip is_admin = TRUE (one write, then never again). Returns the effective
 * is_admin value so callers can use it immediately. Safe to call on every request:
 * it only writes when the flag actually needs setting.
 */
export async function ensureAdminBootstrap(
  clerkUserId: string,
  email: string | null | undefined,
  currentIsAdmin: boolean,
): Promise<boolean> {
  if (currentIsAdmin) return true;
  if (!isBootstrapAdminEmail(email)) return false;

  const { error } = await (getAdminClient().from('users') as any)
    .update({ is_admin: true })
    .eq('clerk_user_id', clerkUserId);

  if (error) {
    // Non-fatal: fall back to not-admin for this request rather than throwing and
    // locking the user out entirely. The next request retries the heal.
    console.error('ensureAdminBootstrap: failed to set is_admin for', clerkUserId, error);
    return false;
  }
  return true;
}
