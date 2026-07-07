import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/supabase/admin';
import CandidateGrid from '@/components/employer/CandidateGrid';
import DashboardPage from '@/components/layout/DashboardPage';

async function ensureEmployerAccount(
  userId: string,
  create: boolean,
): Promise<string | null> {
  // Check for existing membership
  const { data: existing } = await (adminClient.from('employer_members') as any)
    .select('employer_account_id')
    .eq('clerk_user_id', userId)
    .single();

  if (existing?.employer_account_id) return existing.employer_account_id;

  // During read-only impersonation we never bootstrap a row, return null and let
  // the page render an empty state for this employer instead.
  if (!create) return null;

  // Auto-create employer account for first-time employers
  // adminClient: bootstrapping employer account before RLS row exists
  const { data: account, error: accountError } = await (adminClient.from('employer_accounts') as any)
    .insert({ company_name: 'My Company', created_by: userId })
    .select('id')
    .single();

  if (accountError || !account) {
    console.error('ensureEmployerAccount: failed to create account', userId, accountError);
    throw new Error('Failed to create employer account');
  }

  await (adminClient.from('employer_members') as any).insert({
    employer_account_id: account.id,
    clerk_user_id: userId,
    role: 'owner',
  });

  return account.id;
}

export default async function EmployerCandidatesPage() {
  let ctx;
  try {
    ctx = await getUserContext('employer');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { userId } = ctx;
  const employerAccountId = await ensureEmployerAccount(userId, !ctx.impersonating);

  if (!employerAccountId) {
    return (
      <DashboardPage>
        <p className="p-8 text-sm text-[var(--rb-text-secondary)]">
          This employer has not set up their workspace yet.
        </p>
      </DashboardPage>
    );
  }

  // Fetch saved candidates with profile data and asset type indicators
  const { data: savedCandidates } = await (adminClient.from('saved_candidates') as any)
    .select(`
      id,
      stage,
      created_at,
      job_posting_id,
      candidate_profiles (
        id,
        slug,
        full_name,
        headline,
        target_role,
        location,
        is_published
      )
    `)
    .eq('employer_account_id', employerAccountId)
    .order('created_at', { ascending: false });

  // Fetch asset type indicators for each candidate profile
  const profileIds = (savedCandidates ?? [])
    .map((sc: any) => sc.candidate_profiles?.id)
    .filter(Boolean);

  const { data: assets } = profileIds.length
    ? await (adminClient.from('candidate_assets') as any)
        .select('candidate_profile_id, asset_type')
        .in('candidate_profile_id', profileIds)
        .eq('is_active', true)
    : { data: [] };

  const assetsByProfile: Record<string, string[]> = {};
  for (const asset of (assets ?? [])) {
    if (!assetsByProfile[asset.candidate_profile_id]) {
      assetsByProfile[asset.candidate_profile_id] = [];
    }
    assetsByProfile[asset.candidate_profile_id].push(asset.asset_type);
  }

  const candidates = (savedCandidates ?? []).map((sc: any) => ({
    savedId: sc.id,
    stage: sc.stage as string,
    savedAt: sc.created_at as string,
    profile: sc.candidate_profiles
      ? {
          id: sc.candidate_profiles.id,
          slug: sc.candidate_profiles.slug,
          fullName: sc.candidate_profiles.full_name,
          headline: sc.candidate_profiles.headline,
          targetRole: sc.candidate_profiles.target_role,
          location: sc.candidate_profiles.location,
        }
      : null,
    assetTypes: assetsByProfile[sc.candidate_profiles?.id] ?? [],
  }));

  return (
    <DashboardPage>
      <CandidateGrid candidates={candidates} />
    </DashboardPage>
  );
}
