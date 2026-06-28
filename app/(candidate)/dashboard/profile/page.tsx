import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { ensureCandidateProfile } from './actions';
import { adminClient } from '@/lib/supabase/admin';
import ProfileEditor from '@/components/candidate/ProfileEditor';
import GettingStarted from '@/components/candidate/GettingStarted';
import DashboardPage from '@/components/layout/DashboardPage';
import { getOnboardingProgress } from '@/lib/candidate/onboarding-progress';
import type { CandidateProfile } from '@/lib/types';

export default async function CandidateProfilePage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { supabase, userId } = ctx;

  const { data: rawProfile } = await supabase
    .from('candidate_profiles')
    .select(
      'id, clerk_user_id, slug, full_name, headline, target_role, location, linkedin_url, summary_bullets, additional_context, is_published, created_at, updated_at'
    )
    .eq('clerk_user_id', userId)
    .single();

  let profile = rawProfile as CandidateProfile | null;

  if (!profile) {
    // First visit after onboarding, bootstrap the profile row and use the
    // returned row directly. Re-querying here would be deduplicated by Next.js
    // fetch memoization against the read above and return the stale empty
    // result, so we rely on the row ensureCandidateProfile() returns.
    profile = await ensureCandidateProfile();
  }

  if (!profile) {
    // Creation failed, show minimal error state
    return (
      <main className="p-8">
        <p className="text-sm text-red-600">
          Something went wrong setting up your profile. Please refresh the page.
        </p>
      </main>
    );
  }

  // Active profile photo (if any) -- sign with the admin client since the bucket
  // is private. Avatars reuse the candidate_assets pipeline.
  let avatarUrl: string | null = null;
  const { data: avatarAsset } = await (adminClient.from('candidate_assets') as any)
    .select('storage_bucket, storage_path')
    .eq('candidate_profile_id', profile.id)
    .eq('asset_type', 'avatar')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (avatarAsset) {
    try {
      const { data } = await (adminClient.storage.from(avatarAsset.storage_bucket) as any).createSignedUrl(
        avatarAsset.storage_path,
        3600,
      );
      avatarUrl = data?.signedUrl ?? null;
    } catch {
      // Bucket may not exist yet; fall back to initials.
    }
  }

  // Real, stateful "getting started" progress to orient + activate the candidate.
  const progress = await getOnboardingProgress(supabase, profile.id);

  return (
    <DashboardPage>
      <GettingStarted progress={progress} />
      <ProfileEditor profile={profile} avatarUrl={avatarUrl} />
    </DashboardPage>
  );
}
