import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// The asset buckets are private, so calling-card assets are served via short-
// lived signed URLs generated with the service-role client. Callers must have
// already authorized access to this profile (public publish check, or ownership).

export type CallingCardAssetType =
  | 'audio'
  | 'debate_audio'
  | 'video'
  | 'deck'
  | 'infographic'
  | 'resume';

export interface CallingCardAsset {
  asset_type: CallingCardAssetType;
  file_name: string;
  signed_url: string;
}

export interface SignedCallingCardAssets {
  /** The avatar is pulled out of the gallery and rendered in the profile header. */
  avatarUrl: string | null;
  assets: CallingCardAsset[];
}

/**
 * Signs the active assets for a candidate profile for the calling card, shared by
 * the public `/c/[slug]` page and the owner preview. The avatar is returned
 * separately so the header can render it; every other asset flows into the
 * gallery. Assets that can't be signed (e.g. a bucket that doesn't exist yet) are
 * skipped rather than failing the whole card.
 */
export async function signCallingCardAssets(
  profileId: string,
): Promise<SignedCallingCardAssets> {
  const { data: assetData } = await (adminClient.from('candidate_assets') as any)
    .select('asset_type, file_name, storage_bucket, storage_path')
    .eq('candidate_profile_id', profileId)
    .eq('is_active', true);

  const assets: CallingCardAsset[] = [];
  let avatarUrl: string | null = null;

  for (const asset of assetData ?? []) {
    try {
      const { data: signedData } = await (adminClient.storage
        .from(asset.storage_bucket) as any)
        .createSignedUrl(asset.storage_path, 3600);
      if (!signedData?.signedUrl) continue;
      if (asset.asset_type === 'avatar') {
        avatarUrl = signedData.signedUrl;
      } else {
        assets.push({
          asset_type: asset.asset_type,
          file_name: asset.file_name,
          signed_url: signedData.signedUrl,
        });
      }
    } catch {
      // Skip assets we can't sign, bucket may not exist yet.
    }
  }

  return { avatarUrl, assets };
}
