export type UserRole = 'candidate' | 'employer' | 'admin';
export type SubscriptionStatus = 'free' | 'active' | 'cancelled' | 'past_due';
export type SubscriptionTier = 'pro' | 'starter' | 'growth' | 'scale';
export type AssetType =
  | 'audio'
  | 'debate_audio'
  | 'video'
  | 'deck'
  | 'infographic'
  | 'resume'
  | 'avatar';
export type CandidateStage = 'saved' | 'screening' | 'interview' | 'offer' | 'passed';
export type EmployerMemberRole = 'owner' | 'member';

export interface User {
  id: string;
  clerk_user_id: string;
  role: UserRole;
  email: string;
  is_admin: boolean;
  suspended_at: string | null;
  paddle_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_tier: SubscriptionTier | null;
  created_at: string;
  updated_at: string;
}

export interface CustomQAPair {
  question: string;
  answer: string;
}

// The verified career context that feeds the AI system prompt. Resume text is
// NOT stored here -- it is sourced from resume_documents.canonical_markdown and
// passed to the prompt builder separately.
export interface CandidateBrain {
  full_name: string;
  target_role: string | null;
  /** Additional roles the candidate is open to, beyond the primary target. */
  secondary_target_roles: string[];
  leadership_philosophy: string | null;
  key_wins: string | null;
  departure_reasons: string | null;
  biggest_challenge: string | null;
  ideal_environment: string | null;
  manager_needs: string | null;
  honest_weaknesses: string | null;
  wish_questions: string | null;
  additional_context: string | null;
  custom_qa_pairs: CustomQAPair[];
  redirect_topics: string[];
}

export interface CandidateProfile extends CandidateBrain {
  id: string;
  clerk_user_id: string;
  slug: string;
  headline: string | null;
  location: string | null;
  linkedin_url: string | null;
  summary_bullets: string[];
  ai_enabled: boolean;
  is_published: boolean;
  intake_completed?: boolean;
  brain_readiness_score?: number;
  // The active career-context document (uploaded OR generated-and-selected). This
  // is the single slot the brain reads; both flows write here.
  context_package_md?: string | null;
  context_package_updated_at?: string | null;
  // Staging for self-serve generation: both narrative angles + which is selected.
  // Retired in favor of asset_package; kept optional for back-compat reads.
  career_context_drafts?: CareerContextDrafts | null;
  // The full self-serve asset package (both perspectives + which is chosen). The
  // chosen perspective's Section 1 is what populates context_package_md.
  asset_package?: AssetPackage | null;
  created_at: string;
  updated_at: string;
}

// ── Career Context Document (self-serve generation) ─────────────────────────
// The "RoleBoost Candidate Asset Production Skill" (Section 1 only) run in-app:
// the candidate's résumé + career sources synthesized into a polished, elite
// career-context document. Two narrative angles are generated; the candidate
// picks one, whose markdown becomes the active context_package_md.

export type CareerContextStoryType =
  | 'career_arc'
  | 'builder'
  | 'problem_solver'
  | 'leadership'
  | 'skeptic_champion'
  | 'specialist';

export type CareerContextAngleKey = 'A' | 'B';

export interface CareerContextAngle {
  /** Short human label for this framing, e.g. "The Builder". */
  name: string;
  story_type: CareerContextStoryType;
  headline: string;
  target_role: string;
  location: string;
  /** 2-3 sentence evidence-grounded story (third person about the candidate). */
  narrative: string;
  /** One line: the single most credible, specific fact. */
  hook: string;
  /** The one hard question every recruiter asks, with a first-person answer. */
  hard_question: { question: string; answer: string };
  /** 5-8 specific metrics/facts that must appear in every asset. */
  key_numbers: string[];
  positioning: string;
  /**
   * Verbatim third-party quotes pulled from career sources (recommendations,
   * reviews), curated evidence, not raw source text. Empty when no sources.
   */
  evidence_snippets: EvidenceSnippet[];
  /** The full document rendered to markdown, what lands in context_package_md. */
  markdown: string;
}

