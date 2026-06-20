import 'server-only';
import { auth } from '@clerk/nextjs/server';
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
  subscription_tier: SubscriptionTier | null;
  subscription_status: SubscriptionStatus;
};

export async function getUserContext(requiredRole?: UserRole) {
  const { userId } = await auth();
  if (!userId) throw new AuthError('UNAUTHENTICATED');

  const supabase = await getRequestClient();
  const result = await supabase
    .from('users')
    .select('role, subscription_tier, subscription_status')
    .eq('clerk_user_id', userId)
    .single();

  const user = result.data as UserRecord | null;

  if (!user) throw new AuthError('NO_USER');
  if (requiredRole && user.role !== requiredRole) throw new AuthError('FORBIDDEN');

  return { userId, supabase, role: user.role, user };
}
