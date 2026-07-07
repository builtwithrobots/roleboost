'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { assertCandidateAiAccess, EntitlementError } from '@/lib/auth/entitlements';
import type { CareerContextDrafts, CustomQAPair } from '@/lib/types';

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

const SelectAngleInput = z.object({ angle: z.enum(['A', 'B']) });

// Promotes one generated narrative angle to the candidate's active career-context
// document. Records the selection on career_context_drafts and copies the chosen
// angle's markdown into context_package_md -- the single slot the brain reads and
// the assets page downloads. Switching angles later is just another call here; no
// regeneration needed.
export async function selectCareerContextAngle(input: unknown) {
  try {
    const { supabase, userId, user } = await getUserContext('candidate');
    assertCandidateAiAccess(user);
    const { angle } = SelectAngleInput.parse(input);

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('career_context_drafts')
      .eq('clerk_user_id', userId)
      .single();

    const drafts = (profile as { career_context_drafts: CareerContextDrafts | null } | null)
      ?.career_context_drafts;
    const chosen = drafts?.angles?.[angle];
    if (!drafts || !chosen) {
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'No generated angle to select' } };
    }

    const updated: CareerContextDrafts = { ...drafts, selected: angle };
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('candidate_profiles')
      .update({
        career_context_drafts: updated,
        context_package_md: chosen.markdown,
        context_package_updated_at: now,
        updated_at: now,
      })
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    revalidatePath('/dashboard/assets');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof EntitlementError) return { ok: false as const, error: { code: e.code } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const SourceIdInput = z.object({ sourceId: z.string().uuid() });

export async function deleteCareerSource(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sourceId } = SourceIdInput.parse(input);

    // RLS scopes the delete to the candidate's own sources.
    const { error } = await supabase.from('career_sources').delete().eq('id', sourceId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const AdoptGapInput = z.object({ gapId: z.string().uuid() });

/**
 * One-click learning: approves a gap's drafted answer into custom_qa_pairs
 * (highest-priority layer of the brain) and marks the gap addressed. The draft
 * was generated grounded only in the brain's own data; the candidate's click is
 * the human approval step.
 */
export async function adoptGapAnswer(input: unknown) {
  try {
    const { supabase, userId, user } = await getUserContext('candidate');
    assertCandidateAiAccess(user);
    const { gapId } = AdoptGapInput.parse(input);

    // RLS scopes both reads to the candidate's own rows.
    const { data: gap } = await supabase
      .from('transcript_gaps')
      .select('id, question_asked, suggested_answer, is_addressed')
      .eq('id', gapId)
      .maybeSingle();
    const gapRow = gap as {
      id: string;
      question_asked: string;
      suggested_answer: string | null;
      is_addressed: boolean;
    } | null;
    if (!gapRow || !gapRow.suggested_answer?.trim()) {
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'No drafted answer to adopt' } };
    }

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('custom_qa_pairs')
      .eq('clerk_user_id', userId)
      .single();
    if (!profile) return { ok: false as const, error: { code: 'NOT_FOUND' } };

    const rawPairs = (profile as { custom_qa_pairs: unknown }).custom_qa_pairs;
    const pairs: CustomQAPair[] = Array.isArray(rawPairs)
      ? (rawPairs as CustomQAPair[]).filter(
          (p) => p && typeof p.question === 'string' && typeof p.answer === 'string',
        )
      : [];

    const question = gapRow.question_asked.trim();
    const answer = gapRow.suggested_answer.trim();
    const exists = pairs.some((p) => p.question.trim().toLowerCase() === question.toLowerCase());
    if (!exists) {
      if (pairs.length >= 50) {
        return {
          ok: false as const,
          error: { code: 'INVALID_INPUT', message: 'Custom answers are full (50). Remove one first.' },
        };
      }
      pairs.push({ question, answer });
      const { error: updateError } = await supabase
        .from('candidate_profiles')
        .update({ custom_qa_pairs: pairs, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
      if (updateError) {
        return { ok: false as const, error: { code: 'INTERNAL', message: updateError.message } };
      }
    }

    await supabase.from('transcript_gaps').update({ is_addressed: true }).eq('id', gapId);

    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof EntitlementError) return { ok: false as const, error: { code: e.code } };
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

const SessionIdInput = z.object({ sessionId: z.string().uuid() });

export async function deleteHardeningSession(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sessionId } = SessionIdInput.parse(input);

    // RLS scopes the delete to the candidate's own hardening sessions.
    const { error } = await supabase
      .from('brain_hardening_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

export async function clearHardeningHistory() {
  try {
    const { supabase, userId } = await getUserContext('candidate');

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();
    if (!profile) return { ok: false as const, error: { code: 'NOT_FOUND' } };

    // RLS scopes this too; the explicit filter keeps it indexed and clear.
    const { error } = await supabase
      .from('brain_hardening_sessions')
      .delete()
      .eq('candidate_profile_id', (profile as { id: string }).id);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
