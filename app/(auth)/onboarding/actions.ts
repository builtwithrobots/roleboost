'use server';

import { z } from 'zod';
import { currentUser } from '@clerk/nextjs/server';
import { getRequestClient } from '@/lib/supabase/server';

const RoleInput = z.enum(['candidate', 'employer']);

export async function setUserRole(role: 'candidate' | 'employer') {
  const clerkUser = await currentUser();
  if (!clerkUser) return { ok: false as const, error: { code: 'UNAUTHENTICATED' } };

  const parsed = RoleInput.safeParse(role);
  if (!parsed.success) return { ok: false as const, error: { code: 'INVALID_INPUT' } };

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
  const supabase = await getRequestClient();

  const { error } = await supabase.from('users').upsert(
    { clerk_user_id: clerkUser.id, role: parsed.data, email },
    { onConflict: 'clerk_user_id' }
  );

  if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };

  return { ok: true as const };
}
