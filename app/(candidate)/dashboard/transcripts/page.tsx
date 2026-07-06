import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import TranscriptsList, { type TranscriptItem } from '@/components/candidate/TranscriptsList';
import { MessagesSquare } from 'lucide-react';

// Candidate-facing record of every conversation with their Personal Assistant,
// recruiter chats and their own preview tests (tagged and filterable). Retained
// so the candidate can review, teach a better answer, and carry context into a
// meeting. RLS scopes reads to the owner.
export default async function TranscriptsPage() {
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
    .select('id, full_name')
    .eq('clerk_user_id', userId)
    .single();

  let transcripts: TranscriptItem[] = [];
  if (profile) {
    // Include the candidate's own preview sessions (is_sandbox) so testing your
    // own link never looks like "nothing recorded". They are tagged as tests and
    // filterable, kept distinct from real recruiter conversations.
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id, employer_company_name, viewer_clerk_user_id, is_sandbox, started_at')
      .eq('candidate_profile_id', (profile as { id: string }).id)
      .order('started_at', { ascending: false })
      .limit(100);

    const ids = (sessions ?? []).map((s: { id: string }) => s.id);
    const bySession = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();
    if (ids.length > 0) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('chat_session_id, role, content, created_at')
        .in('chat_session_id', ids)
        .order('created_at', { ascending: true });
      for (const m of (msgs ?? []) as { chat_session_id: string; role: 'user' | 'assistant'; content: string }[]) {
        const arr = bySession.get(m.chat_session_id) ?? [];
        arr.push({ role: m.role, content: m.content });
        bySession.set(m.chat_session_id, arr);
      }
    }

    transcripts = ((sessions ?? []) as {
      id: string;
      employer_company_name: string | null;
      viewer_clerk_user_id: string | null;
      is_sandbox: boolean;
      started_at: string;
    }[])
      .map((s) => ({
        id: s.id,
        kind: s.is_sandbox ? ('test' as const) : ('recruiter' as const),
        label: s.is_sandbox
          ? 'Your test'
          : s.employer_company_name?.trim() || (s.viewer_clerk_user_id ? 'Signed-in recruiter' : 'Recruiter'),
        date: s.started_at,
        messages: bySession.get(s.id) ?? [],
      }))
      .filter((t) => t.messages.length > 0);
  }

  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Transcripts"
        description="Every conversation with your Personal Assistant, kept so you can review it, teach your AI a better answer, and walk into any meeting with the full context. Yours alone."
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        {transcripts.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            description="When a recruiter chats with your Personal Assistant, the transcript lands here and in your inbox. Your own tests show up here too. Share your profile link to get started."
          />
        ) : (
          <TranscriptsList transcripts={transcripts} candidateName={(profile as { full_name: string }).full_name} />
        )}
      </div>
    </DashboardPage>
  );
}
