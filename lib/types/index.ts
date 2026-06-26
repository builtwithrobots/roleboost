export type UserRole = 'candidate' | 'employer' | 'admin';
export type SubscriptionStatus = 'free' | 'active' | 'cancelled' | 'past_due';
export type SubscriptionTier = 'pro' | 'starter' | 'growth' | 'scale';
export type AssetType = 'audio' | 'debate_audio' | 'video' | 'deck' | 'infographic' | 'resume';
export type CandidateStage = 'saved' | 'screening' | 'interview' | 'offer' | 'passed';
export type EmployerMemberRole = 'owner' | 'member';

export interface User {
  id: string;
  clerk_user_id: string;
  role: UserRole;
  email: string;
  is_admin: boolean;
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
  created_at: string;
  updated_at: string;
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
