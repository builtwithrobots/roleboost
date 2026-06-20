-- Function to extract Clerk user ID from JWT sub claim
CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT auth.jwt() ->> 'sub';
$$;

-- Users (all roles share this table)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('candidate', 'employer')),
  email TEXT NOT NULL,
  paddle_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'cancelled', 'past_due')),
  subscription_tier TEXT
    CHECK (subscription_tier IN ('basic', 'pro', 'starter', 'growth', 'scale')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());

-- Candidate profiles
CREATE TABLE candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9-]+$'),
  full_name TEXT NOT NULL,
  headline TEXT CHECK (char_length(headline) <= 200),
  target_role TEXT,
  location TEXT,
  linkedin_url TEXT,
  summary_bullets TEXT[] DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_profiles_owner ON candidate_profiles
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());
CREATE POLICY candidate_profiles_public_read ON candidate_profiles
  FOR SELECT TO anon
  USING (is_published = TRUE);

-- Candidate assets
CREATE TABLE candidate_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL
    CHECK (asset_type IN ('audio', 'video', 'deck', 'infographic', 'resume')),
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  duration_seconds INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE candidate_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_assets_owner ON candidate_assets
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());

-- Employer accounts
CREATE TABLE employer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  industry TEXT,
  team_size TEXT,
  created_by TEXT NOT NULL REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employer_accounts ENABLE ROW LEVEL SECURITY;

-- Employer team members
CREATE TABLE employer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member')),
  invited_by TEXT REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employer_account_id, clerk_user_id)
);

ALTER TABLE employer_members ENABLE ROW LEVEL SECURITY;

-- employer_accounts policy deferred until after employer_members exists
CREATE POLICY employer_accounts_members ON employer_accounts
  FOR ALL TO authenticated
  USING (
    id IN (
      SELECT employer_account_id FROM employer_members
      WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE POLICY employer_members_same_account ON employer_members
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members em2
      WHERE em2.clerk_user_id = requesting_user_id()
    )
  );

-- Job postings
CREATE TABLE job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_postings_employer_account ON job_postings
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members
      WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Saved candidates (employer candidate pool)
CREATE TABLE saved_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'saved'
    CHECK (stage IN ('saved', 'screening', 'interview', 'offer', 'passed')),
  notes TEXT,
  saved_by TEXT NOT NULL REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employer_account_id, candidate_profile_id)
);

ALTER TABLE saved_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_candidates_employer_account ON saved_candidates
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members
      WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Feedback (employer to candidate)
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  sent_by TEXT NOT NULL REFERENCES users(clerk_user_id),
  message TEXT NOT NULL CHECK (char_length(message) <= 1000),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_employer ON feedback
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members
      WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY feedback_candidate_read ON feedback
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles
      WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY feedback_candidate_update ON feedback
  FOR UPDATE TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles
      WHERE clerk_user_id = requesting_user_id()
    )
  )
  WITH CHECK (TRUE);

-- Profile view analytics
CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  viewer_clerk_user_id TEXT REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER
);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_views_candidate_read ON profile_views
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles
      WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY profile_views_insert ON profile_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);
