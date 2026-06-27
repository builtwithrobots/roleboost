import { NextResponse } from 'next/server';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { recommendRoles } from '@/lib/ai/recommend-roles';
import { getSourceDocuments } from '@/lib/career-sources/queries';

// Owner-only. Reads the candidate's résumé + saved career sources server-side and
// asks the model which roles they're best positioned for.
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST() {
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

  const sources = await getSourceDocuments(supabase, profileId);

  // Nothing to reason from yet -- tell the client so it can prompt for uploads.
  if ((!resumeMarkdown || !resumeMarkdown.trim()) && sources.length === 0) {
    return NextResponse.json({ roles: [], needsUploads: true });
  }

  try {
    const roles = await recommendRoles(resumeMarkdown, sources);
    return NextResponse.json({ roles });
  } catch (e) {
    console.error('recommend-roles: failed', userId, e);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Could not generate suggestions' } }, { status: 500 });
  }
}
