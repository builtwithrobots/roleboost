'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

const StageSchema = z.enum(['saved', 'screening', 'interview', 'offer', 'passed']);
const NotesSchema = z.string().max(2000);

async function getCallerEmployerAccountId(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').getRequestClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('employer_members')
    .select('employer_account_id')
    .eq('clerk_user_id', userId)
    .single();
  return (data as { employer_account_id: string } | null)?.employer_account_id ?? null;
}

export async function updateCandidateStage(savedId: string, stage: string) {
  try {
    const { supabase, userId } = await getUserContext('employer');
    const parsed = StageSchema.parse(stage);

    const employerAccountId = await getCallerEmployerAccountId(supabase, userId);
    if (!employerAccountId) return { ok: false as const, error: { code: 'FORBIDDEN' } };

    const { error } = await supabase
      .from('saved_candidates')
      .update({ stage: parsed, updated_at: new Date().toISOString() })
      .eq('id', savedId)
      .eq('employer_account_id', employerAccountId);

    if (error) {
      console.error('updateCandidateStage: failed', savedId, error);
      return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    }

    revalidatePath('/dashboard/board');
    revalidatePath('/dashboard/candidates');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

export async function updateCandidateNotes(savedId: string, notes: string) {
  try {
    const { supabase, userId } = await getUserContext('employer');
    const parsedNotes = NotesSchema.parse(notes);

    const employerAccountId = await getCallerEmployerAccountId(supabase, userId);
    if (!employerAccountId) return { ok: false as const, error: { code: 'FORBIDDEN' } };

    const { error } = await supabase
      .from('saved_candidates')
      .update({ notes: parsedNotes, updated_at: new Date().toISOString() })
      .eq('id', savedId)
      .eq('employer_account_id', employerAccountId);

    if (error) {
      console.error('updateCandidateNotes: failed', savedId, error);
      return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    }

    revalidatePath('/dashboard/board');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
