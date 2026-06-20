'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/auth/user-context';

const ADMIN_PREVIEW_COOKIE = 'rb-admin-preview-role';

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
