import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { ensureCandidateProfile } from './actions';
import ProfileEditor from '@/components/candidate/ProfileEditor';
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
      'id, clerk_user_id, slug, full_name, headline, target_role, location, linkedin_url, summary_bullets, is_published, created_at, updated_at'
    )
    .eq('clerk_user_id', userId)
    .single();

  let profile = rawProfile as CandidateProfile | null;

  if (!profile) {
    // First visit after onboarding — bootstrap the profile row
    await ensureCandidateProfile();
    // Re-fetch after creation
    const { data: created } = await supabase
      .from('candidate_profiles')
      .select(
        'id, clerk_user_id, slug, full_name, headline, target_role, location, linkedin_url, summary_bullets, is_published, created_at, updated_at'
      )
      .eq('clerk_user_id', userId)
      .single();
    profile = created as CandidateProfile | null;
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

  return <ProfileEditor profile={profile} />;
}
