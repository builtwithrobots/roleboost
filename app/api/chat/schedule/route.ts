import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/admin';
import { isEmailConfigured } from '@/lib/email/client';
import { sendMeetingRequestEmail } from '@/lib/email/meeting';
import { checkRateLimit } from '@vercel/firewall';
import { checkBotId } from 'botid/server';
import type { ChatTurn } from '@/lib/types';

// Public endpoint. A recruiter (usually anonymous) submits availability + email
// from the chat when the Personal Assistant offered to schedule. Stores the
// request for the candidate and emails them. Service-role: the recruiter has no
// Clerk session, and the candidate row is resolved by public slug.
export const runtime = 'nodejs';
export const maxDuration = 15;

const Input = z.object({
  candidateSlug: z.string().min(1).max(200),
  email: z.string().email().max(200),
  availability: z.string().min(1).max(2000),
  name: z.string().max(200).optional(),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  // Meeting requests email the candidate, so gate this endpoint hardest: a bot
  // check plus an edge rate limit. Both degrade gracefully (BotID reports
  // not-a-bot off Vercel; the WAF rule no-ops until published).
  // Recommended rule: 5 requests / 300s per IP (Vercel Fixed Window caps at
  // 300s; see docs/architecture/11-anti-spam.md).
  try {
    const { rateLimited } = await checkRateLimit('schedule', { request: req });
    if (rateLimited) {
      return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 });
    }
  } catch (e) {
    console.error('schedule: rate limit check failed', e);
  }
  try {
    const { isBot } = await checkBotId();
    if (isBot) {
      return NextResponse.json({ error: { code: 'BOT_CHECK_FAILED' } }, { status: 403 });
    }
  } catch (e) {
    console.error('schedule: botid check failed', e);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', details: parsed.error.issues } }, { status: 400 });
  }
  const { candidateSlug, email, availability, name, sessionId } = parsed.data;

  // Resolve the published candidate by slug (service-role read).
  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('id, full_name, clerk_user_id, is_published')
    .eq('slug', candidateSlug)
    .maybeSingle();
  if (!profile || !profile.is_published) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  const { error: insErr } = await (adminClient.from('meeting_requests') as any).insert({
    candidate_profile_id: profile.id,
    chat_session_id: sessionId ?? null,
    recruiter_email: email,
    recruiter_name: name?.trim() || null,
    availability: availability.trim(),
  });
  if (insErr) {
    console.error('schedule: insert failed', candidateSlug, insErr);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  // Email the candidate (best-effort; never fail the request over delivery).
  if (isEmailConfigured()) {
    try {
      const { data: candUser } = await (adminClient.from('users') as any)
        .select('email')
        .eq('clerk_user_id', profile.clerk_user_id)
        .maybeSingle();

      // Attach the conversation that led to the request so the candidate walks
      // into the meeting with full context. Confirm the session belongs to this
      // candidate before reading its messages (the sessionId is client-supplied).
      let messages: ChatTurn[] | undefined;
      if (sessionId) {
        const { data: sess } = await (adminClient.from('chat_sessions') as any)
          .select('id')
          .eq('id', sessionId)
          .eq('candidate_profile_id', profile.id)
          .maybeSingle();
        if (sess) {
          const { data: msgs } = await (adminClient.from('chat_messages') as any)
            .select('role, content, created_at')
            .eq('chat_session_id', sessionId)
            .order('created_at', { ascending: true });
          if (msgs && msgs.length > 0) {
            messages = (msgs as { role: ChatTurn['role']; content: string }[]).map((m) => ({
              role: m.role,
              content: m.content,
            }));
          }
        }
      }

      await sendMeetingRequestEmail({
        candidateName: profile.full_name,
        candidateEmail: candUser?.email ?? null,
        recruiterEmail: email,
        recruiterName: name,
        availability,
        messages,
      });
    } catch (e) {
      console.error('schedule: email failed', candidateSlug, e);
    }
  }

  return NextResponse.json({ ok: true });
}
