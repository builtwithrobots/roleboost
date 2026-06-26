import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { adminClient } from '@/lib/supabase/admin';
import CallingCard from '@/components/modal/CallingCard';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from('candidate_profiles')
    .select('full_name, headline, target_role')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!data) return { title: 'Profile not found' };

  return {
    title: `${data.full_name} — RoleBoost`,
    description: data.headline ?? (data.target_role ? `${data.target_role} on RoleBoost` : 'Career profile on RoleBoost'),
  };
}

export default async function CandidateProfilePage({ params }: Props) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch the public profile — anon client, RLS allows is_published = true
  const { data: profileData } = await supabase
    .from('candidate_profiles')
    .select('id, clerk_user_id, full_name, headline, target_role, location, linkedin_url, summary_bullets, ai_enabled')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!profileData) notFound();

  // Fetch active assets — use admin client to generate signed URLs for private buckets
  const { data: assetData } = await (adminClient.from('candidate_assets') as any)
    .select('asset_type, file_name, storage_bucket, storage_path')
    .eq('candidate_profile_id', profileData.id)
    .eq('is_active', true);

  const assets: Array<{
    asset_type: string;
    file_name: string;
    signed_url: string;
  }> = [];

  for (const asset of (assetData ?? [])) {
    try {
      const { data: signedData } = await (adminClient.storage
        .from(asset.storage_bucket) as any)
        .createSignedUrl(asset.storage_path, 3600);
      if (signedData?.signedUrl) {
        assets.push({
          asset_type: asset.asset_type,
          file_name: asset.file_name,
          signed_url: signedData.signedUrl,
        });
      }
    } catch {
      // Skip assets we can't sign — bucket may not exist yet
    }
  }

  // Record the profile view (fire-and-forget, no await)
  void (adminClient.from('profile_views') as any).insert({
    candidate_profile_id: profileData.id,
    viewed_at: new Date().toISOString(),
  });

  return (
    <div className="min-h-screen bg-[var(--rb-bg-page)]">
      {/* Slim brand header */}
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--rb-bg-surface)]/90 backdrop-blur border-b border-[var(--rb-border)] px-6 py-3">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight text-[var(--rb-text)]">
            Role<span className="text-[var(--rb-brand)]">Boost</span>
          </span>
          <Link
            href="/"
            className="text-xs text-[var(--rb-brand)] hover:underline font-medium"
          >
            Create your profile →
          </Link>
        </div>
      </header>

      <CallingCard
        slug={slug}
        fullName={profileData.full_name}
        headline={profileData.headline}
        targetRole={profileData.target_role}
        location={profileData.location}
        linkedinUrl={profileData.linkedin_url}
        summaryBullets={profileData.summary_bullets ?? []}
        aiEnabled={profileData.ai_enabled ?? false}
        assets={assets as any}
      />
    </div>
  );
}
