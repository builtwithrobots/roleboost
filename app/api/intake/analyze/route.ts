import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { analyzeIntakePass1, generateNextPass } from '@/lib/ai/intake';
import type { IntakeDocument } from '@/lib/types';

// Owner-only, multi-pass intake question generation. Stateless per call: the
// client supplies prior answers; the route supplies the résumé + extra sources.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TOTAL = 20;

const DocSchema = z.object({ label: z.string().min(1).max(40), text: z.string().min(1).max(20000) });
const AnswerSchema = z.object({
  questionId: z.string().max(40),
  questionText: z.string().max(1000),
  answerText: z.string().min(1).max(5000),
  category: z.string().max(50),
  pass: z.number().int().min(1).max(3),
});
const Input = z.object({
  pass: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  documents: z.array(DocSchema).max(5).optional(),
  previousAnswers: z.array(AnswerSchema).max(MAX_TOTAL).optional(),
});

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
  const { pass, documents = [], previousAnswers = [] } = parsed.data;

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const profileId = (profile as { id: string }).id;

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', profileId)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  const docs: IntakeDocument[] = [];
  if (resumeMarkdown && resumeMarkdown.trim()) docs.push({ label: 'Résumé', text: resumeMarkdown });
  docs.push(...documents);

  try {
    if (pass === 1) {
      const { inconsistencies, questions } = await analyzeIntakePass1(docs);
      await supabase
        .from('candidate_profiles')
        .update({ inconsistencies_found: inconsistencies, intake_pass1_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
      return NextResponse.json({ inconsistencies, questions, passComplete: false });
    }

    const remaining = MAX_TOTAL - previousAnswers.length;
    const questions = await generateNextPass(pass, docs, previousAnswers, remaining);
    const stamp = pass === 2 ? { intake_pass2_at: new Date().toISOString() } : { intake_pass3_at: new Date().toISOString() };
    await supabase.from('candidate_profiles').update(stamp).eq('clerk_user_id', userId);
    return NextResponse.json({ inconsistencies: [], questions, passComplete: questions.length === 0 });
  } catch (e) {
    console.error('intake analyze: failed', userId, pass, e);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Intake analysis failed' } }, { status: 500 });
  }
}
