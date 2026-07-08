import 'server-only';
// adminClient: conversion runs as a background job on the user's behalf (after
// the request, or from cron), downloading and re-uploading a private-bucket
// asset and updating its row, all of which need to bypass RLS.
import { adminClient } from '@/lib/supabase/admin';
import { convertToMp3 } from './audio-convert';

type Result = { ok: boolean; error?: string };

/**
 * Transcode a candidate audio asset to progressive MP3 and swap it in place.
 *
 * Idempotent and safe to retry: downloads the current stored file, converts it,
 * uploads the MP3 alongside, repoints the row, and removes the original. On any
 * failure the row is marked 'failed' with the reason so the UI can offer a retry
 * and the cron sweep can leave it alone.
 */
export async function processAudioAsset(assetId: string): Promise<Result> {
  const { data: row, error } = await (adminClient.from('candidate_assets') as any)
    .select('id, storage_bucket, storage_path, file_name')
    .eq('id', assetId)
    .single();

  if (error || !row) return { ok: false, error: 'asset_not_found' };

  try {
    const { data: blob, error: dlErr } = await (adminClient.storage.from(row.storage_bucket) as any)
      .download(row.storage_path);
    if (dlErr || !blob) throw new Error(`download_failed: ${dlErr?.message ?? 'no data'}`);

    const inputBuffer = Buffer.from(await blob.arrayBuffer());
    const mp3 = await convertToMp3(inputBuffer);

    const stripExt = (s: string) => s.replace(/\.[^./]+$/, '');
    const newPath = `${stripExt(row.storage_path)}.mp3`;
    const newName = `${stripExt(row.file_name)}.mp3`;

    const { error: upErr } = await (adminClient.storage.from(row.storage_bucket) as any)
      .upload(newPath, mp3, { contentType: 'audio/mpeg', upsert: true });
    if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

    const { error: updErr } = await (adminClient.from('candidate_assets') as any)
      .update({
        storage_path: newPath,
        file_name: newName,
        file_size_bytes: mp3.length,
        processing_status: 'ready',
        processing_error: null,
      })
      .eq('id', assetId);
    if (updErr) throw new Error(`row_update_failed: ${updErr.message}`);

    // Remove the now-orphaned original (best effort; only if the path changed).
    if (newPath !== row.storage_path) {
      await (adminClient.storage.from(row.storage_bucket) as any)
        .remove([row.storage_path])
        .catch(() => {});
    }

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await (adminClient.from('candidate_assets') as any)
      .update({ processing_status: 'failed', processing_error: message.slice(0, 500) })
      .eq('id', assetId)
      .then(() => {}, () => {});
    return { ok: false, error: message };
  }
}
