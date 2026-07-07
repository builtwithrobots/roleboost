'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getUserContext } from '@/lib/auth/user-context';
import { getAdminContext } from '@/lib/auth/admin-context';
import { logAdminAction } from '@/lib/auth/audit';

const ADMIN_PREVIEW_COOKIE = 'rb-admin-preview-role';
const ADMIN_IMPERSONATE_COOKIE = 'rb-admin-impersonate';

export type AdminActionResult =
  | { ok: true }
  | { ok: false; error: { code: string; message?: string } };

/** Preview a dashboard ROLE with the admin's own data (existing behaviour). */
export async function setAdminPreviewRole(role: 'candidate' | 'employer' | 'none') {
  const ctx = await getUserContext();
  if (!ctx.isAdmin) {
    return { ok: false as const, error: { code: 'FORBIDDEN' } };
  }

  const cookieStore = await cookies();

  if (role === 'none') {
    cookieStore.delete(ADMIN_PREVIEW_COOKIE);
    redirect('/admin');
  }

  cookieStore.set(ADMIN_PREVIEW_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // No maxAge = session cookie; clears on browser close.
  });

  redirect(role === 'candidate' ? '/dashboard/profile' : '/dashboard/candidates');
}

/**
 * Start a read-only impersonation session for a specific user. Sets the target
 * cookie, records an audit row, and drops the admin into that user's dashboard.
 * Any active role-preview is cleared so the two mechanisms never stack.
 */
export async function impersonateUser(targetClerkUserId: string) {
  const { actorUserId, adminClient } = await getAdminContext();

  const result = await (adminClient.from('users') as any)
    .select('role, email')
    .eq('clerk_user_id', targetClerkUserId)
    .single();
  const target = result.data as { role: string | null; email: string | null } | null;

  if (!target || (target.role !== 'candidate' && target.role !== 'employer')) {
    return { ok: false as const, error: { code: 'NOT_FOUND', message: 'User has no candidate or employer dashboard.' } };
  }
  if (targetClerkUserId === actorUserId) {
    return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'You cannot impersonate yourself.' } };
  }

  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_PREVIEW_COOKIE);
  cookieStore.set(ADMIN_IMPERSONATE_COOKIE, targetClerkUserId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  await logAdminAction({
    actorUserId,
    action: 'impersonate.start',
    targetUserId: targetClerkUserId,
    context: { email: target.email, role: target.role },
  });

  redirect(target.role === 'candidate' ? '/dashboard/profile' : '/dashboard/candidates');
}

/**
 * End any active admin session (preview OR impersonation), clearing both cookies,
 * and return to /admin. Records an audit row when an impersonation was active.
 */
export async function exitAdminSession() {
  const { actorUserId } = await getAdminContext();
  const cookieStore = await cookies();
  const targetId = cookieStore.get(ADMIN_IMPERSONATE_COOKIE)?.value ?? null;
  cookieStore.delete(ADMIN_IMPERSONATE_COOKIE);
  cookieStore.delete(ADMIN_PREVIEW_COOKIE);

  if (targetId) {
    await logAdminAction({
      actorUserId,
      action: 'impersonate.stop',
      targetUserId: targetId,
    });
  }

  redirect('/admin');
}

/**
 * Grant or revoke superadmin on another user. Audited. Guardrail: an admin can
 * never revoke their own access (prevents accidental self-lockout).
 */
export async function setUserAdmin(
  targetClerkUserId: string,
  makeAdmin: boolean,
): Promise<AdminActionResult> {
  const { actorUserId, adminClient } = await getAdminContext();

  if (targetClerkUserId === actorUserId && !makeAdmin) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'You cannot revoke your own admin access.' } };
  }

  const { error } = await (adminClient.from('users') as any)
    .update({ is_admin: makeAdmin })
    .eq('clerk_user_id', targetClerkUserId);

  if (error) {
    return { ok: false, error: { code: 'INTERNAL', message: error.message } };
  }

  await logAdminAction({
    actorUserId,
    action: makeAdmin ? 'admin.grant' : 'admin.revoke',
    targetUserId: targetClerkUserId,
  });

  revalidatePath('/admin');
  return { ok: true };
}

export type AdminUserResult = {
  clerk_user_id: string;
  email: string | null;
  role: string | null;
  is_admin: boolean;
};

/** Search users by email for the command palette. Admin-gated. */
export async function searchAdminUsers(query: string): Promise<AdminUserResult[]> {
  const { adminClient } = await getAdminContext();

  let builder = (adminClient.from('users') as any)
    .select('clerk_user_id, email, role, is_admin')
    .order('created_at', { ascending: false })
    .limit(12);

  const trimmed = query.trim();
  if (trimmed) {
    builder = builder.ilike('email', `%${trimmed}%`);
  }

  const { data } = await builder;
  return (data ?? []) as AdminUserResult[];
}
