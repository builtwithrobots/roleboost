import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { getAdminClient } from '@/lib/supabase/admin';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import AdminAssetPackageTool, {
  type AdminCandidateOption,
} from '@/components/admin/AdminAssetPackageTool';

export const dynamic = 'force-dynamic';

// Superadmin Asset Package production tool. The founder generates the full
// done-for-you package (both perspectives + NotebookLM prompts, strategized to a
// target role/JD) for a paying candidate, downloads the .md, and delivers it. The
// candidate drops it into their assets area; this page never touches a
// candidate's live brain.
export default async function AdminAssetPackagesPage() {
  let ctx;
  try {
    ctx = await getUserContext();
  } catch (e) {
    if (e instanceof AuthError && e.code === 'UNAUTHENTICATED') redirect('/sign-in');
    throw e;
  }
  if (!ctx.isAdmin) redirect('/');

  // adminClient: cross-user reads for the candidate picker (RLS bypass required;
  // the admin is not the owner of these rows). Guarded by the isAdmin gate above.
  const admin = getAdminClient();

  const { data: profiles } = await (admin.from('candidate_profiles') as any)
    .select('id, slug, full_name, target_role')
    .order('full_name', { ascending: true })
    .limit(500);

  // Which candidates have a résumé on file (a generation input).
  const { data: resumeRows } = await (admin.from('resume_documents') as any)
    .select('candidate_profile_id')
    .not('canonical_markdown', 'is', null);
  const withResume = new Set(
    ((resumeRows ?? []) as { candidate_profile_id: string }[]).map((r) => r.candidate_profile_id),
  );

  // Which already have a saved package. Defensive separate query: the
  // asset_package column may not be migrated yet; degrade to "none saved".
  const withPackage = new Set<string>();
  const { data: pkgRows, error: pkgErr } = await (admin.from('candidate_profiles') as any)
    .select('id')
    .not('asset_package', 'is', null);
  if (!pkgErr) {
    for (const r of (pkgRows ?? []) as { id: string }[]) withPackage.add(r.id);
  }

  const candidates: AdminCandidateOption[] = (
    (profiles ?? []) as { id: string; slug: string; full_name: string; target_role: string | null }[]
  ).map((p) => ({
    id: p.id,
    slug: p.slug,
    fullName: p.full_name,
    targetRole: p.target_role,
    hasResume: withResume.has(p.id),
    hasPackage: withPackage.has(p.id),
  }));

  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Asset Packages"
        description="Produce a done-for-you Asset Package for a candidate: pick them (or paste a résumé for an off-platform order), enter the target role and job description, generate, and deliver the file."
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AdminAssetPackageTool candidates={candidates} />
      </div>
    </DashboardPage>
  );
}
