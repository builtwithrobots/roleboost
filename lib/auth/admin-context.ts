import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureAdminBootstrap } from '@/lib/auth/superadmin';
import { AuthError } from '@/lib/auth/user-context';

// ── The shared superadmin guard ──────────────────────────────────────────────
//
// getAdminContext resolves the ACTOR (the real signed-in admin), independent of any
// active preview/impersonation state, and throws unless they are a superadmin. Every
// admin surface and every privileged server action calls this, so admin-ness is
// checked in exactly one place instead of being re-derived by hand at each callsite.
// It returns the service-role client for the cross-user reads admin tooling needs.

export async function getAdminContext() {
  const { userId } = await auth();
  if (!userId) throw new AuthError('UNAUTHENTICATED');

  const result = await (getAdminClient().from('users') as any)
    .select('email, is_admin')
    .eq('clerk_user_id', userId)
    .single();

  const user = result.data as { email: string | null; is_admin: boolean } | null;
  if (!user) throw new AuthError('NO_USER');

  const isAdmin = await ensureAdminBootstrap(userId, user.email, user.is_admin);
  if (!isAdmin) throw new AuthError('FORBIDDEN');

  return {
    actorUserId: userId,
    email: user.email,
    adminClient: getAdminClient(),
  };
}
