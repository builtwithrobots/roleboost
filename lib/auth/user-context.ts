import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { adminClient, getAdminClient } from '@/lib/supabase/admin';
import { getRequestClient } from '@/lib/supabase/server';
import { createReadOnlyClient } from '@/lib/supabase/read-only';
import { ensureAdminBootstrap } from '@/lib/auth/superadmin';
import type { UserRole, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

export type { UserRole };

export class AuthError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'NO_USER' | 'NO_ROLE' | 'FORBIDDEN') {
    super(code);
  }
}

type UserRecord = {
  role: UserRole | null;
  is_admin: boolean;
  email: string | null;
  subscription_tier: SubscriptionTier | null;
  subscription_status: SubscriptionStatus;
};

// Cookie set by the admin role-switcher to preview a specific ROLE with the admin's
// OWN data. Only respected when the authenticated user is an admin.
const ADMIN_PREVIEW_COOKIE = 'rb-admin-preview-role';
// Cookie set by superadmin impersonation to view a SPECIFIC USER's dashboard and
// their real data (read-only). Holds the target's clerk_user_id. Admin-only.
const ADMIN_IMPERSONATE_COOKIE = 'rb-admin-impersonate';

export async function getAdminPreviewRole(): Promise<'candidate' | 'employer' | null> {
  const cookieStore = await cookies();
  const preview = cookieStore.get(ADMIN_PREVIEW_COOKIE)?.value;
  if (preview === 'candidate' || preview === 'employer') return preview;
  return null;
}

export async function getAdminImpersonationTarget(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_IMPERSONATE_COOKIE)?.value ?? null;
}

/** Details of an active impersonation session, exposed on the resolved context. */
export type ImpersonationState = {
  targetUserId: string;
  targetEmail: string | null;
  targetRole: UserRole;
} | null;

export async function getUserContext(requiredRole?: 'candidate' | 'employer') {
  const { userId } = await auth();
  if (!userId) throw new AuthError('UNAUTHENTICATED');

  // adminClient: Supabase Third-Party Auth (OIDC) is not required when we already
  // have the verified Clerk userId from auth(). We filter by clerk_user_id for
  // isolation, equivalent to what RLS would enforce.
  const result = await (adminClient.from('users') as any)
    .select('role, is_admin, email, subscription_tier, subscription_status')
    .eq('clerk_user_id', userId)
    .single();

  const user = result.data as UserRecord | null;

  if (!user) throw new AuthError('NO_USER');

  // Self-heal the SUPERADMIN_EMAILS allowlist into is_admin (one write, then never
  // again). This is how the very first admin is provisioned without hand-run SQL.
  const isAdmin = await ensureAdminBootstrap(userId, user.email, user.is_admin);

  // A row can exist before onboarding (the Clerk webhook creates it with a NULL
  // role). Such a user hasn't chosen candidate vs employer yet, route them to
  // onboarding rather than into a dashboard. Admins may have no chosen role and
  // still operate at /admin, so they are exempt from the NO_ROLE gate.
  if (!user.role && !isAdmin) throw new AuthError('NO_ROLE');

  // ── Superadmin impersonation (read-only) ───────────────────────────────────
  // When an admin has an active impersonation target, resolve THAT user and serve
  // their dashboard from a read-only service-role client scoped to their id. The
  // admin's own identity is preserved in actorUserId + isAdmin so admin chrome
  // still renders. Impersonation takes precedence over generic role preview.
  if (isAdmin) {
    const targetId = await getAdminImpersonationTarget();
    if (targetId && targetId !== userId) {
      const targetResult = await (getAdminClient().from('users') as any)
        .select('role, is_admin, email, subscription_tier, subscription_status')
        .eq('clerk_user_id', targetId)
        .single();
      const target = targetResult.data as UserRecord | null;

      if (target?.role === 'candidate' || target?.role === 'employer') {
        const effectiveRole = target.role;
        if (requiredRole && effectiveRole !== requiredRole) {
          throw new AuthError('FORBIDDEN');
        }
        return {
          userId: targetId,
          actorUserId: userId,
          supabase: createReadOnlyClient(getAdminClient()),
          role: effectiveRole,
          isAdmin: true,
          impersonating: {
            targetUserId: targetId,
            targetEmail: target.email,
            targetRole: effectiveRole,
          } satisfies ImpersonationState,
          user: { ...target, role: effectiveRole },
        };
      }
      // Invalid/stale target: fall through and behave as a normal admin. The cookie
      // is cleared on the next explicit stop-impersonation action.
    }
  }

  // Admins can preview either dashboard role via a cookie set by the role-switcher.
  let effectiveRole: UserRole = user.role ?? 'admin';
  if (isAdmin) {
    const preview = await getAdminPreviewRole();
    if (preview) effectiveRole = preview;
  }

  if (requiredRole && effectiveRole !== requiredRole) {
    // Admins who haven't set a preview cookie get FORBIDDEN so the switcher UI
    // can redirect them to the admin page rather than showing a blank error.
    throw new AuthError('FORBIDDEN');
  }

  // Return the request-scoped RLS-enforced client for all downstream queries.
  // adminClient is only used above for the bootstrap user-row lookup (before we
  // know the role), all other writes and reads must go through this client.
  const supabase = await getRequestClient();
  return {
    userId,
    actorUserId: userId,
    supabase,
    role: effectiveRole,
    isAdmin,
    impersonating: null as ImpersonationState,
    user: { ...user, role: effectiveRole },
  };
}