export interface EvidenceSnippet {
  /** The exact quote from a source. */
  quote: string;
  /** Where it came from, e.g. "LinkedIn recommendation" or a name/title. */
  source: string;
}

export interface CareerContextDrafts {
  angles: Record<CareerContextAngleKey, CareerContextAngle>;
  /** The angle the generator recommends. */
  recommended: CareerContextAngleKey;
  /** The angle the candidate selected, or null until they choose. */
  selected: CareerContextAngleKey | null;
  generated_at: string;
}

// ── Asset Package (self-serve, in-app) ──────────────────────────────────────
// The full RoleBoost Candidate Asset Production Skill run in AI Studio: résumé +
// career sources, strategized toward a target role + optional job description,
// producing TWO narrative perspectives, each a self-contained narrative (Section
// 1) plus its four ready-to-run NotebookLM prompts (Section 2). The candidate
// chooses one perspective; that perspective's rendered Section 1 becomes the
// active context_package_md and drives the AI brain. Both perspectives' prompts
// stay available to copy/download. This is the narrative hub; it replaces the
// retired career-context two-angle generator.

/** The 10 story types from the Candidate Asset Production Skill (v1.7). */
export type AssetPackageStoryType =
  | 'career_arc'
  | 'builder'
  | 'problem_solver'
  | 'leadership'
  | 'skeptic_champion'
  | 'specialist'
  | 'promoter'
  | 'reinventor'
  | 'culture_builder'
  | 'steady_hand';

export const ASSET_PACKAGE_STORY_TYPE_LABELS: Record<AssetPackageStoryType, string> = {
  career_arc: 'The Career Arc',
  builder: 'The Builder',
  problem_solver: 'The Problem Solver',
  leadership: 'The Leadership Story',
  skeptic_champion: 'The Skeptic and the Champion',
  specialist: 'The Specialist',
  promoter: 'The Promoter',
  reinventor: 'The Reinventor',
  culture_builder: 'The Culture Builder',
  steady_hand: 'The Steady Hand',
};

export type AssetPackagePerspectiveKey = 'A' | 'B';

/** Identity Snapshot (Section 1.1) -- shared across both perspectives. */
export interface AssetPackageIdentity {
  name: string;
  slug: string;
  location: string;
  target_role: string;
  headline: string;
  /** Avatar color chosen from the RoleBoost palette, with a one-line rationale. */
  avatar_color: { name: string; hex: string; rationale: string };
  initials: string;
}

/** One fully-written NotebookLM prompt (Section 2). */
export interface AssetPackagePrompt {
  /** The prompt's short name, e.g. "The First Non-Lead". */
  title: string;
  /** The full, copy-paste-ready prompt body. */
  body: string;
}

/** One row of the NotebookLM Prompt Mapping table (Section 1.6). */
export interface AssetPackagePromptMappingRow {
  format: 'Deep Dive' | 'Brief' | 'Infographic' | 'Short Video';
  prompt_name: string;
  rationale: string;
  tone_note: string;
}

/**
 * One narrative perspective: a self-contained Section 1 narrative plus its four
 * NotebookLM prompts. Choosing a perspective drives the brain, so each carries its
 * own narrative/hook/hard-question/key-numbers (not a shared block).
 */
export interface AssetPackagePerspective {
  /** Perspective name, e.g. "The Trust Signal". */
  name: string;
  /** One or two sentences on what this framing leads with and why. */
  summary: string;
  /** Section 1.2 -- 2-3 sentence evidence-grounded story (third person). */
  narrative: string;
  /** Section 1.3 -- one line, the single most credible specific fact. */
  hook: string;
  /** Section 1.4 -- the one hard question, with a first-person answer. */
  hard_question: { question: string; answer: string };
  /** Section 1.5 -- 5-8 specific metrics/facts that must appear in every asset. */
  key_numbers: string[];
  /** Section 1.6 -- NotebookLM prompt mapping (4 rows). */
  prompt_mapping: AssetPackagePromptMappingRow[];
  /** Section 2 -- the four fully-written NotebookLM prompts. */
  prompts: {
    deep_dive: AssetPackagePrompt;
    brief: AssetPackagePrompt;
    infographic: AssetPackagePrompt;
    short_video: AssetPackagePrompt;
  };
  /** This perspective's Section 1 rendered to markdown; promotes to context_package_md. */
  brain_context_md: string;
}

