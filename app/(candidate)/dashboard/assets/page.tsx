import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { getSignedAssetUrl } from '@/lib/storage/signed-urls';
import AssetUploadCard from '@/components/candidate/AssetUploadCard';
import AssetPackageCard from '@/components/candidate/AssetPackageCard';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import ResumeBuilderCard, { type ResumeDoc } from '@/components/candidate/ResumeBuilderCard';

export default async function CandidateAssetsPage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { supabase, userId } = ctx;

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id, slug')
    .eq('clerk_user_id', userId)
    .single();

  if (!profile) redirect('/dashboard/profile');
  const { id: profileId, slug } = profile as { id: string; slug: string };

  // The three Boosts: Short Boost Audio, Visual Boost (infographic), and the
  // Podcast Style Boost (debate_audio). Sign each for playback/preview.
  type MediaType = 'audio' | 'infographic' | 'debate_audio';
  type MediaAsset = {
    id: string;
    file_name: string;
    file_size_bytes: number | null;
    created_at: string;
    signed_url?: string;
    processing_status?: 'processing' | 'ready' | 'failed';
  };
  // processing_status is added by a later migration; read it defensively so an
  // un-migrated DB still renders the page (falls back to a query without it).
  const baseMediaCols = 'id, file_name, file_size_bytes, storage_bucket, storage_path, created_at, asset_type';
  const mediaQuery = (cols: string) =>
    supabase
      .from('candidate_assets')
      .select(cols)
      .eq('clerk_user_id', userId)
      .in('asset_type', ['audio', 'infographic', 'debate_audio'])
      .eq('is_active', true);
  let mediaRows: unknown[] | null;
  const withStatus = await mediaQuery(`${baseMediaCols}, processing_status`);
  if (withStatus.error) {
    const fallback = await mediaQuery(baseMediaCols);
    mediaRows = fallback.data;
  } else {
    mediaRows = withStatus.data;
  }

  const mediaByType: Record<MediaType, MediaAsset | null> = {
    audio: null,
    infographic: null,
    debate_audio: null,
  };
  for (const row of (mediaRows ?? []) as Array<{
    id: string;
    file_name: string;
    file_size_bytes: number | null;
    storage_bucket: string;
    storage_path: string;
    created_at: string;
    asset_type: MediaType;
    processing_status?: 'processing' | 'ready' | 'failed';
  }>) {
    const isProcessing = row.processing_status === 'processing';
    let signed_url: string | undefined;
    // While converting, the stored file is the original that is about to be
    // replaced, so skip signing it; the card shows a processing state instead.
    if (!isProcessing) {
      try {
        signed_url = await getSignedAssetUrl(row.storage_bucket, row.storage_path);
      } catch {
        // bucket may not exist yet, show the card without a preview link
      }
    }
    mediaByType[row.asset_type] = {
      id: row.id,
      file_name: row.file_name,
      file_size_bytes: row.file_size_bytes,
      created_at: row.created_at,
      signed_url,
      processing_status: row.processing_status,
    };
  }

  // Asset Package: the active context-package document (uploaded here or generated
  // and selected in AI Studio). Best-effort read; both columns predate this page.
  let packageMd: string | null = null;
  let packageUpdatedAt: string | null = null;
  const { data: pkg } = await supabase
    .from('candidate_profiles')
    .select('context_package_md, context_package_updated_at')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  if (pkg) {
    const p = pkg as { context_package_md?: string | null; context_package_updated_at?: string | null };
    packageMd = p.context_package_md ?? null;
    packageUpdatedAt = p.context_package_updated_at ?? null;
  }

  // Résumé document (ATS builder) with fresh signed download URLs.
  const { data: rawResume } = await supabase
    .from('resume_documents')
    .select('id, status, canonical_markdown, docx_asset_id, pdf_asset_id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  let resumeDoc: ResumeDoc | null = null;
  if (rawResume) {
    const r = rawResume as {
      id: string;
      status: ResumeDoc['status'];
      canonical_markdown: string;
      docx_asset_id: string | null;
      pdf_asset_id: string | null;
    };
    const signFor = async (assetId: string | null): Promise<string | undefined> => {
      if (!assetId) return undefined;
      const { data: a } = await supabase
        .from('candidate_assets')
        .select('storage_bucket, storage_path')
        .eq('id', assetId)
        .single();
      if (!a) return undefined;
      try {
        return await getSignedAssetUrl(a.storage_bucket as string, a.storage_path as string);
      } catch {
        return undefined;
      }
    };
    resumeDoc = {
      id: r.id,
      status: r.status,
      markdown: r.canonical_markdown,
      docxUrl: await signFor(r.docx_asset_id),
      pdfUrl: await signFor(r.pdf_asset_id),
    };
  }

  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Career Assets"
        description="Your résumé, your three Boosts (Short Boost Audio, Visual Boost, Podcast Style Boost), and your Asset Package, the materials that power your RoleBoost profile."
      />

      {/* ATS résumé builder */}
      <ResumeBuilderCard resume={resumeDoc} />

      {/* The three Boosts + Asset Package */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 py-8 sm:grid-cols-2 lg:grid-cols-3">
        <AssetUploadCard
          assetType="audio"
          candidateProfileId={profileId}
          existingAsset={mediaByType.audio ?? undefined}
        />
        <AssetUploadCard
          assetType="infographic"
          candidateProfileId={profileId}
          existingAsset={mediaByType.infographic ?? undefined}
        />
        <AssetUploadCard
          assetType="debate_audio"
          candidateProfileId={profileId}
          existingAsset={mediaByType.debate_audio ?? undefined}
        />
        <AssetPackageCard initialMarkdown={packageMd} updatedAt={packageUpdatedAt} slug={slug} />
      </div>

      {/* Tip */}
      <div className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-[var(--radius-xl)] border border-[var(--rb-border-brand)]/30 bg-[var(--rb-brand-subtle)] px-5 py-4">
          <p className="text-sm text-[var(--rb-text-secondary)]">
            <span className="font-semibold text-[var(--rb-text-brand)]">Tip:</span>{' '}
            Your Boosts are produced in Google NotebookLM from your career documents, upload each one
            here after generating. The Asset Package is your done-for-you package from RoleBoost,
            drop it in when you receive it.
          </p>
        </div>
      </div>
    </DashboardPage>
  );
}
