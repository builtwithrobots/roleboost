import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { assertCandidateAiAccess, EntitlementError } from '@/lib/auth/entitlements';
import { generateAssetPackage } from '@/lib/ai/asset-package';
import { getSourceDocuments } from '@/lib/career-sources/queries';
import type { AssetPackage } from '@/lib/types';

// Owner-only, entitlement-gated. Runs the full RoleBoost Candidate Asset Production
// Skill (Section 1 + Section 2) from the candidate's résumé + career sources,
// strategized toward a target role + optional job description, and stages the
// result on candidate_profiles.asset_package. `chosen` is null: choosing a
// perspective (chooseAssetPackagePerspective) is what promotes its Section 1 to
// context_package_md and re-gears the brain. A fresh generation never touches the
// live brain.
export const runtime = 'nodejs';
// Staged generation is three Sonnet calls (strategy, then two prompt sets in
// parallel), each producing thousands of tokens; 60s hits Vercel's
// FUNCTION_INVOCATION_TIMEOUT in production. 300s is the Pro-plan ceiling.
export const maxDuration = 300;

const Body = z.object({
  target_role: z.string().trim().min(1).max(200),
  job_description: z.string().max(50000).optional(),
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

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', details: e.issues } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Invalid request body' } }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id, full_name, slug')
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const { id: profileId, full_name: fullName, slug } = profile as {
    id: string;
    full_name: string;
    slug: string;
  };

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', profileId)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  const sources = await getSourceDocuments(supabase, profileId);

  // Need something to strategize from.
  if (!resumeMarkdown?.trim() && sources.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'Add a résumé or a career source before generating an asset package.',
        },
      },
      { status: 400 },
    );
  }

  let pkg: AssetPackage;
  try {
    pkg = await generateAssetPackage({
      fullName,
      slug,
      resumeMarkdown,
      sources,
      targetRole: parsed.target_role,
      jobDescription: parsed.job_description?.trim() ? parsed.job_description.trim() : null,
    });
  } catch (e) {
    console.error('asset-package generate: failed', userId, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Asset package generation failed' } },
      { status: 500 },
    );
  }

  const { error: updErr } = await supabase
    .from('candidate_profiles')
    .update({ asset_package: pkg, updated_at: new Date().toISOString() })
    .eq('clerk_user_id', userId);
  if (updErr) {
    console.error('asset-package generate: persist failed', userId, updErr);
    return NextResponse.json({ error: { code: 'INTERNAL', message: updErr.message } }, { status: 500 });
  }

  revalidatePath('/dashboard/ai');
  return NextResponse.json({ package: pkg });
}
