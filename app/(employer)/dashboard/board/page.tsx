import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/supabase/admin';
import CandidateBoard from '@/components/employer/CandidateBoard';

async function getEmployerAccountId(userId: string): Promise<string | null> {
  const { data } = await (adminClient.from('employer_members') as any)
    .select('employer_account_id')
    .eq('clerk_user_id', userId)
    .single();
  return data?.employer_account_id ?? null;
}

export default async function EmployerBoardPage() {
  let ctx;
  try {
    ctx = await getUserContext('employer');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { userId } = ctx;
  const employerAccountId = await getEmployerAccountId(userId);

  if (!employerAccountId) redirect('/dashboard/candidates');

  const { data: saved } = await (adminClient.from('saved_candidates') as any)
    .select(`
      id,
      stage,
      notes,
      created_at,
      candidate_profiles (
        id,
        slug,
        full_name,
        target_role,
        headline
      )
    `)
    .eq('employer_account_id', employerAccountId)
    .order('created_at', { ascending: true });

  const candidates = (saved ?? []).map((sc: any) => ({
    savedId: sc.id,
    stage: sc.stage as string,
    notes: sc.notes as string | null,
    savedAt: sc.created_at as string,
    profile: sc.candidate_profiles
      ? {
          id: sc.candidate_profiles.id,
          slug: sc.candidate_profiles.slug,
          fullName: sc.candidate_profiles.full_name,
          targetRole: sc.candidate_profiles.target_role,
          headline: sc.candidate_profiles.headline,
        }
      : null,
  }));

  return <CandidateBoard candidates={candidates} />;
}
