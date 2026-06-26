import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// Chat logging runs through the service-role client: recruiters are anonymous
// (no Clerk JWT), so RLS-scoped clients cannot write the session/message rows.
// Every helper here is best-effort -- a logging failure must never break the
// chat response the recruiter is waiting on.

interface SessionViewer {
  viewerClerkUserId?: string | null;
  employerAccountId?: string | null;
  employerCompanyName?: string | null;
  isSandbox?: boolean;
}

/**
 * Returns the existing sessionId, or creates a new chat_sessions row on the
 * first message of a conversation. Returns null if creation fails (the caller
 * then skips message logging but still returns the answer).
 */
export async function ensureChatSession(
  candidateProfileId: string,
  sessionId: string | undefined,
  viewer: SessionViewer = {},
): Promise<string | null> {
  if (sessionId) return sessionId;

  try {
    const { data, error } = await (adminClient.from('chat_sessions') as any)
      .insert({
        candidate_profile_id: candidateProfileId,
        viewer_clerk_user_id: viewer.viewerClerkUserId ?? null,
        employer_account_id: viewer.employerAccountId ?? null,
        employer_company_name: viewer.employerCompanyName ?? null,
        is_sandbox: viewer.isSandbox ?? false,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('ensureChatSession: insert failed', candidateProfileId, error);
      return null;
    }
    return data.id as string;
  } catch (e) {
    console.error('ensureChatSession: threw', candidateProfileId, e);
    return null;
  }
}

/**
 * Logs the user question and the assistant answer for a session. The model and
 * validation tracking (Phase B) lives on the assistant turn; the user turn keeps
 * the column defaults.
 */
export async function logChatExchange(params: {
  sessionId: string;
  question: string;
  answer: string;
  modelUsed?: string;
  wasComplex?: boolean;
  wasValidated?: boolean;
}): Promise<void> {
  try {
    await (adminClient.from('chat_messages') as any).insert([
      { chat_session_id: params.sessionId, role: 'user', content: params.question },
      {
        chat_session_id: params.sessionId,
        role: 'assistant',
        content: params.answer,
        model_used: params.modelUsed ?? null,
        was_complex: params.wasComplex ?? false,
        was_validated: params.wasValidated ?? false,
      },
    ]);
  } catch (e) {
    console.error('logChatExchange: failed', params.sessionId, e);
  }
}
