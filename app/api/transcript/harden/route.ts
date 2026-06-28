import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { hardenTranscriptAnalysis } from '@/lib/ai/harden-transcript';
import { extractResumeText } from '@/lib/resume/extract-text';
import type { BrainHardeningSession } from '@/lib/types';

// Owner-only. Accepts an external transcript (paste or txt/pdf upload), analyzes
// it against the caller's own brain, and stores ONLY the resulting plan + counts.
// The raw transcript is processed in-request and never persisted (8E.5).
export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_EXT = ['txt', 'pdf'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 60_000;
const MIN_TEXT = 30;

const Fields = z.object({
  candidateSlug: z.string().min(1).max(200),
  transcriptText: z.string().max(MAX_TEXT).optional(),
  transcriptSource: z.enum(['paste', 'file']),
  sourceContext: z.string().max(200).optional(),
  reanalyzeSessionId: z.string().uuid().optional(),
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Expected multipart/form-data' } },
      { status: 400 },
    );
  }

  const parsed = Fields.safeParse({
    candidateSlug: form.get('candidateSlug') ?? undefined,
    transcriptText: form.get('transcriptText') ?? undefined,
    transcriptSource: form.get('transcriptSource') ?? undefined,
    sourceContext: form.get('sourceContext') ?? undefined,
    reanalyzeSessionId: form.get('reanalyzeSessionId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', details: parsed.error.issues } },
      { status: 400 },
    );
  }
  const { candidateSlug, sourceContext, reanalyzeSessionId } = parsed.data;

  // Resolve the transcript text: a file wins, otherwise the pasted text.
  let transcriptText = (parsed.data.transcriptText ?? '').trim();
  let transcriptSource: 'paste' | 'file' = parsed.data.transcriptSource;
  const file = form.get('file') as File | null;
  if (file && file.size > 0) {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: `Unsupported file type .${ext}, use TXT or PDF` } },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'File exceeds 10MB limit' } },
        { status: 400 },
      );
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      transcriptText = (await extractResumeText(buffer, file.type, ext)).trim();
    } catch (e) {
      console.error('harden: extraction failed', userId, e);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Could not read that file' } },
        { status: 500 },
      );
    }
    transcriptSource = 'file';
  }

  if (transcriptText.length < MIN_TEXT) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Transcript is too short to analyze' } },
      { status: 400 },
    );
  }
  if (transcriptText.length > MAX_TEXT) transcriptText = transcriptText.slice(0, MAX_TEXT);

  // Load the brain (service-role read) and confirm the caller owns it.
  const brain = await getCandidateBrainBySlug(candidateSlug);
  if (!brain || brain.ownerClerkUserId !== userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Not your profile' } },
      { status: 403 },
    );
  }

  let result;
  try {
    result = await hardenTranscriptAnalysis({
      candidate: brain.candidate,
      resumeMarkdown: brain.resumeMarkdown,
      transcriptText,
      sourceContext,
    });
  } catch (e) {
    console.error('harden: analysis failed', candidateSlug, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Analysis failed' } },
      { status: 500 },
    );
  }

  const gapsIdentified = result.gapsIdentified.length;
  const nowIso = new Date().toISOString();

  // Re-analysis: update the prior session in place and record progress. RLS scopes
  // the read/update to the owner's own rows; we also pin to this profile.
  if (reanalyzeSessionId) {
    const { data: prior } = await supabase
      .from('brain_hardening_sessions')
      .select('id, gaps_identified, candidate_profile_id, source_context, transcript_source')
      .eq('id', reanalyzeSessionId)
      .eq('candidate_profile_id', brain.candidateProfileId)
      .maybeSingle();
    if (prior) {
      const priorRow = prior as Pick<BrainHardeningSession, 'gaps_identified' | 'source_context' | 'transcript_source'>;
      const gapsAddressed = Math.max(0, priorRow.gaps_identified - gapsIdentified);
      const { error: updErr } = await supabase
        .from('brain_hardening_sessions')
        .update({
          questions_found: result.questionsFound,
          gaps_identified: gapsIdentified,
          gaps_addressed: gapsAddressed,
          hardening_plan: result.hardeningPlan,
          source_context: sourceContext ?? priorRow.source_context,
          transcript_source: transcriptSource,
          last_reanalyzed_at: nowIso,
        })
        .eq('id', reanalyzeSessionId);
      if (updErr) console.error('harden: reanalysis update failed', candidateSlug, updErr);
      return NextResponse.json({ ...result, sessionId: reanalyzeSessionId, gapsAddressed });
    }
    // Prior session not found / not owned, fall through to a fresh insert.
  }

  const { data: inserted, error: insErr } = await supabase
    .from('brain_hardening_sessions')
    .insert({
      candidate_profile_id: brain.candidateProfileId,
      transcript_source: transcriptSource,
      source_context: sourceContext ?? null,
      questions_found: result.questionsFound,
      gaps_identified: gapsIdentified,
      gaps_addressed: 0,
      hardening_plan: result.hardeningPlan,
    })
    .select('id')
    .single();
  if (insErr) console.error('harden: store failed', candidateSlug, insErr);

  return NextResponse.json({ ...result, sessionId: inserted?.id ?? null, gapsAddressed: 0 });
}
