import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/supabase/admin';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import EmployerTranscriptsList, {
  type EmployerTranscriptItem,
} from '@/components/employer/EmployerTranscriptsList';
import { MessagesSquare } from 'lucide-react';

// Employer-facing record of conversations your team had with candidates' AIs.
// Scoped to the employer account via employer_account_id (populated by /api/chat
// when a signed-in team member chats). adminClient with an explicit account
// filter mirrors the other employer pages.
async function getEmployerAccountId(userId: string): Promise<string | null> {
  const { data } = await (adminClient.from('employer_members') as any)
    .select('employer_account_id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  return data?.employer_account_id ?? null;
}

export default async function EmployerTranscriptsPage() {
  let ctx;
  try {
    ctx = await getUserContext('employer');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const employerAccountId = await getEmployerAccountId(ctx.userId);
  if (!employerAccountId) redirect('/dashboard/candidates');

  let transcripts: EmployerTranscriptItem[] = [];

  const { data: sessions } = await (adminClient.from('chat_sessions') as any)
    .select('id, viewer_clerk_user_id, started_at, candidate_profiles ( full_name, slug )')
    .eq('employer_account_id', employerAccountId)
    .eq('is_sandbox', false)
    .order('started_at', { ascending: false })
    .limit(100);

  const ids = (sessions ?? []).map((s: { id: string }) => s.id);
  const bySession = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();
  if (ids.length > 0) {
    const { data: msgs } = await (adminClient.from('chat_messages') as any)
      .select('chat_session_id, role, content, created_at')
      .in('chat_session_id', ids)
      .order('created_at', { ascending: true });
    for (const m of (msgs ?? []) as {
      chat_session_id: string;
      role: 'user' | 'assistant';
      content: string;
    }[]) {
      const arr = bySession.get(m.chat_session_id) ?? [];
      arr.push({ role: m.role, content: m.content });
      bySession.set(m.chat_session_id, arr);
    }
  }

  transcripts = ((sessions ?? []) as {
    id: string;
    started_at: string;
    candidate_profiles: { full_name: string; slug: string } | null;
  }[])
    .map((s) => ({
      id: s.id,
      candidateName: s.candidate_profiles?.full_name ?? 'Candidate',
      candidateSlug: s.candidate_profiles?.slug ?? null,
      date: s.started_at,
      messages: bySession.get(s.id) ?? [],
    }))
    .filter((t) => t.messages.length > 0);

  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Transcripts"
        description="Every conversation your team has had with a candidate's Personal Assistant, kept for your reference and to prep for the live meeting."
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        {transcripts.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            description="When you or a teammate chats with a candidate's Personal Assistant while signed in, the transcript lands here and in your inbox."
          />
        ) : (
          <EmployerTranscriptsList transcripts={transcripts} />
        )}
      </div>
    </DashboardPage>
  );
}
