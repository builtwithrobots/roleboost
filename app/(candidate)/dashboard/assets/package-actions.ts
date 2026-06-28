'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

// Asset Package = the candidate's externally-generated career-context .md, stored
// as text on candidate_profiles. Upload reads the file text client-side and sends
// it here (no storage bucket / MIME handling needed).

const SaveInput = z.object({ markdown: z.string().min(30).max(100000) });

export async function saveContextPackage(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const { markdown } = SaveInput.parse(input);

    const { error } = await supabase
      .from('candidate_profiles')
      .update({
        context_package_md: markdown,
        context_package_updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/assets');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

export async function clearContextPackage() {
  try {
    const { supabase, userId } = await getUserContext('candidate');

    const { error } = await supabase
      .from('candidate_profiles')
      .update({ context_package_md: null, context_package_updated_at: null })
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/assets');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
