import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { adminClient } from '@/lib/supabase/admin';
import { signCallingCardAssets } from '@/lib/candidate/calling-card';
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
    title: `${data.full_name}, RoleBoost`,
    description: data.headline ?? (data.target_role ? `${data.target_role} on RoleBoost` : 'Career profile on RoleBoost'),
  };
}

export default async function CandidateProfilePage({ params }: Props) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch the public profile, anon client, RLS allows is_published = true
  const { data: profileData } = await supabase
    .from('candidate_profiles')
    .select('id, clerk_user_id, full_name, headline, target_role, location, linkedin_url, summary_bullets, ai_enabled')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!profileData) notFound();

  // Sign the active assets (private buckets) for the header avatar + gallery.
  const { avatarUrl, assets } = await signCallingCardAssets(profileData.id);

  // Record the profile view reliably. A bare un-awaited insert during render is
  // dropped on serverless (the function returns before it completes), so defer it
  // with after() -- it runs after the response is sent and is guaranteed to
  // execute. Skip the owner's own views so the stat reflects recruiter interest,
  // not the candidate testing their own link (mirrors sandbox chats).
  const { userId: viewerId } = await auth();
  if (viewerId !== profileData.clerk_user_id) {
    after(async () => {
      const { error } = await (adminClient.from('profile_views') as any).insert({
        candidate_profile_id: profileData.id,
        viewer_clerk_user_id: viewerId ?? null,
      });
      if (error) console.error('profile_views insert failed', profileData.id, error);
    });
  }

  return (
    <div className="min-h-screen bg-[var(--rb-bg-page)]">
      {/* No marketing header here: this is the recruiter-facing calling card, kept
          focused on the conversation and the candidate. RoleBoost is credited
          subtly inside the chat panel ("Powered by RoleBoost AI"). */}
      <CallingCard
        slug={slug}
        fullName={profileData.full_name}
        headline={profileData.headline}
        targetRole={profileData.target_role}
        location={profileData.location}
        linkedinUrl={profileData.linkedin_url}
        summaryBullets={profileData.summary_bullets ?? []}
        aiEnabled={profileData.ai_enabled ?? false}
        avatarUrl={avatarUrl}
        assets={assets as any}
      />
    </div>
  );
}
