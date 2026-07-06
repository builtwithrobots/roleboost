'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

const SetStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'scheduled', 'closed']),
});

// Move a meeting request along the pipeline. RLS scopes the update to the
// candidate's own requests (meeting_requests_owner policy).
export async function setMeetingStatus(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { id, status } = SetStatusInput.parse(input);
    const { error } = await supabase.from('meeting_requests').update({ status }).eq('id', id);
    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/meeting-requests');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const IdInput = z.object({ id: z.string().uuid() });

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
