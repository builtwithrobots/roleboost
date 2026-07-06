import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import { isEmailConfigured } from '@/lib/email/client';
import { sendTranscriptEmails } from '@/lib/email/transcript';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { analyzeTranscriptGaps } from '@/lib/ai/analyze-transcript';
import { checkRateLimit } from '@/lib/security/rate-limit';
import type { ChatTurn } from '@/lib/types';

// Shared transcript-delivery pipeline. Called from two places:
//   1. /api/transcripts/deliver -- the sendBeacon fired when the recruiter's
//      chat surface closes/backgrounds.
//   2. /api/cron/deliver-transcripts -- the safety-net sweep that catches
//      sessions the browser beacon never reached (tab closed, mobile killed).
// Recording (chat_sessions/chat_messages) already happened inside /api/chat;
// this step only emails the transcript and feeds the AI-improvement gap loop.
// Everything runs through the service-role client: recruiters are anonymous.

// Per-candidate cap so a flood of sessions cannot email-bomb a candidate.
const MAX_TRANSCRIPT_EMAILS_PER_HOUR = 12;

export type DeliverResult =
  | { ok: true; delivered: true }
  | { ok: true; delivered: false; reason: string };

/**
 * Delivers the transcript for a single chat session: marks it sent (winning any
 * race against a duplicate beacon), emails both sides, and runs gap analysis.
 * Idempotent -- a second call for the same session is a no-op. Never throws;
 * best-effort delivery must not break the caller.
 */
export async function deliverTranscript(sessionId: string): Promise<DeliverResult> {
  const { data: session } = await (adminClient.from('chat_sessions') as any)
    .select(
      'id, candidate_profile_id, viewer_clerk_user_id, employer_company_name, transcript_sent, is_sandbox',
    )
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return { ok: true, delivered: false, reason: 'unknown_session' };
  if (session.transcript_sent) return { ok: true, delivered: false, reason: 'already_sent' };
  if (session.is_sandbox) return { ok: true, delivered: false, reason: 'sandbox' };

  const { data: msgs } = await (adminClient.from('chat_messages') as any)
    .select('role, content, created_at')
    .eq('chat_session_id', sessionId)
    .order('created_at', { ascending: true });
  const messages: ChatTurn[] = (msgs ?? []).map((m: { role: ChatTurn['role']; content: string }) => ({
    role: m.role,
    content: m.content,
  }));
  if (messages.length === 0) return { ok: true, delivered: false, reason: 'empty' };

  // Claim delivery atomically: only the writer that flips transcript_sent from
  // false wins and proceeds. Concurrent beacons/cron passes get zero rows back
  // and bail, so the emails send exactly once.
  const { data: claimed } = await (adminClient.from('chat_sessions') as any)
    .update({ transcript_sent: true, ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('transcript_sent', false)
    .select('id');
  if (!claimed || claimed.length === 0) {
    return { ok: true, delivered: false, reason: 'already_sent' };
  }

  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('full_name, slug, clerk_user_id')
    .eq('id', session.candidate_profile_id)
    .maybeSingle();
  if (!profile) return { ok: true, delivered: false, reason: 'no_profile' };

  const { data: candUser } = await (adminClient.from('users') as any)
    .select('email')
    .eq('clerk_user_id', profile.clerk_user_id)
    .maybeSingle();
  const candidateEmail: string | null = candUser?.email ?? null;

  let employerEmail: string | null = null;
  if (session.viewer_clerk_user_id && session.viewer_clerk_user_id !== profile.clerk_user_id) {
    const { data: viewer } = await (adminClient.from('users') as any)
      .select('email')
      .eq('clerk_user_id', session.viewer_clerk_user_id)
      .maybeSingle();
    employerEmail = viewer?.email ?? null;
  }

  if (isEmailConfigured()) {
    // Throttle candidate-bound transcript emails so session-flooding cannot
    // bury a candidate's inbox. The recruiter copy is unaffected.
    const withinCap = await checkRateLimit(
      `transcript-email:${session.candidate_profile_id}`,
      MAX_TRANSCRIPT_EMAILS_PER_HOUR,
      3600,
    );
    try {
      await sendTranscriptEmails({
        candidateName: profile.full_name,
        candidateSlug: profile.slug,
        candidateEmail: withinCap ? candidateEmail : null,
        employerEmail,
        employerCompany: session.employer_company_name ?? null,
        messages,
      });
    } catch (e) {
      console.error('deliverTranscript: send failed', sessionId, e);
    }
  } else {
    console.warn('deliverTranscript: RESEND_API_KEY not set; skipping send', sessionId);
  }

  // Post-session: analyze the transcript against the brain and store gaps for the
  // prompt bot. This is the transcript -> AI-improvement loop; best-effort.
  try {
    const brain = await getCandidateBrainBySlug(profile.slug);
    if (brain) {
      const gaps = await analyzeTranscriptGaps({
        candidate: brain.candidate,
        resumeMarkdown: brain.resumeMarkdown,
        messages,
      });
      for (const g of gaps) {
        const { count } = await (adminClient.from('transcript_gaps') as any)
          .select('id', { count: 'exact', head: true })
          .eq('candidate_profile_id', session.candidate_profile_id)
          .eq('category', g.category);
        const patternCount = (count ?? 0) + 1;
        await (adminClient.from('transcript_gaps') as any).insert({
          candidate_profile_id: session.candidate_profile_id,
          chat_session_id: sessionId,
          question_asked: g.questionAsked,
          chatbot_answer: g.chatbotAnswer,
          gap_type: g.gapType,
          suggested_prompt: g.suggestedPrompt,
          category: g.category,
          priority: patternCount >= 3 ? 'high' : g.priority,
          pattern_count: patternCount,
        });
      }
    }
  } catch (e) {
    console.error('deliverTranscript: gap analysis failed', sessionId, e);
  }

  return { ok: true, delivered: true };
}
