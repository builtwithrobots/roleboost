import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import MeetingRequestsList from '@/components/candidate/MeetingRequestsList';
import { CalendarClock } from 'lucide-react';
import type { MeetingRequest } from '@/lib/types';

// Live meeting requests recruiters submit when the Personal Assistant offers to
// schedule. RLS scopes reads to the owner (meeting_requests_owner).
export default async function MeetingRequestsPage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }
  const { supabase, userId } = ctx;

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();

  let requests: MeetingRequest[] = [];
  if (profile) {
    const { data } = await supabase
      .from('meeting_requests')
      .select('id, candidate_profile_id, chat_session_id, recruiter_email, recruiter_name, availability, status, created_at')
      .eq('candidate_profile_id', (profile as { id: string }).id)
      .order('created_at', { ascending: false })
      .limit(100);
    requests = (data ?? []) as unknown as MeetingRequest[];
  }

  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Meeting requests"
        description="Recruiters who asked to meet through your Personal Assistant. Reach out to lock in a time."
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        {requests.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No meeting requests yet"
            description="When your Personal Assistant cannot answer a recruiter's question, it offers to set up a live conversation. Those requests show up here."
          />
        ) : (
          <MeetingRequestsList requests={requests} />
        )}
      </div>
    </DashboardPage>
  );
}