export interface AssetPackage {
  /** The target role the package was strategized for. */
  target_role: string;
  /** The job description used to strategize, or null. */
  job_description: string | null;
  story_type: AssetPackageStoryType;
  /** The perspective the generator recommends. */
  recommended: AssetPackagePerspectiveKey;
  /** The perspective the candidate chose (drives the brain), or null until chosen. */
  chosen: AssetPackagePerspectiveKey | null;
  identity: AssetPackageIdentity;
  perspectives: Record<AssetPackagePerspectiveKey, AssetPackagePerspective>;
  /** The full deliverable rendered to markdown, for download/copy ([slug]-asset-package.md). */
  full_markdown: string;
  generated_at: string;
}

export type ChatRole = 'user' | 'assistant';

// One turn in the chat transcript, exchanged between the client and /api/chat.
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatSession {
  id: string;
  candidate_profile_id: string;
  viewer_clerk_user_id: string | null;
  employer_account_id: string | null;
  employer_company_name: string | null;
  is_sandbox: boolean;
  started_at: string;
  ended_at: string | null;
  transcript_sent: boolean;
}

export interface ChatMessage {
  id: string;
  chat_session_id: string;
  role: ChatRole;
  content: string;
  // Phase B model + validation tracking (populated on assistant turns).
  model_used: string | null;
  was_complex: boolean;
  was_validated: boolean;
  created_at: string;
}

export interface CandidateAsset {
  id: string;
  candidate_profile_id: string;
  clerk_user_id: string;
  asset_type: AssetType;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  is_active: boolean;
  created_at: string;
}

// A recruiter's request to meet, captured when the Personal Assistant redirects.
// Lightweight inbound pipeline: new -> contacted -> scheduled -> closed.
export type MeetingRequestStatus = 'new' | 'contacted' | 'scheduled' | 'closed';

export interface MeetingRequest {
  id: string;
  candidate_profile_id: string;
  chat_session_id: string | null;
  recruiter_email: string;
  recruiter_name: string | null;
  availability: string;
  status: MeetingRequestStatus;
  created_at: string;
}

// ── Sandbox self-testing (Phase C) ──────────────────────────────────────────

export type SandboxCategory =
  | 'gap_departure'
  | 'commitment_tenure'
  | 'metric_verification'
  | 'leadership'
  | 'adversarial'
  | 'weakness_failure';

export type SandboxVerdict = 'strong' | 'adequate' | 'weak' | 'hallucinated';

export interface SandboxQuestion {
  id: string;
  category: SandboxCategory;
  question: string;
  whyItMatters: string;
  // Brain field keys this question probes (e.g. 'departure_reasons', 'key_wins').
  brainFields: string[];
}

export interface SandboxAnalysis {
  verdict: SandboxVerdict;
  diagnosis: string;
  prescription: string;
  // A brain field key to strengthen, or 'custom_qa', or null.
  brainFieldTarget: string | null;
  expansionPrompt: string;
}

export interface SandboxSession {
  id: string;
  candidate_profile_id: string;
  question: string;
  question_category: string;
  ai_answer: string;
  verdict: SandboxVerdict;
  diagnosis: string;
  prescription: string;
  brain_field_target: string | null;
  expansion_prompt: string | null;
  pattern_signal: boolean;
  created_at: string;
}

// ── AI intake interview (Phase D) ───────────────────────────────────────────

export type IntakeSeverity = 'high' | 'medium' | 'low';

export interface IntakeInconsistency {
  id: string;
  sourceA: string;
  sourceB: string;
  description: string;
  severity: IntakeSeverity;
}

