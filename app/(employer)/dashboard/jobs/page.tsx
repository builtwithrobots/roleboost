import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/supabase/admin';
import JobsTable from '@/components/employer/JobsTable';
import DashboardPage from '@/components/layout/DashboardPage';

export default async function EmployerJobsPage() {
  let ctx;
  try {
    ctx = await getUserContext('employer');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { userId } = ctx;

  const { data: membership } = await (adminClient.from('employer_members') as any)
    .select('employer_account_id')
    .eq('clerk_user_id', userId)
    .single();

  if (!membership?.employer_account_id) redirect('/dashboard/candidates');

  const { data: jobs } = await (adminClient.from('job_postings') as any)
    .select('id, title, department, location, is_active, created_at, updated_at')
    .eq('employer_account_id', membership.employer_account_id)
    .order('created_at', { ascending: false });

  // Count candidates per job
  const { data: counts } = await (adminClient.from('saved_candidates') as any)
    .select('job_posting_id')
    .eq('employer_account_id', membership.employer_account_id)
    .not('job_posting_id', 'is', null);

  const candidateCountByJob: Record<string, number> = {};
  for (const row of (counts ?? [])) {
    if (row.job_posting_id) {
      candidateCountByJob[row.job_posting_id] = (candidateCountByJob[row.job_posting_id] ?? 0) + 1;
    }
  }

  const jobsList = (jobs ?? []).map((j: any) => ({
    id: j.id,
    title: j.title,
    department: j.department,
    location: j.location,
    isActive: j.is_active,
    createdAt: j.created_at,
    candidateCount: candidateCountByJob[j.id] ?? 0,
  }));

  return (
    <DashboardPage>
      <JobsTable jobs={jobsList} />
    </DashboardPage>
  );
}
