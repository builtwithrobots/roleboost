import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// Upload a generated résumé file buffer to storage and record it as the active
// candidate_assets row of its type (deactivating any prior of that type).
// Mirrors app/api/assets/upload/route.ts. adminClient: private buckets + we
// write on the user's behalf with no browser session at generation time.

export async function storeGeneratedAsset(params: {
  userId: string;
  candidateProfileId: string;
  assetType: 'resume' | 'resume_docx';
  buffer: Buffer;
  contentType: string;
  fileName: string;
}): Promise<string> {
  const { userId, candidateProfileId, assetType, buffer, contentType, fileName } = params;
  const bucket = 'candidate-documents';
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${Date.now()}-${sanitized}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: uploadError } = await (adminClient.storage.from(bucket) as any).upload(
    storagePath,
    buffer,
    { contentType, upsert: false },
  );
  if (uploadError) throw new Error(`storeGeneratedAsset upload failed: ${uploadError.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('candidate_assets') as any)
    .update({ is_active: false })
    .eq('clerk_user_id', userId)
    .eq('asset_type', assetType)
    .eq('is_active', true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: asset, error: insertError } = await (adminClient.from('candidate_assets') as any)
    .insert({
      candidate_profile_id: candidateProfileId,
      clerk_user_id: userId,
      asset_type: assetType,
      storage_bucket: bucket,
      storage_path: storagePath,
      file_name: fileName,
      file_size_bytes: buffer.byteLength,
      is_active: true,
    })
    .select('id')
    .single();

  if (insertError || !asset) throw new Error(`storeGeneratedAsset insert failed: ${insertError?.message}`);
  return asset.id as string;
}
