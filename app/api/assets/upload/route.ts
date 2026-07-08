import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminClient } from '@/lib/supabase/admin';
import { needsAudioConversion } from '@/lib/assets/audio-convert';
import { processAudioAsset } from '@/lib/assets/process-audio';

// Node runtime + a longer budget: the after() hook transcodes non-MP3 audio to
// MP3 once the response is sent, and that ffmpeg pass runs in this invocation.
export const runtime = 'nodejs';
export const maxDuration = 60;

// A not-yet-applied migration means processing_status does not exist. Detect
// that so we can fall back to a plain insert instead of failing the upload.
function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' || /processing_status/i.test(err.message ?? '');
}

type AssetConfig = {
  bucket: string;
  allowedMimes: string[];
  maxBytes: number;
  label: string;
};

const ASSET_CONFIGS: Record<string, AssetConfig> = {
  audio: {
    bucket: 'candidate-audio',
    allowedMimes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a'],
    maxBytes: 50 * 1024 * 1024,
    label: 'Audio Overview',
  },
  debate_audio: {
    bucket: 'candidate-audio',
    allowedMimes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a'],
    maxBytes: 50 * 1024 * 1024,
    label: 'Debate Audio',
  },
  video: {
    bucket: 'candidate-video',
    allowedMimes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxBytes: 500 * 1024 * 1024,
    label: 'Video Overview',
  },
  deck: {
    bucket: 'candidate-documents',
    allowedMimes: ['application/pdf'],
    maxBytes: 25 * 1024 * 1024,
    label: 'Slide Deck',
  },
  infographic: {
    bucket: 'candidate-images',
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maxBytes: 10 * 1024 * 1024,
    label: 'Infographic',
  },
  avatar: {
    bucket: 'candidate-images',
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
    label: 'Profile photo',
  },
  resume: {
    bucket: 'candidate-documents',
    allowedMimes: ['application/pdf'],
    maxBytes: 10 * 1024 * 1024,
    label: 'Resume',
  },
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Expected multipart/form-data' } }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const assetType = formData.get('asset_type') as string | null;
  const candidateProfileId = formData.get('candidate_profile_id') as string | null;

  if (!file || !assetType || !candidateProfileId) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Missing file, asset_type, or candidate_profile_id' } }, { status: 400 });
  }

  const config = ASSET_CONFIGS[assetType];
  if (!config) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Unknown asset_type' } }, { status: 400 });
  }

  // Verify the candidate_profile_id belongs to the authenticated user before
  // accepting any file data. Without this, any authenticated user could attach
  // assets to another candidate's profile.
  const { data: ownedProfile } = await (adminClient.from('candidate_profiles') as any)
    .select('id')
    .eq('id', candidateProfileId)
    .eq('clerk_user_id', userId)
    .single();

  if (!ownedProfile) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  }

  // Validate both the client-supplied MIME type and the file extension, the
  // MIME type can be spoofed in the multipart envelope, so the extension acts
  // as an independent guard.
  const allowedExtensions: Record<string, string[]> = {
    audio:        ['mp3', 'mp4', 'm4a', 'wav', 'webm', 'ogg'],
    debate_audio: ['mp3', 'mp4', 'm4a', 'wav', 'webm', 'ogg'],
    video:        ['mp4', 'webm', 'mov'],
    deck:         ['pdf'],
    infographic:  ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    avatar:       ['png', 'jpg', 'jpeg', 'webp'],
    resume:       ['pdf'],
  };
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!(allowedExtensions[assetType] ?? []).includes(ext)) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: `File extension .${ext} not allowed for ${assetType}` } },
      { status: 400 }
    );
  }

  if (!config.allowedMimes.includes(file.type)) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: `File type ${file.type} not allowed for ${assetType}` } },
      { status: 400 }
    );
  }

  if (file.size > config.maxBytes) {
    const maxMB = Math.round(config.maxBytes / 1024 / 1024);
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: `File exceeds ${maxMB}MB limit` } },
      { status: 400 }
    );
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${Date.now()}-${sanitizedName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Supabase Storage
  // adminClient: required because storage buckets are private and we're uploading on behalf of the user
  const { error: uploadError } = await (adminClient.storage
    .from(config.bucket) as any)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // Diagnostic: reveal which Supabase project this upload actually targets and
    // which buckets that connection can see. Pinpoints a "Bucket not found" that
    // is really a wrong-project / preview-branch mismatch.
    let supabaseHost = 'unknown';
    try {
      supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
    } catch {
      /* ignore */
    }
    let visibleBuckets: string[] = [];
    try {
      const { data: bk } = await (adminClient.storage as any).listBuckets();
      visibleBuckets = (bk ?? []).map((b: { name: string }) => b.name);
    } catch {
      /* ignore */
    }
    console.error(
      `Asset upload failed user=${userId} type=${assetType} targetBucket=${config.bucket} supabaseHost=${supabaseHost} visibleBuckets=${JSON.stringify(visibleBuckets)}`,
      uploadError,
    );
    return NextResponse.json({ error: { code: 'INTERNAL', message: uploadError.message } }, { status: 500 });
  }

  // Mark previous active asset of this type as inactive
  const { error: deactivateError } = await (adminClient.from('candidate_assets') as any)
    .update({ is_active: false })
    .eq('clerk_user_id', userId)
    .eq('asset_type', assetType)
    .eq('is_active', true);

  if (deactivateError) {
    // Non-fatal: log and continue. Duplicate active rows are preferable to blocking
    // the upload. A cleanup job can resolve stale rows later.
    console.error('Asset deactivation failed', userId, assetType, deactivateError);
  }

  // Insert new asset row. Audio that is not already MP3 (e.g. a NotebookLM DASH
  // m4a) is flagged 'processing' and transcoded to MP3 after the response; MP3
  // and every other asset type land 'ready' via the column default.
  const baseRow = {
    candidate_profile_id: candidateProfileId,
    clerk_user_id: userId,
    asset_type: assetType,
    storage_bucket: config.bucket,
    storage_path: storagePath,
    file_name: file.name,
    file_size_bytes: file.size,
    is_active: true,
  };

  const wantsConversion =
    (assetType === 'audio' || assetType === 'debate_audio') && needsAudioConversion(file.name);

  let assetId: string;
  let willConvert = false;

  if (wantsConversion) {
    const flagged = await (adminClient.from('candidate_assets') as any)
      .insert({ ...baseRow, processing_status: 'processing' })
      .select('id')
      .single();

    if (flagged.error && isMissingColumnError(flagged.error)) {
      // Migration not applied yet: store as-is so uploads keep working; the file
      // simply is not converted until the column exists.
      const fallback = await (adminClient.from('candidate_assets') as any)
        .insert(baseRow)
        .select('id')
        .single();
      if (fallback.error) {
        console.error('Asset row insert failed', userId, assetType, fallback.error);
        return NextResponse.json({ error: { code: 'INTERNAL', message: fallback.error.message } }, { status: 500 });
      }
      assetId = fallback.data.id;
    } else if (flagged.error) {
      console.error('Asset row insert failed', userId, assetType, flagged.error);
      return NextResponse.json({ error: { code: 'INTERNAL', message: flagged.error.message } }, { status: 500 });
    } else {
      assetId = flagged.data.id;
      willConvert = true;
    }
  } else {
    const { data, error: insertError } = await (adminClient.from('candidate_assets') as any)
      .insert(baseRow)
      .select('id')
      .single();
    if (insertError) {
      console.error('Asset row insert failed', userId, assetType, insertError);
      return NextResponse.json({ error: { code: 'INTERNAL', message: insertError.message } }, { status: 500 });
    }
    assetId = data.id;
  }

  if (willConvert) {
    // Transcode after the response is sent so the upload feels instant. The
    // /api/cron/process-audio sweep re-runs anything this misses.
    after(async () => {
      try {
        await processAudioAsset(assetId);
      } catch (e) {
        console.error('Audio conversion failed', assetId, e);
      }
    });
  }

  return NextResponse.json({ ok: true, asset_id: assetId, processing: willConvert });
}
