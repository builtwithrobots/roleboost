import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { CandidateProfile } from '@/lib/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CandidateProfilePage({ params }: Props) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from('candidate_profiles')
    .select('id, full_name, headline, target_role, location, summary_bullets')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!data) notFound();

  const profile = data as Pick<
    CandidateProfile,
    'id' | 'full_name' | 'headline' | 'target_role' | 'location' | 'summary_bullets'
  >;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold">{profile.full_name}</h1>
        {profile.headline && (
          <p className="text-lg text-gray-600 mt-2">{profile.headline}</p>
        )}
      </div>
    </main>
  );
}
