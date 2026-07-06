import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import PreviewFrame from '@/components/candidate/PreviewFrame';

export default async function CandidatePreviewPage() {
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
    .select('slug, is_published')
    .eq('clerk_user_id', userId)
    .single();

  if (!profile) redirect('/dashboard/profile');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app';

  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Preview"
        description="See your profile exactly as employers experience it, on any device."
      />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <PreviewFrame
          previewUrl="/preview"
          liveUrl={`${appUrl}/c/${profile.slug}`}
          slug={profile.slug}
          isPublished={profile.is_published}
        />
      </div>
    </DashboardPage>
  );
}
