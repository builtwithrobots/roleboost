'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

const IdInput = z.object({ id: z.string().uuid() });

// Mark a meeting request as responded. RLS scopes the update to the candidate's
// own requests (meeting_requests_owner policy).
export async function markMeetingResponded(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { id } = IdInput.parse(input);
    const { error } = await supabase
      .from('meeting_requests')
      .update({ status: 'responded' })
      .eq('id', id);
    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/meeting-requests');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

export async function deleteMeetingRequest(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { id } = IdInput.parse(input);
    const { error } = await supabase.from('meeting_requests').delete().eq('id', id);
    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/meeting-requests');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
