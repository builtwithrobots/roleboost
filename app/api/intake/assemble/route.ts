import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import {
  assembleBrainFromIntake,
  computeReadiness,
  BRAIN_CATEGORIES,
  type BrainFieldKey,
} from '@/lib/ai/intake';
import { getSourceDocuments } from '@/lib/career-sources/queries';

// Owner-only. Persists the interview answers, synthesizes them into the brain
// fields (one source of truth), computes the readiness score, and marks intake
// complete. Synthesized fields only overwrite when non-empty -- never wipe
// existing content the candidate has already written.
export const runtime = 'nodejs';
export const maxDuration = 60;

const AnswerSchema = z.object({
  questionId: z.string().max(40),
  questionText: z.string().max(1000),
  answerText: z.string().min(1).max(5000),
  category: z.string().max(50),
  pass: z.number().int().min(1).max(3),
});
const Input = z.object({
  answers: z.array(AnswerSchema).min(1).max(20),
  inconsistenciesResolved: z.array(z.string().max(40)).max(50).optional(),
});

const BRAIN_SELECT = BRAIN_CATEGORIES.join(', ');

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }
  const { userId, supabase } = ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Expected JSON body' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', details: parsed.error.issues } }, { status: 400 });
  }
  const { answers, inconsistenciesResolved = [] } = parsed.data;

  // The dynamic select string trips Supabase's literal-type parser, so this one
  // query goes through the untyped builder (same pattern as the admin client).
  const { data: profile } = await (supabase.from('candidate_profiles') as any)
    .select(`id, ${BRAIN_SELECT}`)
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const row = profile as Record<string, string | null> & { id: string };
  const profileId = row.id;

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', profileId)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  // Saved career sources enrich the synthesized brain as additional grounding.
  const sources = await getSourceDocuments(supabase, profileId);

  let synthesized;
  try {
    synthesized = await assembleBrainFromIntake(resumeMarkdown, answers, sources);
  } catch (e) {
    console.error('intake assemble: synthesis failed', userId, e);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Brain assembly failed' } }, { status: 500 });
  }

  // Merge: synthesized content wins when present; otherwise keep what's there.
  const merged: Record<BrainFieldKey, string | null> = {} as Record<BrainFieldKey, string | null>;
  for (const k of BRAIN_CATEGORIES) {
    const next = synthesized[k]?.trim();
    merged[k] = next ? next : (row[k] ?? null);
  }

  const readiness = computeReadiness(merged);

  // Replace prior intake answers with this run's set.
  await supabase.from('intake_answers').delete().eq('candidate_profile_id', profileId);
  const { error: insErr } = await supabase.from('intake_answers').insert(
    answers.map((a) => ({
      candidate_profile_id: profileId,
      question_id: a.questionId,
      question_text: a.questionText,
      answer_text: a.answerText,
      answer_source: 'typed',
      pass_number: a.pass,
      category: a.category,
    })),
  );
  if (insErr) console.error('intake assemble: answer insert failed', userId, insErr);

  const { error: updErr } = await supabase
    .from('candidate_profiles')
    .update({
      ...merged,
      brain_readiness_score: readiness.overall,
      intake_completed: true,
      inconsistencies_resolved: inconsistenciesResolved,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', userId);
  if (updErr) {
    console.error('intake assemble: profile update failed', userId, updErr);
    return NextResponse.json({ error: { code: 'INTERNAL', message: updErr.message } }, { status: 500 });
  }

  revalidatePath('/dashboard/ai');
  return NextResponse.json({ brain: merged, readiness });
}
