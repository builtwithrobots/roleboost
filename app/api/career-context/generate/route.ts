import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { assertCandidateAiAccess, EntitlementError } from '@/lib/auth/entitlements';
import { generateCareerContext } from '@/lib/ai/career-context';
import { getSourceDocuments } from '@/lib/career-sources/queries';
import type { CareerContextDrafts } from '@/lib/types';

// Owner-only, entitlement-gated. Generates both narrative angles of the
// candidate's career-context document from their résumé + career sources and
// stages them on the profile. The candidate selects an angle separately
// (selectCareerContextAngle), which promotes it to the active context_package_md.
export const runtime = 'nodejs';
export const maxDuration = 300;

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

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id, full_name')
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const { id: profileId, full_name: fullName } = profile as { id: string; full_name: string };

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', profileId)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  // Career sources enrich the synthesis as additional grounding.
  const sources = await getSourceDocuments(supabase, profileId);

  // Nothing to synthesize from -- ask the candidate to add a résumé or source first.
  if (!resumeMarkdown?.trim() && sources.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'Add a résumé or a career source before generating a context document.',
        },
      },
      { status: 400 },
    );
  }

  let drafts: CareerContextDrafts;
  try {
    drafts = await generateCareerContext(fullName, resumeMarkdown, sources);
  } catch (e) {
    console.error('career-context generate: failed', userId, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Context document generation failed' } },
      { status: 500 },
    );
  }

  const { error: updErr } = await supabase
    .from('candidate_profiles')
    .update({ career_context_drafts: drafts, updated_at: new Date().toISOString() })
    .eq('clerk_user_id', userId);
  if (updErr) {
    console.error('career-context generate: persist failed', userId, updErr);
    return NextResponse.json({ error: { code: 'INTERNAL', message: updErr.message } }, { status: 500 });
  }

  revalidatePath('/dashboard/ai');
  return NextResponse.json({ drafts });
}
