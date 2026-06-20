import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { getRequestClient } from '@/lib/supabase/server';
import type { UserRole, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

export type { UserRole };

export class AuthError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'NO_USER' | 'FORBIDDEN') {
    super(code);
  }
}

type UserRecord = {
  role: UserRole;
  is_admin: boolean;
  subscription_tier: SubscriptionTier | null;
  subscription_status: SubscriptionStatus;
};

// Cookie name used by the admin role-switcher to preview a specific role.
// Only respected when the authenticated user is an admin.
const ADMIN_PREVIEW_COOKIE = 'rb-admin-preview-role';

export async function getAdminPreviewRole(): Promise<'candidate' | 'employer' | null> {
  const cookieStore = await cookies();
  const preview = cookieStore.get(ADMIN_PREVIEW_COOKIE)?.value;
  if (preview === 'candidate' || preview === 'employer') return preview;
  return null;
}

export async function getUserContext(requiredRole?: 'candidate' | 'employer') {
  const { userId } = await auth();
  if (!userId) throw new AuthError('UNAUTHENTICATED');

  const supabase = await getRequestClient();
  const result = await supabase
    .from('users')
    .select('role, is_admin, subscription_tier, subscription_status')
    .eq('clerk_user_id', userId)
    .single();

  const user = result.data as UserRecord | null;

  if (!user) throw new AuthError('NO_USER');

  // Admins can preview either dashboard role via a cookie set by the role-switcher.
  let effectiveRole: UserRole = user.role;
  if (user.is_admin) {
    const preview = await getAdminPreviewRole();
    if (preview) effectiveRole = preview;
  }

  if (requiredRole && effectiveRole !== requiredRole) {
    // Admins who haven't set a preview cookie get FORBIDDEN so the switcher UI
    // can redirect them to the admin page rather than showing a blank error.
    throw new AuthError('FORBIDDEN');
  }

  return {
    userId,
    supabase,
    role: effectiveRole,
    isAdmin: user.is_admin,
    user: { ...user, role: effectiveRole },
  };
}