export interface IntakeQuestion {
  id: string;
  question: string;
  /** Why this is being asked -- shown under the question. */
  context: string;
  /** Brain field key the answer feeds (e.g. 'departure_reasons'). */
  category: string;
  pass: number;
}

export interface IntakeAnswer {
  questionId: string;
  questionText: string;
  answerText: string;
  category: string;
  pass: number;
}

/** A source document fed to the analysis (résumé, LinkedIn paste, etc.). */
export interface IntakeDocument {
  label: string;
  text: string;
}

export interface BrainReadiness {
  overall: number; // 0-100
  categories: { label: string; score: number }[];
}

// ── Career sources (external profile imports) ───────────────────────────────

export type CareerSourceType =
  | 'linkedin'
  | 'indeed'
  | 'github'
  | 'portfolio'
  | 'review'
  | 'recommendation'
  | 'other';

export type SourceIngestMethod = 'upload' | 'paste' | 'link';

// Client-safe view of a source: metadata only, never the extracted_text body.
export type CareerSourceSummary = Pick<
  CareerSource,
  'id' | 'source_type' | 'label' | 'ingest_method' | 'char_count' | 'file_name' | 'created_at'
>;

// External career material a candidate brings in (LinkedIn/Indeed/GitHub/reviews).
// Stored as extracted text and fed to the brain as grounding -- never displayed
// raw to recruiters. extracted_text is private; never granted to anon.
export interface CareerSource {
  id: string;
  candidate_profile_id: string;
  clerk_user_id: string;
  source_type: CareerSourceType;
  label: string;
  ingest_method: SourceIngestMethod;
  extracted_text: string;
  char_count: number;
  source_url: string | null;
  file_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Transcript-to-brain gap loop (Phase E2) ─────────────────────────────────

export type TranscriptGapType = 'deflection' | 'weak' | 'new_topic';
export type GapPriority = 'high' | 'medium' | 'low';

/** A gap as produced by the analyzer (before it gets DB ids). */
export interface TranscriptGapItem {
  questionAsked: string;
  chatbotAnswer: string;
  gapType: TranscriptGapType;
  suggestedPrompt: string;
  /** Ready-to-approve drafted answer; only when the brain already has the substance. */
  suggestedAnswer?: string | null;
  category: string;
  priority: GapPriority;
}

export interface TranscriptGap {
  id: string;
  candidate_profile_id: string;
  chat_session_id: string;
  question_asked: string;
  chatbot_answer: string;
  gap_type: TranscriptGapType;
  suggested_prompt: string;
  suggested_answer: string | null;
  category: string;
  priority: GapPriority;
  is_addressed: boolean;
  pattern_count: number;
  created_at: string;
}

// ── External transcript hardening (Phase E3) ────────────────────────────────

export type HardeningSource = 'paste' | 'file';
export type CoverageVerdict = 'strong' | 'adequate' | 'weak' | 'missing';

/** A question pulled from an external transcript, judged against the brain. */
export interface TranscriptHardeningGap {
  questionFromTranscript: string;
  brainCoverageVerdict: CoverageVerdict;
  expansionPrompt: string;
  /** A brain field key, or 'custom_qa'. */
  brainFieldTarget: string;
  priority: GapPriority;
}

/** One prioritized step in the hardening plan. */
export interface HardeningAction {
  priority: number;
  action: string;
  brainFieldTarget: string;
  expansionPrompt: string;
}

/** The analyzer's full result for one transcript (also the API response body). */
export interface BrainHardeningResult {
  questionsFound: number;
  gapsIdentified: TranscriptHardeningGap[];
  strongCoverageConfirmed: string[];
  hardeningPlan: HardeningAction[];
}

export interface BrainHardeningSession {
  id: string;
  candidate_profile_id: string;
  transcript_source: HardeningSource;
  source_context: string | null;
  questions_found: number;
  gaps_identified: number;
  gaps_addressed: number;
  hardening_plan: HardeningAction[];
  created_at: string;
  last_reanalyzed_at: string | null;
}
