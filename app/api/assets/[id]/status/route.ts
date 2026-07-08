import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminClient } from '@/lib/supabase/admin';
import { processAudioAsset } from '@/lib/assets/process-audio';

export const runtime = 'nodejs';
export const maxDuration = 60;

// adminClient reads are scoped to the authenticated owner via an explicit
// clerk_user_id match below, so RLS bypass does not widen access here.
async function assertOwned(assetId: string, userId: string): Promise<boolean> {
  const { data } = await (adminClient.from('candidate_assets') as any)
    .select('id')
    .eq('id', assetId)
    .eq('clerk_user_id', userId)
    .maybeSingle();
  return Boolean(data);
}

// GET: poll the conversion status of an audio asset while the UI shows a
// processing state. Defensive against a not-yet-applied migration: a missing
// processing_status column reports 'ready' rather than erroring.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });

  const { id } = await params;
  if (!(await assertOwned(id, userId))) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  const { data, error } = await (adminClient.from('candidate_assets') as any)
    .select('processing_status')
    .eq('id', id)
    .maybeSingle();

  const status = !error && data?.processing_status ? data.processing_status : 'ready';
  return NextResponse.json({ ok: true, status });
}

// POST: retry a failed conversion.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });

  const { id } = await params;
  if (!(await assertOwned(id, userId))) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  const result = await processAudioAsset(id);
  if (!result.ok) {
    return NextResponse.json({ error: { code: 'INTERNAL', message: result.error } }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
