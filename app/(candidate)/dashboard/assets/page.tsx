import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { getSignedAssetUrl } from '@/lib/storage/signed-urls';
import AssetsGrid from '@/components/candidate/AssetsGrid';
import DashboardPage from '@/components/layout/DashboardPage';

const ASSET_TYPES = ['audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume'] as const;
type AssetType = typeof ASSET_TYPES[number];

export default async function CandidateAssetsPage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { supabase, userId } = ctx;

  // Get candidate profile id
  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();

  if (!profile) redirect('/dashboard/profile');

  // Fetch all active assets
  const { data: rawAssets } = await supabase
    .from('candidate_assets')
    .select('id, asset_type, file_name, file_size_bytes, storage_bucket, storage_path, created_at')
    .eq('clerk_user_id', userId)
    .eq('is_active', true);

  const assets: { id: string; asset_type: string; file_name: string; file_size_bytes: number | null; storage_bucket: string; storage_path: string; created_at: string }[] = rawAssets ?? [];

  // Generate signed URLs for existing assets
  const assetsWithUrls = await Promise.all(
    assets.map(async (asset) => {
      let signed_url: string | undefined;
      try {
        signed_url = await getSignedAssetUrl(asset.storage_bucket, asset.storage_path);
      } catch {
        // Bucket may not exist yet in dev — continue without URL
      }
      return { ...asset, signed_url };
    })
  );

  const assetByType = Object.fromEntries(
    ASSET_TYPES.map((type) => [
      type,
      assetsWithUrls.find((a) => a.asset_type === type) ?? null,
    ])
  ) as Record<AssetType, typeof assetsWithUrls[number] | null>;

  const uploadedCount = Object.values(assetByType).filter(Boolean).length;

  return (
    <DashboardPage className="min-h-full bg-[--rb-bg-page]">
      {/* Header */}
      <div className="border-b border-[--rb-border] bg-[--rb-bg-surface] px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-xl font-bold text-[--rb-text]">Career Assets</h1>
          <p className="mt-1 text-sm text-[--rb-text-muted]">
            Upload the media files that power your RoleBoost profile.{' '}
            <span className="font-data text-[--rb-text-secondary]">{uploadedCount}</span>
            {' / '}
            <span className="font-data">{ASSET_TYPES.length}</span> uploaded.
          </p>
        </div>
      </div>

      {/* Progress bar + asset grid (client component for motion) */}
      <AssetsGrid
        candidateProfileId={profile.id}
        assetByType={assetByType}
        uploadedCount={uploadedCount}
      />

      {/* Tip */}
      <div className="mx-auto max-w-5xl px-6 pb-12">
        <div className="rounded-[--radius-xl] border border-[--rb-border-brand]/30 bg-[--rb-brand-subtle] px-5 py-4">
          <p className="text-sm text-[--rb-text-secondary]">
            <span className="font-semibold text-[--rb-text-brand]">Tip:</span>{' '}
            Audio Overview and Debate Audio are produced by Google NotebookLM from your career documents.
            Upload them here after generating — they&apos;re the most-played content on RoleBoost.
          </p>
        </div>
      </div>
    </DashboardPage>
  );
}
