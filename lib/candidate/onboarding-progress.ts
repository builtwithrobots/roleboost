import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Computes the candidate's "getting started" progress from real signals across
// the brain-building journey. Owner-scoped: pass an authenticated (RLS) client.
// This powers the Getting Started checklist on the dashboard — it both explains
// the journey and shows the candidate exactly where they are and what is next.

export interface OnboardingProgress {
  /** Résumé uploaded and parsed (resume_documents exists). */
  resumeAdded: boolean;
  /** Brain has real content (intake done, readiness > 0, a field filled, or custom QA). */
  brainBuilt: boolean;
  /** An active career context document exists (generated-and-selected or uploaded). */
  contextReady: boolean;
  /** The candidate has tried their AI at least once (a sandbox session exists). */
  tested: boolean;
  /** Published with the AI on — recruiters can reach it. */
  live: boolean;
  completed: number;
  total: number;
  allDone: boolean;
}

const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

export async function getOnboardingProgress(
  supabase: SupabaseClient,
  profileId: string,
): Promise<OnboardingProgress> {
  // The brain-signal columns trip the literal-type parser, so this read uses the
  // untyped builder (same pattern as the intake/admin reads).
  const [profileRes, resumeRes, sandboxRes] = await Promise.all([
    (supabase.from('candidate_profiles') as any)
      .select(
        'brain_readiness_score, intake_completed, key_wins, leadership_philosophy, biggest_challenge, custom_qa_pairs, context_package_md, is_published, ai_enabled',
      )
      .eq('id', profileId)
      .maybeSingle(),
    supabase.from('resume_documents').select('id').eq('candidate_profile_id', profileId).maybeSingle(),
    supabase.from('sandbox_sessions').select('id').eq('candidate_profile_id', profileId).limit(1),
  ]);

  const p = (profileRes.data ?? {}) as Record<string, unknown>;
  const qa = Array.isArray(p.custom_qa_pairs) ? p.custom_qa_pairs : [];

  const resumeAdded = !!resumeRes.data;
  const brainBuilt =
    p.intake_completed === true ||
    (typeof p.brain_readiness_score === 'number' && p.brain_readiness_score > 0) ||
    hasText(p.key_wins) ||
    hasText(p.leadership_philosophy) ||
    hasText(p.biggest_challenge) ||
    qa.length > 0;
  const contextReady = hasText(p.context_package_md);
  const tested = (sandboxRes.data?.length ?? 0) > 0;
  const live = p.is_published === true && p.ai_enabled === true;

  const flags = [resumeAdded, brainBuilt, contextReady, tested, live];
  const completed = flags.filter(Boolean).length;

  return {
    resumeAdded,
    brainBuilt,
    contextReady,
    tested,
    live,
    completed,
    total: flags.length,
    allDone: completed === flags.length,
  };
}
