import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { guardCron } from '@/lib/cron/guard';

// Hygiene sweep for the fixed-window rate-limit counters (see 20260709 migration).
//
// check_rate_limit() upserts one row per opaque bucket string (ip:route,
// session:id, transcript-email:profile, and the idempotency keys the other crons
// use). Rows are never deleted inline, so without this sweep the table grows
// unbounded, one row for every IP/session/key ever seen. Anything whose window
// started longer ago than RETENTION is dead: its window has long since reset, so
// deleting it only reclaims space and can never let an in-flight limit slip.
//
// Kept deliberately conservative. Live abuse windows are seconds to an hour; the
// longest-lived buckets are the weekly-digest / meeting-reminder idempotency keys
// (<= 30 days). RETENTION sits past all of them so a prune never clears a marker
// that still matters.
//
// Secured by CRON_SECRET via guardCron (no secret -> harmless no-op).
export const runtime = 'nodejs';
export const maxDuration = 60;

const RETENTION_DAYS = 30;

export async function GET(req: NextRequest) {
  const guard = guardCron(req);
  if (!guard.ok) return guard.response;

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await (adminClient.from('rate_limits') as any)
    .delete()
    .lt('window_start', cutoff)
    .select('bucket_key');

  if (error) {
    console.error('cron/prune-rate-limits: delete failed', error);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  const pruned = (data ?? []).length;
  return NextResponse.json({ ok: true, pruned });
}
