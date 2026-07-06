import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { adminClient } from '@/lib/supabase/admin';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import TranscriptsList, { type TranscriptItem } from '@/components/candidate/TranscriptsList';
import { MessagesSquare } from 'lucide-react';

// Always render fresh: a conversation that just happened must show up on the
// next load, never a cached-empty page.
export const dynamic = 'force-dynamic';

// Candidate-facing record of every conversation with their Personal Assistant,
// recruiter chats and their own preview tests (tagged and filterable). Retained
// so the candidate can review, teach a better answer, and carry context into a
// meeting.
//
// Reads go through the service-role client, scoped explicitly to the
// authenticated owner's own candidate_profile_id (resolved from their verified
// clerk_user_id). Chat rows are written by anonymous recruiters via the
// service-role path, and this owner-scoped read matches the employer transcripts
// page -- it does not depend on Clerk->Supabase JWT forwarding for RLS.
export default async function TranscriptsPage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }
  const { userId } = ctx;

  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('id, full_name')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  let transcripts: TranscriptItem[] = [];
  if (profile) {
    // Include the candidate's own preview sessions (is_sandbox) so testing your
    // own link never looks like "nothing recorded". They are tagged as tests and
    // filterable, kept distinct from real recruiter conversations.
    const { data: sessions } = await (adminClient.from('chat_sessions') as any)
      .select('id, employer_company_name, recruiter_name, recruiter_email, viewer_clerk_user_id, is_sandbox, started_at')
      .eq('candidate_profile_id', (profile as { id: string }).id)
      .order('started_at', { ascending: false })
      .limit(100);

    const ids = (sessions ?? []).map((s: { id: string }) => s.id);
    const bySession = new Map<string, { role: 'user' | 'assistant'; content: string }[]>();
    if (ids.length > 0) {
      const { data: msgs } = await (adminClient.from('chat_messages') as any)
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
      recruiter_name: string | null;
      recruiter_email: string | null;
      viewer_clerk_user_id: string | null;
      is_sandbox: boolean;
      started_at: string;
    }[])
      .map((s) => {
        const name = s.recruiter_name?.trim();
        const company = s.employer_company_name?.trim();
        const label = s.is_sandbox
          ? 'Your test'
          : name
            ? company
              ? `${name} · ${company}`
              : name
            : company || (s.viewer_clerk_user_id ? 'Signed-in recruiter' : 'Recruiter');
        return {
          id: s.id,
          kind: s.is_sandbox ? ('test' as const) : ('recruiter' as const),
          label,
          contactEmail: s.is_sandbox ? null : s.recruiter_email?.trim() || null,
          date: s.started_at,
          messages: bySession.get(s.id) ?? [],
        };
      })
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
