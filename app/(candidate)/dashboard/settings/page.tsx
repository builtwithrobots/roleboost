import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import SettingsPanel from '@/components/candidate/SettingsPanel';

export default async function CandidateSettingsPage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { supabase, userId } = ctx;

  const { data: profileRow } = await supabase
    .from('candidate_profiles')
    .select('slug, full_name, is_published, ai_enabled')
    .eq('clerk_user_id', userId)
    .single();

  // No profile yet means onboarding never finished bootstrapping the row; the
  // profile page creates it, so send them there rather than showing an empty
  // settings shell whose toggles would have nothing to write to.
  if (!profileRow) redirect('/dashboard/profile');
  const profile = profileRow as {
    slug: string;
    full_name: string;
    is_published: boolean;
    ai_enabled: boolean;
  };

  const { data: userRow } = await supabase
    .from('users')
    .select('email, subscription_tier, subscription_status, created_at')
    .eq('clerk_user_id', userId)
    .single();
  const account = userRow as {
    email: string;
    subscription_tier: string | null;
    subscription_status: string;
    created_at: string;
  } | null;

  return (
    <DashboardPage>
      <PageHeader
        title="Settings"
        description="Manage your account, download your data, and control how your AI works."
      />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <SettingsPanel
          account={{
            fullName: profile.full_name ?? '',
            email: account?.email ?? '',
            slug: profile.slug,
            memberSince: account?.created_at ?? null,
            subscriptionTier: account?.subscription_tier ?? null,
            subscriptionStatus: account?.subscription_status ?? 'free',
          }}
          settings={{
            isPublished: profile.is_published,
            aiEnabled: profile.ai_enabled,
          }}
        />
      </div>
    </DashboardPage>
  );
}
