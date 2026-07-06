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

  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60_000).toISOString();
  const { data: sessions, error } = await (adminClient.from('chat_sessions') as any)
    .select('id')
    .eq('transcript_sent', false)
    .eq('is_sandbox', false)
    .lt('started_at', cutoff)
    .order('started_at', { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error('cron/deliver-transcripts: query failed', error);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  let delivered = 0;
  for (const s of (sessions ?? []) as { id: string }[]) {
    const result = await deliverTranscript(s.id);
    if (result.ok && result.delivered) delivered += 1;
  }

  return NextResponse.json({ ok: true, scanned: (sessions ?? []).length, delivered });
}
