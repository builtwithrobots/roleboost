import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { guardCron } from '@/lib/cron/guard';
import { processAudioAsset } from '@/lib/assets/process-audio';

// Safety-net sweep for audio conversion. The upload route transcodes with
// after(), but a frozen/timed-out function or a deploy mid-conversion can leave
// an asset stuck in 'processing'. This re-runs any that have been processing
// longer than the stale window.
//
// Secured by CRON_SECRET (see guardCron). Graceful when the migration has not
// landed yet: the status query errors on the missing column and the route
// no-ops instead of failing.
export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 10;
const STALE_MINUTES = 2;

export async function GET(req: NextRequest) {
  const guard = guardCron(req);
  if (!guard.ok) return guard.response;

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();

  const { data, error } = await (adminClient.from('candidate_assets') as any)
    .select('id')
    .eq('processing_status', 'processing')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(BATCH);

  if (error) {
    // Most likely the processing_status column does not exist yet. Harmless.
    return NextResponse.json({ ok: true, skipped: 'unavailable' });
  }

  const ids = (data ?? []).map((r: { id: string }) => r.id);
  let converted = 0;
  for (const id of ids as string[]) {
    const result = await processAudioAsset(id);
    if (result.ok) converted += 1;
  }

  return NextResponse.json({ ok: true, scanned: ids.length, converted });
}
