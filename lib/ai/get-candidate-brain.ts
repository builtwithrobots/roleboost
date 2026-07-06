import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import type { CandidateBrain, CareerContextDrafts, CustomQAPair } from '@/lib/types';

// The columns that make up the brain, plus the gating flags and owner id.
// Sensitive fields here are intentionally barred from the anon role (see the
// 20260626 migration); this read uses the service-role client so the chatbot can
// assemble the full prompt server-side without depending on anon column access.
const BRAIN_COLUMNS =
  'id, clerk_user_id, full_name, target_role, leadership_philosophy, key_wins, departure_reasons, biggest_challenge, ideal_environment, manager_needs, honest_weaknesses, wish_questions, additional_context, custom_qa_pairs, redirect_topics, ai_enabled, is_published, context_package_md, career_context_drafts';

interface BrainRow {
  id: string;
  clerk_user_id: string;
  full_name: string;
  target_role: string | null;
  leadership_philosophy: string | null;
  key_wins: string | null;
  departure_reasons: string | null;
  biggest_challenge: string | null;
  ideal_environment: string | null;
  manager_needs: string | null;
  honest_weaknesses: string | null;
  wish_questions: string | null;
  additional_context: string | null;
  custom_qa_pairs: unknown;
  redirect_topics: string[] | null;
  ai_enabled: boolean;
  is_published: boolean;
  context_package_md: string | null;
  career_context_drafts: unknown;
}

export interface CandidateBrainResult {
  candidateProfileId: string;
  ownerClerkUserId: string;
  isPublished: boolean;
  aiEnabled: boolean;
  candidate: CandidateBrain;
  resumeMarkdown: string | null;
  /** The active career-context document (synthesized narrative), if any. */
  careerContextMarkdown: string | null;
}

/**
 * Loads a candidate's brain by slug for the chat endpoint. Returns null only
 * when the profile does not exist. The caller is responsible for gating on
 * isPublished / aiEnabled / ownership -- this lets the owner preview their own
 * unpublished AI from the dashboard while keeping it hidden from recruiters.
 * Only the assembled answer is ever returned to the client; the raw brain never
 * leaves the server.
 */
export async function getCandidateBrainBySlug(
  slug: string,
): Promise<CandidateBrainResult | null> {
  const { data, error } = await (adminClient.from('candidate_profiles') as any)
    .select(BRAIN_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as BrainRow;

  // Resume text lives in resume_documents (one row per profile); may be absent.
  const { data: doc } = await (adminClient.from('resume_documents') as any)
    .select('canonical_markdown')
    .eq('candidate_profile_id', row.id)
    .maybeSingle();

  // Secondary target roles, read separately and resiliently so a not-yet-migrated
  // DB (column absent) degrades to [] instead of breaking the public chat.
  const { data: secondaryRow } = await (adminClient.from('candidate_profiles') as any)
    .select('secondary_target_roles')
    .eq('id', row.id)
    .maybeSingle();
  const secondaryTargetRoles = Array.isArray(secondaryRow?.secondary_target_roles)
    ? (secondaryRow.secondary_target_roles as string[])
    : [];

  // The selected generated angle's hard-question answer is the single most
  // important worked exemplar. Promote it into custom_qa_pairs (highest priority
  // + few-shot) ahead of the candidate's own pairs, unless they already pinned an
  // answer to the same question.
  const baseQA = normalizeCustomQA(row.custom_qa_pairs);
  const customQA = withSelectedHardQuestion(baseQA, row.career_context_drafts);

  const candidate: CandidateBrain = {
    full_name: row.full_name,
    target_role: row.target_role,
    secondary_target_roles: secondaryTargetRoles,
    leadership_philosophy: row.leadership_philosophy,
    key_wins: row.key_wins,
    departure_reasons: row.departure_reasons,
    biggest_challenge: row.biggest_challenge,
    ideal_environment: row.ideal_environment,
    manager_needs: row.manager_needs,
    honest_weaknesses: row.honest_weaknesses,
    wish_questions: row.wish_questions,
    additional_context: row.additional_context,
    custom_qa_pairs: customQA,
    redirect_topics: Array.isArray(row.redirect_topics) ? row.redirect_topics : [],
  };

  const resumeMarkdown =
    doc && typeof doc.canonical_markdown === 'string' && doc.canonical_markdown.trim().length > 0
      ? (doc.canonical_markdown as string)
      : null;

  const careerContextMarkdown =
    typeof row.context_package_md === 'string' && row.context_package_md.trim().length > 0
      ? row.context_package_md
      : null;

  return {
    candidateProfileId: row.id,
    ownerClerkUserId: row.clerk_user_id,
    isPublished: row.is_published,
    aiEnabled: row.ai_enabled,
    candidate,
    resumeMarkdown,
    careerContextMarkdown,
  };
}

/**
 * Prepends the selected career-context angle's hard-question Q/A to the custom QA
 * pairs so it inherits highest-priority + few-shot treatment. No-op when there is
 * no selected angle, or when the candidate already has a pair for that question.
 */
function withSelectedHardQuestion(pairs: CustomQAPair[], rawDrafts: unknown): CustomQAPair[] {
  const drafts = rawDrafts as CareerContextDrafts | null;
  const selected = drafts?.selected ? drafts.angles?.[drafts.selected] : null;
  const hq = selected?.hard_question;
  if (!hq || !hq.question?.trim() || !hq.answer?.trim()) return pairs;

  const exists = pairs.some(
    (p) => p.question.trim().toLowerCase() === hq.question.trim().toLowerCase(),
  );
  if (exists) return pairs;

  return [{ question: hq.question.trim(), answer: hq.answer.trim() }, ...pairs];
}

/** Defensively coerce JSONB custom_qa_pairs into a typed, validated array. */
function normalizeCustomQA(raw: unknown): CustomQAPair[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is CustomQAPair =>
      !!p &&
      typeof (p as CustomQAPair).question === 'string' &&
      typeof (p as CustomQAPair).answer === 'string',
  );
}
