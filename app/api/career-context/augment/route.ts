import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { assertCandidateAiAccess, EntitlementError } from '@/lib/auth/entitlements';
import { augmentCareerContextAngle } from '@/lib/ai/career-context';
import { getSourceDocuments } from '@/lib/career-sources/queries';
import type { CareerContextDrafts, CustomQAPair } from '@/lib/types';

// Owner-only, entitlement-gated. Re-synthesizes the candidate's SELECTED context
// angle, folding in their newer authored material (brain fields, refined answers,
// career sources) and refreshing third-party evidence quotes. The updated angle
// replaces the selected one and is promoted to context_package_md so the brain
// picks it up immediately. This is the "deepen the synthesis loop" path: new
// context enters the brain distilled, not as raw appended text.
export const runtime = 'nodejs';
export const maxDuration = 300;

// The authored brain fields fed into the refinement, with display labels.
const FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'key_wins', label: 'Top career wins' },
  { key: 'leadership_philosophy', label: 'Leadership philosophy' },
  { key: 'departure_reasons', label: 'Reasons for leaving roles' },
  { key: 'biggest_challenge', label: 'Biggest professional challenge' },
  { key: 'ideal_environment', label: 'Ideal team and work environment' },
  { key: 'manager_needs', label: 'What I need from a manager' },
  { key: 'honest_weaknesses', label: 'Honest weaknesses' },
  { key: 'wish_questions', label: 'Questions I wish recruiters asked' },
  { key: 'additional_context', label: 'Additional context' },
];

const PROFILE_SELECT = `id, full_name, ${FIELD_LABELS.map((f) => f.key).join(', ')}, custom_qa_pairs, career_context_drafts`;

function normalizeQA(raw: unknown): CustomQAPair[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is CustomQAPair =>
      !!p &&
      typeof (p as CustomQAPair).question === 'string' &&
      typeof (p as CustomQAPair).answer === 'string',
  );
}

export async function POST(_req: NextRequest) {
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
  const { userId, supabase, user } = ctx;

  try {
    assertCandidateAiAccess(user);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json(
        { error: { code: e.code, message: 'AI Studio requires an active subscription or trial.' } },
        { status: 402 },
      );
    }
    throw e;
  }

  // The dynamic select string trips Supabase's literal-type parser, so this read
  // goes through the untyped builder (same pattern as the intake assemble route).
  const { data: profile } = await (supabase.from('candidate_profiles') as any)
    .select(PROFILE_SELECT)
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const row = profile as Record<string, unknown> & {
    id: string;
    full_name: string;
    career_context_drafts: CareerContextDrafts | null;
  };

  const drafts = row.career_context_drafts;
  const selectedKey = drafts?.selected ?? null;
  const base = selectedKey ? drafts?.angles?.[selectedKey] : null;
  if (!drafts || !selectedKey || !base) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Generate and select an angle before updating.' } },
      { status: 400 },
    );
  }

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', row.id)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  const sources = await getSourceDocuments(supabase, row.id);

  const brainFields = FIELD_LABELS.map((f) => ({
    label: f.label,
    value: typeof row[f.key] === 'string' ? (row[f.key] as string) : null,
  }));

  let updatedAngle;
  try {
    updatedAngle = await augmentCareerContextAngle({
      fullName: row.full_name,
      base,
      resumeMarkdown,
      sources,
      brainFields,
      customQA: normalizeQA(row.custom_qa_pairs),
    });
  } catch (e) {
    console.error('career-context augment: failed', userId, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Context document update failed' } },
      { status: 500 },
    );
  }

  const updatedDrafts: CareerContextDrafts = {
    ...drafts,
    angles: { ...drafts.angles, [selectedKey]: updatedAngle },
  };
  const now = new Date().toISOString();

  const { error: updErr } = await supabase
    .from('candidate_profiles')
    .update({
      career_context_drafts: updatedDrafts,
      context_package_md: updatedAngle.markdown,
      context_package_updated_at: now,
      updated_at: now,
    })
    .eq('clerk_user_id', userId);
  if (updErr) {
    console.error('career-context augment: persist failed', userId, updErr);
    return NextResponse.json({ error: { code: 'INTERNAL', message: updErr.message } }, { status: 500 });
  }

  revalidatePath('/dashboard/ai');
  revalidatePath('/dashboard/assets');
  return NextResponse.json({ drafts: updatedDrafts });
}
