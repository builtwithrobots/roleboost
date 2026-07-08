import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminContext } from '@/lib/auth/admin-context';
import { AuthError } from '@/lib/auth/user-context';
import { logAdminAction } from '@/lib/auth/audit';
import { generateAssetPackage } from '@/lib/ai/asset-package';
import { getSourceDocuments } from '@/lib/career-sources/queries';
import type { AssetPackage } from '@/lib/types';

// Superadmin-only Asset Package production tool. Runs the full Candidate Asset
// Production Skill (Section 1 + Section 2) strategized toward a target role +
// optional job description, for either a platform candidate (résumé + career
// sources auto-loaded, with an optional pasted-résumé override) or an
// off-platform order (pasted résumé, manual name). For platform candidates the
// result is persisted to candidate_profiles.asset_package as the delivery record;
// persistence is best-effort so an un-migrated DB still returns the package for
// download. The deliverable .md is handed to the candidate, who drops it into
// their assets area; nothing here touches the candidate's live brain.
export const runtime = 'nodejs';
// Staged generation is three Sonnet calls, each producing thousands of tokens;
// 300s is the Pro-plan ceiling (60s hits FUNCTION_INVOCATION_TIMEOUT).
export const maxDuration = 300;

const Body = z
  .object({
    candidate_profile_id: z.string().uuid().optional(),
    full_name: z.string().trim().min(1).max(200).optional(),
    target_role: z.string().trim().min(1).max(200),
    job_description: z.string().max(50000).optional(),
    resume_override: z.string().max(100000).optional(),
  })
  .refine((b) => b.candidate_profile_id || b.full_name, {
    message: 'Provide a candidate or a full name for an off-platform order.',
  });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function guard() {
  try {
    return { ctx: await getAdminContext(), response: null };
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return { ctx: null, response: NextResponse.json({ error: { code: e.code } }, { status }) };
    }
    throw e;
  }
}

// GET ?candidateId=<uuid>: the candidate's saved package (delivery record), if any.
export async function GET(req: NextRequest) {
  const { ctx, response } = await guard();
  if (!ctx) return response!;

  const candidateId = req.nextUrl.searchParams.get('candidateId');
  if (!candidateId || !z.string().uuid().safeParse(candidateId).success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }

  // Defensive: the asset_package column may not be migrated yet; degrade to null.
  const { data, error } = await (ctx.adminClient.from('candidate_profiles') as any)
    .select('asset_package')
    .eq('id', candidateId)
    .maybeSingle();
  const pkg = error ? null : ((data?.asset_package ?? null) as AssetPackage | null);
  return NextResponse.json({ package: pkg });
}

export async function POST(req: NextRequest) {
  const { ctx, response } = await guard();
  if (!ctx) return response!;
  const { actorUserId, adminClient } = ctx;

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', details: e.issues } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Invalid request body' } }, { status: 400 });
  }

  let fullName: string;
  let slug: string;
  let resumeMarkdown: string | null = parsed.resume_override?.trim() || null;
  let sources: Awaited<ReturnType<typeof getSourceDocuments>> = [];
  let targetClerkUserId: string | null = null;

  if (parsed.candidate_profile_id) {
    const { data: profile } = await (adminClient.from('candidate_profiles') as any)
      .select('id, full_name, slug, clerk_user_id')
      .eq('id', parsed.candidate_profile_id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No such candidate' } }, { status: 404 });
    }
    fullName = profile.full_name as string;
    slug = profile.slug as string;
    targetClerkUserId = profile.clerk_user_id as string;

    if (!resumeMarkdown) {
      const { data: resumeDoc } = await (adminClient.from('resume_documents') as any)
        .select('canonical_markdown')
        .eq('candidate_profile_id', profile.id)
        .maybeSingle();
      resumeMarkdown =
        typeof resumeDoc?.canonical_markdown === 'string' && resumeDoc.canonical_markdown.trim()
          ? (resumeDoc.canonical_markdown as string)
          : null;
    }
    sources = await getSourceDocuments(adminClient as any, profile.id as string);
  } else {
    fullName = parsed.full_name!;
    slug = slugify(fullName) || 'candidate';
  }

  if (!resumeMarkdown?.trim() && sources.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'No material to work from. The candidate has no résumé or sources; paste a résumé.',
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
    console.error('admin asset-package generate: failed', actorUserId, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Asset package generation failed' } },
      { status: 500 },
    );
  }

  // Persist the delivery record for platform candidates. Best-effort: if the
  // asset_package column is not migrated yet, still return the package so the
  // admin can download and deliver it.
  let saved = false;
  if (parsed.candidate_profile_id) {
    const { error: updErr } = await (adminClient.from('candidate_profiles') as any)
      .update({ asset_package: pkg })
      .eq('id', parsed.candidate_profile_id);
    saved = !updErr;
    if (updErr) console.error('admin asset-package generate: persist failed', updErr);
  }

  await logAdminAction({
    actorUserId,
    action: 'asset_package.generate',
    targetUserId: targetClerkUserId,
    context: {
      candidate_profile_id: parsed.candidate_profile_id ?? null,
      target_role: parsed.target_role,
      off_platform: !parsed.candidate_profile_id,
      saved,
    },
  });

  return NextResponse.json({ package: pkg, saved });
}
