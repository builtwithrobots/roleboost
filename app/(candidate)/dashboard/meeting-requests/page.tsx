import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { adminClient } from '@/lib/supabase/admin';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import MeetingRequestsList from '@/components/candidate/MeetingRequestsList';
import { CalendarClock } from 'lucide-react';
import type { MeetingRequest } from '@/lib/types';

// Always render fresh so a just-submitted request appears immediately.
export const dynamic = 'force-dynamic';

// Live meeting requests recruiters submit when the Personal Assistant offers to
// schedule. Reads go through the service-role client scoped explicitly to the
// authenticated owner's candidate_profile_id (resolved from their verified
// clerk_user_id), matching the Transcripts page -- the linked chat_messages are
// written by anonymous recruiters and read reliably here without depending on
// Clerk->Supabase JWT forwarding.
export default async function MeetingRequestsPage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }
  const { userId } = ctx;

  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  let requests: MeetingRequest[] = [];
  const transcripts: Record<string, { role: 'user' | 'assistant'; content: string }[]> = {};
  if (profile) {
    const { data } = await (adminClient.from('meeting_requests') as any)
      .select('id, candidate_profile_id, chat_session_id, recruiter_email, recruiter_name, availability, status, created_at')
      .eq('candidate_profile_id', (profile as { id: string }).id)
      .order('created_at', { ascending: false })
      .limit(100);
    requests = (data ?? []) as unknown as MeetingRequest[];

    // Pull the conversation behind each request so the candidate can review the
    // exact exchange before replying. Scoped to this owner's sessions above.
    const sessionIds = Array.from(
      new Set(requests.map((r) => r.chat_session_id).filter((id): id is string => !!id)),
    );
    if (sessionIds.length > 0) {
      const { data: msgs } = await (adminClient.from('chat_messages') as any)
        .select('chat_session_id, role, content, created_at')
        .in('chat_session_id', sessionIds)
        .order('created_at', { ascending: true });
      for (const m of (msgs ?? []) as {
        chat_session_id: string;
        role: 'user' | 'assistant';
        content: string;
      }[]) {
        (transcripts[m.chat_session_id] ??= []).push({ role: m.role, content: m.content });
      }
    }
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
          <MeetingRequestsList requests={requests} transcripts={transcripts} />
        )}
      </div>
    </DashboardPage>
  );
}
