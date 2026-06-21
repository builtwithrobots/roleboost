'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

const StageSchema = z.enum(['saved', 'screening', 'interview', 'offer', 'passed']);

export async function updateCandidateStage(savedId: string, stage: string) {
  try {
    const { supabase } = await getUserContext('employer');
    const parsed = StageSchema.parse(stage);

    const { error } = await supabase
      .from('saved_candidates')
      .update({ stage: parsed, updated_at: new Date().toISOString() })
      .eq('id', savedId);

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
    const { supabase } = await getUserContext('employer');

    const { error } = await supabase
      .from('saved_candidates')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', savedId);

    if (error) {
      console.error('updateCandidateNotes: failed', savedId, error);
      return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    }

    revalidatePath('/dashboard/board');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
