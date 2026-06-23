import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { ensureCandidateProfile } from './actions';
import ProfileEditor from '@/components/candidate/ProfileEditor';
import DashboardPage from '@/components/layout/DashboardPage';
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
    // First visit after onboarding — bootstrap the profile row and use the
    // returned row directly. Re-querying here would be deduplicated by Next.js
    // fetch memoization against the read above and return the stale empty
    // result, so we rely on the row ensureCandidateProfile() returns.
    profile = await ensureCandidateProfile();
  }

  if (!profile) {
    // Creation failed — show minimal error state
    return (
      <main className="p-8">
        <p className="text-sm text-red-600">
          Something went wrong setting up your profile. Please refresh the page.
        </p>
      </main>
    );
  }

  return (
    <DashboardPage>
      <ProfileEditor profile={profile} />
    </DashboardPage>
  );
}
