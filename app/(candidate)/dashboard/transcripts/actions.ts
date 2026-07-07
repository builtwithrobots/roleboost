'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import type { CustomQAPair } from '@/lib/types';

const MAX_QA_PAIRS = 50;

const TeachInput = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(3000),
});

/**
 * Turns a real recruiter question from a transcript into a highest-priority
 * custom Q&A pair on the candidate's brain. This is the low-friction training
 * loop: read a conversation your AI fumbled, write the answer you wish it gave,
 * and it takes priority on every future chat. If a pair for the same question
 * already exists, its answer is replaced rather than duplicated.
 */
export async function teachAiFromTranscript(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const { question, answer } = TeachInput.parse(input);

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('custom_qa_pairs')
      .eq('clerk_user_id', userId)
      .single();
    if (!profile) return { ok: false as const, error: { code: 'NOT_FOUND' } };

    const existing = normalizeQA((profile as { custom_qa_pairs: unknown }).custom_qa_pairs);
    const q = question.trim();
    const a = answer.trim();

    const idx = existing.findIndex(
      (p) => p.question.trim().toLowerCase() === q.toLowerCase(),
    );
    let next: CustomQAPair[];
    if (idx >= 0) {
      next = existing.slice();
      next[idx] = { question: q, answer: a };
    } else {
      if (existing.length >= MAX_QA_PAIRS) {
        return {
          ok: false as const,
          error: { code: 'INVALID_INPUT', message: `You can save up to ${MAX_QA_PAIRS} tuned answers.` },
        };
      }
      next = [{ question: q, answer: a }, ...existing];
    }

    const { error } = await supabase
      .from('candidate_profiles')
      .update({ custom_qa_pairs: next, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };

    revalidatePath('/dashboard/transcripts');
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

function normalizeQA(raw: unknown): CustomQAPair[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is CustomQAPair =>
      !!p &&
      typeof (p as CustomQAPair).question === 'string' &&
      typeof (p as CustomQAPair).answer === 'string',
  );
}

const SessionInput = z.object({ sessionId: z.string().uuid() });

/**
 * Moves a reviewed transcript into the archive (soft state). RLS scopes the
 * update to the candidate's own sessions; matching by primary key is enough.
 */
export async function archiveTranscript(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sessionId } = SessionInput.parse(input);

    const { error } = await supabase
      .from('chat_sessions')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/transcripts');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

/** Restores an archived transcript back to the active list. */
export async function unarchiveTranscript(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sessionId } = SessionInput.parse(input);

    const { error } = await supabase
      .from('chat_sessions')
      .update({ archived_at: null })
      .eq('id', sessionId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/transcripts');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

/**
 * Permanently deletes a transcript (chat_messages cascade). Only allowed from
 * the archive: we require archived_at to be set, defense in depth beyond the UI
 * only exposing delete on archived cards. Training taught from the transcript
 * lives on candidate_profiles and is intentionally left untouched.
 */
export async function deleteTranscript(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sessionId } = SessionInput.parse(input);

    // RLS scopes this read to the candidate's own sessions.
    const { data: sess } = await supabase
      .from('chat_sessions')
      .select('id, archived_at')
      .eq('id', sessionId)
      .maybeSingle();
    if (!sess) return { ok: false as const, error: { code: 'NOT_FOUND' } };
    if (!(sess as { archived_at: string | null }).archived_at) {
      return {
        ok: false as const,
        error: { code: 'INVALID_INPUT', message: 'Archive the transcript before deleting it.' },
      };
    }

    const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/transcripts');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
