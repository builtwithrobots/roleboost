import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/admin';
import { isEmailConfigured } from '@/lib/email/client';
import { sendTranscriptEmails } from '@/lib/email/transcript';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { analyzeTranscriptGaps } from '@/lib/ai/analyze-transcript';
import type { ChatTurn } from '@/lib/types';

// Public endpoint -- triggered by the chat surface on close (sendBeacon), so the
// recruiter is usually anonymous. Idempotent via chat_sessions.transcript_sent.
// Reads everything through the service-role client; only ever emails the
// legitimate candidate/employer addresses on the session.
export const runtime = 'nodejs';
export const maxDuration = 30;

const Input = z.object({ sessionId: z.string().uuid() });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }
  const { sessionId } = parsed.data;

  const { data: session } = await (adminClient.from('chat_sessions') as any)
    .select('id, candidate_profile_id, viewer_clerk_user_id, employer_company_name, transcript_sent, is_sandbox')
    .eq('id', sessionId)
    .maybeSingle();

  // Nothing to do: unknown session, already delivered, or an owner sandbox test.
  if (!session) return NextResponse.json({ ok: true });
  if (session.transcript_sent || session.is_sandbox) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: msgs } = await (adminClient.from('chat_messages') as any)
    .select('role, content, created_at')
    .eq('chat_session_id', sessionId)
    .order('created_at', { ascending: true });
  const messages: ChatTurn[] = (msgs ?? []).map((m: { role: ChatTurn['role']; content: string }) => ({
    role: m.role,
    content: m.content,
  }));
  if (messages.length === 0) return NextResponse.json({ ok: true, skipped: true });

  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('full_name, slug, clerk_user_id')
    .eq('id', session.candidate_profile_id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ ok: true });

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

  // Mark delivered up front so duplicate beacons don't double-send.
  await (adminClient.from('chat_sessions') as any)
    .update({ transcript_sent: true, ended_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (isEmailConfigured()) {
    try {
      await sendTranscriptEmails({
        candidateName: profile.full_name,
        candidateSlug: profile.slug,
        candidateEmail,
        employerEmail,
        employerCompany: session.employer_company_name ?? null,
        messages,
      });
    } catch (e) {
      console.error('transcript deliver: send failed', sessionId, e);
    }
  } else {
    console.warn('transcript deliver: RESEND_API_KEY not set; skipping send', sessionId);
  }

  // Post-session: analyze the transcript against the brain and store gaps for the
  // prompt bot. Best-effort -- never fail delivery over this.
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
    console.error('transcript deliver: gap analysis failed', sessionId, e);
  }

  return NextResponse.json({ ok: true });
}
