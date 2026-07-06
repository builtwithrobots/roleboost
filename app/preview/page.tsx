import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { redirect } from 'next/navigation';
import { signCallingCardAssets } from '@/lib/candidate/calling-card';
import CallingCard from '@/components/modal/CallingCard';
import type { Metadata } from 'next';

// Chrome-less, owner-only render of the candidate's own calling card. It is the
// iframe target for the dashboard Preview page's device frames: rendering the
// real <CallingCard> here (rather than a bespoke mock) keeps the preview
// pixel-identical to what recruiters see, and a real nested viewport makes the
// responsive breakpoints fire honestly at each device width. Kept out of the
// (candidate) route group so it inherits no dashboard sidebar chrome.
export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false, follow: false },
};

export default async function OwnerPreviewPage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { supabase, userId } = ctx;

  // The owner's own profile, published or not -- this is the whole point of a
  // preview. RLS scopes the read to the caller; the .eq is defense in depth.
  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select(
      'id, slug, full_name, headline, target_role, location, linkedin_url, summary_bullets, ai_enabled',
    )
    .eq('clerk_user_id', userId)
    .single();

  if (!profile) redirect('/dashboard/profile');

  const { avatarUrl, assets } = await signCallingCardAssets(profile.id);

  return (
    <div className="min-h-screen bg-[var(--rb-bg-page)]">
      <CallingCard
        preview
        slug={profile.slug}
        fullName={profile.full_name}
        headline={profile.headline}
        targetRole={profile.target_role}
        location={profile.location}
        linkedinUrl={profile.linkedin_url}
        summaryBullets={profile.summary_bullets ?? []}
        aiEnabled={profile.ai_enabled ?? false}
        avatarUrl={avatarUrl}
        assets={assets as any}
      />
    </div>
  );
}
