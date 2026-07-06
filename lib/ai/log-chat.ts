import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// Chat logging runs through the service-role client: recruiters are anonymous
// (no Clerk JWT), so RLS-scoped clients cannot write the session/message rows.
// Every helper here is best-effort -- a logging failure must never break the
// chat response the recruiter is waiting on.
//
// Because failures are swallowed, a broken config (e.g. an unset
// SUPABASE_SERVICE_ROLE_KEY) would otherwise produce zero transcripts with no
// signal at all. reportRecordingFailure() makes that loud and greppable: a
// consistent tag on every failure, and a one-time, high-signal warning when the
// root cause is missing admin env. Grep production logs for TRANSCRIPT_RECORDING.

const RECORDING_TAG = 'TRANSCRIPT_RECORDING';
let warnedMissingEnv = false;

function reportRecordingFailure(stage: string, id: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${RECORDING_TAG}] ${stage} failed for ${id}:`, error);
  if (message.includes('admin env vars not set') && !warnedMissingEnv) {
    warnedMissingEnv = true;
    console.error(
      `[${RECORDING_TAG}] CRITICAL: SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is ` +
        'not set. Chats still answer, but NO transcripts are being recorded. Set the env var ' +
        'to restore recording, delivery, and the AI-improvement gap loop.',
    );
  }
}

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
      reportRecordingFailure('ensureChatSession insert', candidateProfileId, error);
      return null;
    }
    return data.id as string;
  } catch (e) {
    reportRecordingFailure('ensureChatSession', candidateProfileId, e);
    return null;
  }
}

/**
 * Logs the user question and the assistant answer for a session. The model and
 * validation tracking (Phase B) is meaningful only on the assistant turn; the
 * user turn carries the same columns at their defaults.
 *
 * Both rows MUST have identical keys. PostgREST derives the column list for a
 * bulk insert from the row shape and rejects the whole batch with a 400 when the
 * objects' keys differ -- so the user row explicitly carries the tracking
 * columns too, rather than omitting them. (This mismatch is what silently
 * dropped every transcript message before.)
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
    const { error } = await (adminClient.from('chat_messages') as any).insert([
      {
        chat_session_id: params.sessionId,
        role: 'user',
        content: params.question,
        model_used: null,
        was_complex: false,
        was_validated: false,
      },
      {
        chat_session_id: params.sessionId,
        role: 'assistant',
        content: params.answer,
        model_used: params.modelUsed ?? null,
        was_complex: params.wasComplex ?? false,
        was_validated: params.wasValidated ?? false,
      },
    ]);
    // supabase-js returns errors as a value (no throw), so an unchecked insert
    // failed silently before. Surface it through the same observability path.
    if (error) reportRecordingFailure('logChatExchange insert', params.sessionId, error);
  } catch (e) {
    reportRecordingFailure('logChatExchange', params.sessionId, e);
  }
}
