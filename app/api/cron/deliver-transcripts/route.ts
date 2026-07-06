import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { deliverTranscript } from '@/lib/transcripts/deliver';

// Safety-net sweep for the transcript pipeline. The browser beacon
// (pagehide/visibilitychange) delivers most conversations, but tab kills and
// mobile backgrounding can drop it. This fulfills the "deliver after 30 min of
// inactivity" guarantee: any un-delivered, non-sandbox session older than the
// idle window gets its transcript emailed + gap-analyzed here.
//
// Secured by CRON_SECRET (Vercel Cron sends it as a Bearer token). Until the
// secret is provisioned the route simply 401s -- the beacon path keeps working,
// so this is safe to ship ahead of the env var (graceful degradation).
export const runtime = 'nodejs';
export const maxDuration = 60;

const IDLE_MINUTES = 30;
const BATCH = 100;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('cron/deliver-transcripts: CRON_SECRET not set; skipping');
    return NextResponse.json({ ok: true, skipped: 'no_secret' });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  }

  const cutoff = Date.now() - IDLE_MINUTES * 60_000;

  // Candidate sessions still awaiting delivery. Ordered oldest-first so a backlog
  // drains steadily across runs.
  const { data: sessions, error } = await (adminClient.from('chat_sessions') as any)
    .select('id')
    .eq('transcript_sent', false)
    .eq('is_sandbox', false)
    .order('started_at', { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error('cron/deliver-transcripts: query failed', error);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  const ids = (sessions ?? []).map((s: { id: string }) => s.id);
  if (ids.length === 0) return NextResponse.json({ ok: true, scanned: 0, delivered: 0 });

  // Idle is measured from the LAST message, not session start, so an active
  // conversation is never delivered mid-stream. Fetch the latest message time
  // per candidate session (bounded by BATCH) and deliver only the truly idle.
  const { data: msgs } = await (adminClient.from('chat_messages') as any)
    .select('chat_session_id, created_at')
    .in('chat_session_id', ids)
    .order('created_at', { ascending: false });

  const lastMessageAt = new Map<string, number>();
  for (const m of (msgs ?? []) as { chat_session_id: string; created_at: string }[]) {
    // Rows are newest-first, so the first time seen per session is its latest.
    if (!lastMessageAt.has(m.chat_session_id)) {
      lastMessageAt.set(m.chat_session_id, new Date(m.created_at).getTime());
    }
  }

  let delivered = 0;
  let scanned = 0;
  for (const id of ids as string[]) {
    const last = lastMessageAt.get(id);
    if (last === undefined || last >= cutoff) continue; // no messages, or still active
    scanned += 1;
    const result = await deliverTranscript(id);
    if (result.ok && result.delivered) delivered += 1;
  }

  return NextResponse.json({ ok: true, scanned, delivered });
}
