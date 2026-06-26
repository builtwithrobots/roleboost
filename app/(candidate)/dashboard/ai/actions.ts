'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

const BrainInput = z.object({
  leadership_philosophy: z.string().max(5000).optional(),
  key_wins: z.string().max(5000).optional(),
  departure_reasons: z.string().max(5000).optional(),
  biggest_challenge: z.string().max(5000).optional(),
  ideal_environment: z.string().max(5000).optional(),
  manager_needs: z.string().max(5000).optional(),
  honest_weaknesses: z.string().max(5000).optional(),
  wish_questions: z.string().max(5000).optional(),
  custom_qa_pairs: z
    .array(
      z.object({
        question: z.string().min(1).max(500),
        answer: z.string().min(1).max(3000),
      }),
    )
    .max(50),
  redirect_topics: z.array(z.string().min(1).max(100)).max(30),
  ai_enabled: z.boolean(),
});

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export async function updateCandidateBrain(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const parsed = BrainInput.parse(input);

    const { error } = await supabase
      .from('candidate_profiles')
      .update({
        leadership_philosophy: clean(parsed.leadership_philosophy),
        key_wins: clean(parsed.key_wins),
        departure_reasons: clean(parsed.departure_reasons),
        biggest_challenge: clean(parsed.biggest_challenge),
        ideal_environment: clean(parsed.ideal_environment),
        manager_needs: clean(parsed.manager_needs),
        honest_weaknesses: clean(parsed.honest_weaknesses),
        wish_questions: clean(parsed.wish_questions),
        custom_qa_pairs: parsed.custom_qa_pairs,
        redirect_topics: parsed.redirect_topics,
        ai_enabled: parsed.ai_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId);

    if (error) {
      console.error('updateCandidateBrain: failed', userId, error);
      return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    }

    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const GapIdInput = z.object({ gapId: z.string().uuid() });

export async function markGapAddressed(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { gapId } = GapIdInput.parse(input);

    // RLS scopes the update to the candidate's own transcript gaps.
    const { error } = await supabase
      .from('transcript_gaps')
      .update({ is_addressed: true })
      .eq('id', gapId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
