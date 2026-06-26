import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { ensureCandidateProfile } from '../profile/actions';
import AIStudio from '@/components/candidate/AIStudio';
import DashboardPage from '@/components/layout/DashboardPage';
import type { CandidateProfile } from '@/lib/types';

const AI_COLUMNS =
  'id, clerk_user_id, slug, full_name, headline, target_role, location, linkedin_url, summary_bullets, additional_context, is_published, ai_enabled, intake_completed, brain_readiness_score, leadership_philosophy, key_wins, departure_reasons, biggest_challenge, ideal_environment, manager_needs, honest_weaknesses, wish_questions, custom_qa_pairs, redirect_topics, created_at, updated_at';

export default async function AIStudioPage() {
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
    .select(AI_COLUMNS)
    .eq('clerk_user_id', userId)
    .single();

  let profile = rawProfile as CandidateProfile | null;

  if (!profile) {
    // First visit before the profile tab was opened — bootstrap the row and
    // fill the brain fields with their defaults (the row was just created with
    // these exact DB defaults). Re-querying here would hit fetch memoization.
    const base = await ensureCandidateProfile();
    profile = {
      ...base,
      ai_enabled: true,
      leadership_philosophy: null,
      key_wins: null,
      departure_reasons: null,
      biggest_challenge: null,
      ideal_environment: null,
      manager_needs: null,
      honest_weaknesses: null,
      wish_questions: null,
      custom_qa_pairs: [],
      redirect_topics: [],
    };
  }

  if (!profile) {
    return (
      <main className="p-8">
        <p className="text-sm text-red-600">
          Something went wrong loading your AI studio. Please refresh the page.
        </p>
      </main>
    );
  }

  return (
    <DashboardPage>
      <AIStudio profile={profile} />
    </DashboardPage>
  );
}
