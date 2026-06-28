import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { anthropic } from '@/lib/ai/client';
import { CHAT_MODEL } from '@/lib/ai/models';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { buildCandidateSystemPrompt } from '@/lib/ai/build-system-prompt';
import { analyzeSandboxAnswer } from '@/lib/ai/analyze-sandbox';

// Owner-only sandbox analysis. Generates an answer (when none is supplied, the
// full-diagnostic path) and grades it against the candidate's own brain. Never
// delivers a transcript and is never reachable by a recruiter.
export const runtime = 'nodejs';
export const maxDuration = 45;

const PATTERN_THRESHOLD = 3;

const Input = z.object({
  candidateSlug: z.string().min(1).max(200),
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(4000).optional(),
  category: z.string().min(1).max(50),
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
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Expected JSON body' } },
      { status: 400 },
    );
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', details: parsed.error.issues } },
      { status: 400 },
    );
  }
  const { candidateSlug, question, category } = parsed.data;
  let answer = parsed.data.answer;

  // Load the brain (service-role read) and confirm the caller owns it.
  const brain = await getCandidateBrainBySlug(candidateSlug);
  if (!brain || brain.ownerClerkUserId !== userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Not your profile' } },
      { status: 403 },
    );
  }

  const systemPrompt = buildCandidateSystemPrompt(
    brain.candidate,
    brain.resumeMarkdown,
    brain.careerContextMarkdown,
  );

  // Full-diagnostic path sends only the question -- generate the answer the same
  // way a recruiter would receive it (Haiku, same system prompt).
  if (!answer) {
    try {
      const gen = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      });
      const block = gen.content.find((b) => b.type === 'text');
      answer = block && block.type === 'text' ? block.text.trim() : '';
    } catch (e) {
      console.error('sandbox: generation failed', candidateSlug, e);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Could not generate an answer' } },
        { status: 500 },
      );
    }
  }
  if (!answer) {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Empty answer' } },
      { status: 500 },
    );
  }

  let analysis;
  try {
    analysis = await analyzeSandboxAnswer({
      candidate: brain.candidate,
      resumeMarkdown: brain.resumeMarkdown,
      question,
      answer,
      category,
    });
  } catch (e) {
    console.error('sandbox: analysis failed', candidateSlug, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Analysis failed' } },
      { status: 500 },
    );
  }

  // Pattern signal: this category has produced >= threshold weak/hallucinated
  // verdicts (counting this one). RLS scopes the count to the owner's rows.
  let patternSignal = false;
  if (analysis.verdict === 'weak' || analysis.verdict === 'hallucinated') {
    const { count } = await supabase
      .from('sandbox_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_profile_id', brain.candidateProfileId)
      .eq('question_category', category)
      .in('verdict', ['weak', 'hallucinated']);
    patternSignal = (count ?? 0) + 1 >= PATTERN_THRESHOLD;
  }

  // Store the session. Best-effort -- a logging failure must not fail the response.
  const { error: insErr } = await supabase.from('sandbox_sessions').insert({
    candidate_profile_id: brain.candidateProfileId,
    question,
    question_category: category,
    ai_answer: answer,
    verdict: analysis.verdict,
    diagnosis: analysis.diagnosis,
    prescription: analysis.prescription,
    brain_field_target: analysis.brainFieldTarget,
    expansion_prompt: analysis.expansionPrompt,
    pattern_signal: patternSignal,
  });
  if (insErr) console.error('sandbox: store failed', candidateSlug, insErr);

  return NextResponse.json({ answer, ...analysis, patternSignal });
}
