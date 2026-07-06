import { NextResponse } from 'next/server';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { suggestHeadlines } from '@/lib/ai/suggest-headline';
import { getSourceDocuments } from '@/lib/career-sources/queries';

// Owner-only. Reads the candidate's résumé + career sources + target role and
// asks the model for a few elite headline options. Optional assist; the client
// fills the field and the candidate can edit freely.
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
    .select('id, target_role, summary_bullets')
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const p = profile as { id: string; target_role: string | null; summary_bullets: string[] | null };

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', p.id)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  const sources = await getSourceDocuments(supabase, p.id);

  if ((!resumeMarkdown || !resumeMarkdown.trim()) && sources.length === 0) {
    return NextResponse.json({ headlines: [], needsUploads: true });
  }

  try {
    const headlines = await suggestHeadlines({
      resumeMarkdown,
      sources,
      targetRole: p.target_role,
      summaryBullets: Array.isArray(p.summary_bullets) ? p.summary_bullets : [],
    });
    return NextResponse.json({ headlines });
  } catch (e) {
    console.error('suggest-headline: failed', userId, e);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Could not generate a headline' } }, { status: 500 });
  }
}
