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

  // Prevent role re-assignment: if a role is already set, return early.
  // This blocks role escalation (candidate → employer) and guards against
  // upsert resetting subscription_status to 'free' for paying users.
  const { data: existing } = await (adminClient.from('users') as any)
    .select('role')
    .eq('clerk_user_id', clerkUser.id)
    .single();

  if (existing?.role) {
    return { ok: true as const };
  }

  // Row either doesn't exist yet, or exists without a role (OAuth flow where the
  // Clerk webhook fired before onboarding completed). No subscription can exist
  // for a user who hasn't finished onboarding, so upsert with 'free' is safe.
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
