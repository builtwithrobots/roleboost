import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { ensureCandidateProfile } from '../profile/actions';
import AIStudio from '@/components/candidate/AIStudio';
import DashboardPage from '@/components/layout/DashboardPage';
import { MAX_ACTIVE_SOURCES } from '@/lib/career-sources/queries';
import type {
  CandidateProfile,
  TranscriptGap,
  BrainHardeningSession,
  CareerSourceSummary,
} from '@/lib/types';

const GAP_COLUMNS =
  'id, candidate_profile_id, chat_session_id, question_asked, chatbot_answer, gap_type, suggested_prompt, category, priority, is_addressed, pattern_count, created_at';

const HARDENING_COLUMNS =
  'id, candidate_profile_id, transcript_source, source_context, questions_found, gaps_identified, gaps_addressed, hardening_plan, created_at, last_reanalyzed_at';

// Metadata only -- extracted_text is private brain material and stays server-side.
const SOURCE_COLUMNS = 'id, source_type, label, ingest_method, char_count, file_name, created_at';

const AI_COLUMNS =
  'id, clerk_user_id, slug, full_name, headline, target_role, location, linkedin_url, summary_bullets, additional_context, is_published, ai_enabled, intake_completed, brain_readiness_score, leadership_philosophy, key_wins, departure_reasons, biggest_challenge, ideal_environment, manager_needs, honest_weaknesses, wish_questions, custom_qa_pairs, redirect_topics, context_package_md, context_package_updated_at, career_context_drafts, created_at, updated_at';

const STUDIO_TABS = ['build', 'context', 'test', 'harden'] as const;
type StudioTab = (typeof STUDIO_TABS)[number];

export default async function AIStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Deep link: /dashboard/ai?tab=context opens that tab (used by the Getting
  // Started checklist and any in-app link). Invalid values fall back to "build".
  const { tab } = await searchParams;
  const initialTab: StudioTab = STUDIO_TABS.includes(tab as StudioTab)
    ? (tab as StudioTab)
    : 'build';

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
    // First visit before the profile tab was opened, bootstrap the row and
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
      context_package_md: null,
      context_package_updated_at: null,
      career_context_drafts: null,
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

  // Open gaps the prompt bot surfaces in the Build section. RLS scopes this to
  // the candidate's own profile; the explicit filter is defense-in-depth + index use.
  const { data: gapsData } = await supabase
    .from('transcript_gaps')
    .select(GAP_COLUMNS)
    .eq('candidate_profile_id', profile.id)
    .eq('is_addressed', false)
    .order('pattern_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(8);
  const gaps = (gapsData ?? []) as unknown as TranscriptGap[];

  // Past external-transcript hardening sessions (plan + counts only; never the transcript).
  const { data: hardeningData } = await supabase
    .from('brain_hardening_sessions')
    .select(HARDENING_COLUMNS)
    .eq('candidate_profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20);
  const hardeningSessions = (hardeningData ?? []) as unknown as BrainHardeningSession[];

  // Saved career sources (LinkedIn/Indeed/etc.) the candidate manages in the Build
  // section. RLS scopes to the owner; the explicit filter keeps it indexed.
  const { data: sourcesData } = await supabase
    .from('career_sources')
    .select(SOURCE_COLUMNS)
    .eq('candidate_profile_id', profile.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(MAX_ACTIVE_SOURCES);
  const sources = (sourcesData ?? []) as unknown as CareerSourceSummary[];

  return (
    <DashboardPage>
      <AIStudio
        profile={profile}
        initialTab={initialTab}
        gaps={gaps}
        hardeningSessions={hardeningSessions}
        sources={sources}
        maxSources={MAX_ACTIVE_SOURCES}
      />
    </DashboardPage>
  );
}
