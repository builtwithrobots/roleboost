'use server';

import { z } from 'zod';
import { currentUser } from '@clerk/nextjs/server';
import { adminClient } from '@/lib/supabase/admin';

const RoleInput = z.enum(['candidate', 'employer']);

export async function setUserRole(role: 'candidate' | 'employer') {
  const clerkUser = await currentUser();
  if (!clerkUser) return { ok: false as const, error: { code: 'UNAUTHENTICATED' } };

  const parsed = RoleInput.safeParse(role);
  if (!parsed.success) return { ok: false as const, error: { code: 'INVALID_INPUT' } };

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';

  // admin client: onboarding creates the initial user row (same as Clerk webhook).
  // Clerk session is already verified by currentUser() above.
  const { error } = await (adminClient.from('users') as any).upsert(
    { clerk_user_id: clerkUser.id, role: parsed.data, email, subscription_status: 'free' },
    { onConflict: 'clerk_user_id' }
  );

  if (error) {
    console.error('setUserRole: failed to upsert user', clerkUser.id, error);
    return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
  }

  return { ok: true as const };
}
