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

export interface CandidateProfile {
  id: string;
  clerk_user_id: string;
  slug: string;
  full_name: string;
  headline: string | null;
  target_role: string | null;
  location: string | null;
  linkedin_url: string | null;
  summary_bullets: string[];
  additional_context: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
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
