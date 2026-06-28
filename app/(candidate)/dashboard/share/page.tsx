import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import ShareHub from '@/components/candidate/ShareHub';
import DashboardPage from '@/components/layout/DashboardPage';

export default async function ShareHubPage() {
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
    .select('slug, full_name, headline, is_published')
    .eq('clerk_user_id', userId)
    .single();

  if (!profile) redirect('/dashboard/profile');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app';
  const profileUrl = `${appUrl}/c/${profile.slug}`;

  return (
    <DashboardPage>
      <ShareHub
        profileUrl={profileUrl}
        slug={profile.slug}
        fullName={profile.full_name}
        headline={profile.headline ?? ''}
        isPublished={profile.is_published}
      />
    </DashboardPage>
  );
}
