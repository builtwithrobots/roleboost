import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deliverTranscript } from '@/lib/transcripts/deliver';
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit';

// Public endpoint -- triggered by the chat surface on close/background
// (sendBeacon + pagehide/visibilitychange), so the recruiter is usually
// anonymous. Idempotent via chat_sessions.transcript_sent; the shared
// deliverTranscript() pipeline claims delivery atomically and emails once.
export const runtime = 'nodejs';
export const maxDuration = 30;

const Input = z.object({ sessionId: z.string().uuid() });

export async function POST(req: NextRequest) {
  // Cheap IP guard: a session can only be delivered once anyway (idempotent),
  // but this caps how hard an anonymous caller can hammer the endpoint.
  const withinLimit = await checkRateLimit(`deliver:${clientIp(req)}`, 60, 60);
  if (!withinLimit) {
    return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 });
  }

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

  await deliverTranscript(parsed.data.sessionId);
  // Always 200: the recruiter's browser is firing this on unload and cannot act
  // on the result. Delivery is idempotent and best-effort.
  return NextResponse.json({ ok: true });
}
