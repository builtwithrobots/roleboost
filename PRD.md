# PRD.md — [APPNAME] Product Requirements Document

**Version:** 1.0
**Last updated:** June 2026
**Author:** Rob Ramos

---

## 1. Overview

[APPNAME] is a two-sided SaaS platform replacing the resume with a rich, shareable candidate narrative. Candidates upload their assets and get a hosted profile page with a pop-up modal experience. Employers save candidates, manage job postings, assign stages, collaborate with their team, and send feedback.

**Core user types:**
- **Candidate** -- job seeker uploading career assets and sharing their profile link
- **Employer** -- hiring manager or recruiter saving candidates and managing their pipeline

---

## 2. Authentication and Onboarding

### 2.1 Sign Up and Sign In

- Clerk handles all authentication
- Sign up supports email/password and Google OAuth
- Single sign-up flow -- role is NOT declared on the sign-up page

**Acceptance criteria:**
- [ ] User can sign up with email and password
- [ ] User can sign up with Google
- [ ] User can sign in with email and password
- [ ] User can sign in with Google
- [ ] Successful sign-up redirects to onboarding
- [ ] Successful sign-in redirects to the correct dashboard based on role

### 2.2 Onboarding -- Role Selection

After first sign-up, every user lands on the onboarding screen before they see any dashboard.

**Screen:** "How are you using [APPNAME]?"

Two options displayed as large, tappable cards:
- "I am looking for my next role" → sets role to `candidate`
- "I am hiring for my team" → sets role to `employer`

On selection:
- Insert row into `users` table with `clerk_user_id`, `email`, `role`
- Candidate: redirect to candidate onboarding (2.3)
- Employer: redirect to employer onboarding (2.4)

**Acceptance criteria:**
- [ ] Onboarding screen shown on first login only
- [ ] Both options visible, keyboard accessible, minimum 44px touch target
- [ ] Role stored in `users.role` in Supabase
- [ ] Correct redirect after selection

### 2.3 Candidate Onboarding

Three-step flow before reaching the dashboard.

**Step 1 -- Basic info:**
- Full name (required)
- Location (city, state) (required)
- Target role / job title (required)
- LinkedIn URL (optional)

**Step 2 -- Career headline:**
- Headline text field (max 200 chars)
- Helper text: "Example: Director of Operations | 20+ years warehouse leadership"

**Step 3 -- Profile slug:**
- Auto-generated from full name (e.g. `robert-ramos`)
- Editable -- must be unique, lowercase, alphanumeric and hyphens only
- Show live preview of their public URL: `[APPNAME].com/c/[slug]`

On completion:
- Insert row into `candidate_profiles`
- Redirect to `/dashboard/profile`

**Acceptance criteria:**
- [ ] Three-step flow with progress indicator
- [ ] Validation on all required fields
- [ ] Slug auto-generated and editable
- [ ] Slug uniqueness checked in real time
- [ ] Public URL preview shown before confirmation
- [ ] Profile row created in Supabase on completion

### 2.4 Employer Onboarding

Two-step flow before reaching the dashboard.

**Step 1 -- Company info:**
- Company name (required)
- Industry (optional, dropdown)
- Approximate team size (optional, dropdown: 1-10, 11-50, 51-200, 200+)

**Step 2 -- Your role:**
- Your job title (required)
- How did you hear about us (optional)

On completion:
- Insert row into `employer_accounts`
- Insert row into `employer_members` with role `owner`
- Redirect to `/dashboard/candidates`

**Acceptance criteria:**
- [ ] Two-step flow with progress indicator
- [ ] Company name required
- [ ] employer_accounts and employer_members rows created
- [ ] User is set as account owner

---

## 3. Candidate Features

### 3.1 Candidate Dashboard -- Profile Tab

The main hub for candidates to manage their profile and assets.

**Layout:**
- Left sidebar: navigation (Profile, Assets, Preview, Analytics, Feedback)
- Main content: profile editor

**Profile editor sections:**
- Basic info (name, location, target role, LinkedIn)
- Headline
- AI bullet summary (5-7 bullet points -- manually entered or pasted from NotebookLM output)
- Profile visibility toggle (Published / Draft)

**Shareable link section:**
- Displays their full public URL: `[APPNAME].com/c/[slug]`
- Copy to clipboard button
- Shows view count badge if on Basic or Pro tier

**Acceptance criteria:**
- [ ] All profile fields editable and auto-saved on blur
- [ ] AI bullet summary supports up to 7 bullet points
- [ ] Bullet points can be added, edited, reordered, and deleted
- [ ] Published/Draft toggle updates `candidate_profiles.is_published`
- [ ] Unpublished profiles return 404 on the public URL
- [ ] Copy link button copies URL to clipboard with confirmation toast
- [ ] View count shown for paid tiers only

### 3.2 Candidate Dashboard -- Assets Tab

Where candidates upload their career assets produced in NotebookLM.

**Asset types and accepted formats:**

| Asset | Type | Accepted Formats | Max Size |
|---|---|---|---|
| Audio Overview | audio | MP3, M4A, WAV | 50MB |
| Video Overview | video | MP4, MOV, WEBM | 500MB |
| Slide Deck | document | PDF | 25MB |
| Career Infographic | image | PNG, JPG, WEBP | 10MB |
| ATS Resume | document | PDF | 5MB |

**Per asset:**
- Upload button with drag and drop support
- File name displayed after upload
- File size and upload date shown
- Replace button (replaces the existing asset)
- Delete button (with confirmation)
- Asset preview (audio player, video player, image preview, PDF embed)

**Free tier limit:** 1 asset slot total. Upgrade prompt shown when attempting to add a second asset.

**Acceptance criteria:**
- [ ] All five asset types uploadable
- [ ] File type and size validation before upload
- [ ] Upload progress indicator
- [ ] Asset stored in correct Supabase Storage bucket
- [ ] Asset record created in `candidate_assets` table
- [ ] Replace replaces the file and updates the storage path
- [ ] Delete removes the file from storage and the database record
- [ ] Free tier limited to 1 active asset -- upgrade prompt shown at limit
- [ ] All asset previews functional in the dashboard

### 3.3 Candidate Dashboard -- Preview Tab

Shows the candidate exactly what employers see when they click their profile link.

- Renders the full modal component in a preview frame
- "This is how employers see your profile" label at top
- Shows "Draft -- not visible to employers" banner if profile is unpublished

**Acceptance criteria:**
- [ ] Modal renders identically to the public `/c/[slug]` experience
- [ ] Draft banner shown for unpublished profiles
- [ ] Preview updates immediately after any asset or profile change

### 3.4 Candidate Dashboard -- Analytics Tab

Available on Basic and Pro tiers only.

**Metrics shown:**
- Total profile views (all time)
- Views in the last 7 days
- Views in the last 30 days
- Average engagement duration (seconds)
- Asset play counts by type (how many times audio was played, video played, etc.)
- Recent views list (date, employer company name if known, duration)

**Free tier:** Analytics tab visible but locked. Upgrade prompt shown.

**Acceptance criteria:**
- [ ] All metrics pulled from `profile_views` table
- [ ] Views list shows last 20 views
- [ ] Employer company name shown when the viewer was a logged-in employer
- [ ] Anonymous views shown as "Anonymous viewer"
- [ ] Free tier sees locked state with upgrade CTA
- [ ] Basic and Pro tiers see full analytics

### 3.5 Candidate Dashboard -- Feedback Tab

Available on Pro tier only.

**Feedback inbox:**
- List of feedback messages from employers
- Each item shows: company name, message preview, date received, read/unread status
- Click to open full message
- Mark as read on open

**Free and Basic tiers:** Tab visible but locked. Upgrade prompt shown.

**Acceptance criteria:**
- [ ] Feedback pulled from `feedback` table filtered by candidate
- [ ] Unread count shown in sidebar navigation
- [ ] Mark as read updates `feedback.is_read`
- [ ] Free and Basic tiers see locked state with upgrade CTA

---

## 4. Public Candidate Profile -- The Modal

The core employer-facing experience. Accessible at `/c/[slug]`.

### 4.1 Modal Trigger Behavior

- The URL `/c/[slug]` loads a full page with a dark overlay background
- The modal appears centered on the page -- no separate "trigger" element needed
- On desktop: modal is 640px wide, centered
- On mobile: modal is full screen

### 4.2 Modal Header

- Candidate initials avatar (generated from full name, colored circle)
- Full name
- Headline
- Location and target role

### 4.3 AI Summary Panel

Immediately below the header. Always visible without clicking any tab.

- Displays the candidate's bullet summary points
- Maximum 7 bullets shown
- Labeled "Career snapshot"

### 4.4 Media Tabs

Four tabs: Audio | Video | Deck | Infographic

Only tabs with uploaded assets are shown. If a candidate has no video, the Video tab does not appear.

**Audio tab:**
- Custom audio player (not browser default)
- Play/pause button
- Progress bar with click-to-seek
- Current time / total duration
- File name or "Career narrative" label
- Audio streams from signed Supabase Storage URL

**Video tab:**
- Embedded video player
- Play/pause, progress bar, fullscreen button
- Video streams from signed Supabase Storage URL

**Deck tab:**
- PDF embed (scrollable)
- Download button
- PDF served via signed Supabase Storage URL

**Infographic tab:**
- Full-width image display
- Download button
- Image served via signed Supabase Storage URL

### 4.5 Resume Tab

Always shown as the last tab if a resume asset exists.

- "ATS-Ready Resume" label
- Download PDF button
- Brief description: "Formatted for applicant tracking systems"

### 4.6 Employer Actions (shown when employer is logged in)

- **Save button** -- saves candidate to employer's pool. Changes to "Saved" with a filled icon after saving.
- **Connect button** -- opens a compose interface to send a message/feedback to the candidate
- **Status dropdown** -- assign candidate to a stage (only shown if candidate is already in employer's pool)
- **Share button** -- copies the candidate's public URL to clipboard

**Unauthenticated employer actions:**
- Save and Connect buttons still visible
- Clicking prompts employer to sign up or sign in first, then returns to complete the action

### 4.7 View Tracking

Every modal open logs a view in `profile_views`:
- `candidate_profile_id`
- `viewer_clerk_user_id` (null if not logged in)
- `employer_account_id` (null if not logged in or not an employer)
- `viewed_at`
- Duration tracked via a timer that stops when the modal is closed

**Acceptance criteria:**
- [ ] Modal renders at `/c/[slug]`
- [ ] Returns 404 for unpublished profiles
- [ ] All tabs render correctly with correct asset
- [ ] Tabs only shown when asset exists
- [ ] Audio player functional with progress bar
- [ ] Video player functional
- [ ] PDF deck renders inline
- [ ] Infographic image renders full width
- [ ] Resume download works
- [ ] Save button functional for logged-in employers
- [ ] Connect button opens feedback compose
- [ ] View logged on every open
- [ ] Duration tracked on close
- [ ] Fully keyboard navigable
- [ ] Focus trapped while open
- [ ] ESC closes modal
- [ ] WCAG 2.1 AA compliant

---

## 5. Employer Features

### 5.1 Employer Dashboard -- Candidates Tab

The main candidate pool view. All candidates saved by anyone on the employer's account.

**Layout:**
- Grid of candidate cards (3 columns desktop, 1 column mobile)
- Filter bar: by job posting, by stage, by date saved
- Search bar: search by name or headline

**Candidate card shows:**
- Initials avatar
- Full name
- Headline
- Stage badge (colored by stage)
- Job posting name (if attached)
- Assets available (icon indicators for audio, video, deck, infographic, resume)
- Date saved
- Click anywhere on card to open candidate modal

**Acceptance criteria:**
- [ ] All saved candidates shown in grid
- [ ] Cards show all required fields
- [ ] Filter by job posting works
- [ ] Filter by stage works
- [ ] Search by name and headline works
- [ ] Clicking card opens candidate modal inline (not a new tab)
- [ ] Free tier limited to 5 saved candidates -- upgrade prompt shown at limit

### 5.2 Employer Dashboard -- Jobs Tab

Manage job postings.

**Job postings list:**
- Table showing: title, department, location, number of candidates attached, date created, active/inactive status
- Create new posting button

**Create / Edit Job Posting form:**
- Title (required)
- Department (optional)
- Location (optional)
- Description (optional, rich text)
- Active toggle

**Acceptance criteria:**
- [ ] List shows all job postings for the employer account
- [ ] Create form validates title required
- [ ] Edit updates existing posting
- [ ] Active toggle updates `job_postings.is_active`
- [ ] Delete available with confirmation dialog
- [ ] Free tier limited to 1 job posting -- upgrade prompt at limit

### 5.3 Employer Dashboard -- Board Tab

Filtered view of the candidate pool attached to a specific job posting. Candidates shown in a list grouped by stage.

**Layout:**
- Job posting selector dropdown at top
- List of candidates grouped by stage: Saved / Screening / Interview / Offer / Passed
- Each candidate row shows: name, headline, assets available, date added, stage dropdown

**Stage assignment:**
- Dropdown on each candidate row
- Options: Saved / Screening / Interview / Offer / Passed
- Updates `saved_candidates.stage` on change
- Change confirmation toast

**Candidate notes:**
- Notes field on each candidate row (inline, auto-saves on blur)
- Notes are per employer account per candidate -- not shared with candidate

**Acceptance criteria:**
- [ ] Board shows candidates for selected job posting only
- [ ] Candidates grouped by stage
- [ ] Stage dropdown updates stage in database
- [ ] Notes field auto-saves
- [ ] Notes visible to all team members on the account
- [ ] Clicking candidate name opens their modal inline

### 5.4 Employer Dashboard -- Team Tab

Available on Growth and Scale tiers only.

**Team member list:**
- Table showing: name, email, role (owner/member), date added
- Invite team member button

**Invite flow:**
- Email input field
- Send invite button
- Invited user receives email (Clerk handles invite email)
- On sign-up, invited user is automatically added to the employer account as a member

**Acceptance criteria:**
- [ ] Team list shows all employer_members for the account
- [ ] Invite sends email via Clerk
- [ ] Invited users automatically added to account on sign-up
- [ ] Owner can remove members
- [ ] Owners cannot remove themselves
- [ ] Free and Starter tiers see locked state with upgrade CTA

### 5.5 Employer -- Sending Feedback

Employers can send feedback to candidates from two places:
- The candidate modal (Connect button)
- The candidate card in the pool (right-click or action menu)

**Feedback compose:**
- Text area (required, max 1000 characters)
- Send button
- Inserts row into `feedback` table
- Candidate sees it in their Feedback tab

**Acceptance criteria:**
- [ ] Compose accessible from modal and candidate card
- [ ] Text area has character counter
- [ ] Send creates feedback row
- [ ] Candidate sees feedback in their dashboard
- [ ] Employer sees confirmation toast on send

---

## 6. Database Schema

All tables with full column definitions and constraints.

```sql
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

-- Allow public read of published profiles (for /c/[slug] route)
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
CREATE POLICY employer_accounts_members ON employer_accounts
  FOR ALL TO authenticated
  USING (
    id IN (
      SELECT employer_account_id FROM employer_members
      WHERE clerk_user_id = requesting_user_id()
    )
  );

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
CREATE POLICY employer_members_same_account ON employer_members
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members
      WHERE clerk_user_id = requesting_user_id()
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

-- Saved candidates (the employer candidate pool)
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
-- Employers can insert and read their own feedback
CREATE POLICY feedback_employer ON feedback
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members
      WHERE clerk_user_id = requesting_user_id()
    )
  );
-- Candidates can read feedback sent to their profile
CREATE POLICY feedback_candidate_read ON feedback
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles
      WHERE clerk_user_id = requesting_user_id()
    )
  );
-- Candidates can mark feedback as read
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
-- Only the candidate can read their own view data
CREATE POLICY profile_views_candidate_read ON profile_views
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles
      WHERE clerk_user_id = requesting_user_id()
    )
  );
-- Anyone (including anon) can insert a view
CREATE POLICY profile_views_insert ON profile_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);
```

---

## 7. Paddle Integration

### 7.1 Subscription Tiers

Paddle products and prices are configured in the Paddle dashboard. Price IDs are stored in environment variables.

| Variable | Tier |
|---|---|
| `PADDLE_CANDIDATE_BASIC_PRICE_ID` | Candidate Basic $9/mo |
| `PADDLE_CANDIDATE_PRO_PRICE_ID` | Candidate Pro $19/mo |
| `PADDLE_EMPLOYER_STARTER_PRICE_ID` | Employer Starter $49/mo |
| `PADDLE_EMPLOYER_GROWTH_PRICE_ID` | Employer Growth $99/mo |
| `PADDLE_EMPLOYER_SCALE_PRICE_ID` | Employer Scale $249/mo |

### 7.2 Checkout Flow

- User clicks upgrade button
- Paddle Checkout overlay opens (Paddle.js)
- On success, Paddle fires `subscription.created` webhook
- Webhook handler updates `users.subscription_status` and `users.subscription_tier`

### 7.3 Webhook Handler

Located at `/api/webhooks/paddle`.

Events handled:
- `subscription.created` -- set status to `active`, set tier from price ID
- `subscription.updated` -- update tier (plan change)
- `subscription.cancelled` -- set status to `cancelled`
- `subscription.payment.failed` -- set status to `past_due`

Always verify Paddle webhook signature before processing. Use `PADDLE_WEBHOOK_SECRET`.

### 7.4 Free Tier Limits (enforced server-side)

| Resource | Free Limit | Checked in |
|---|---|---|
| Candidate assets | 1 | Asset upload Server Action |
| Employer saved candidates | 5 | Save candidate Server Action |
| Employer job postings | 1 | Create job posting Server Action |
| Employer team members | 0 (owner only) | Team invite Server Action |

---

## 8. Storage

### 8.1 Supabase Storage Buckets

All buckets are private. Assets are served via signed URLs with 1-hour TTL.

| Bucket | Max File Size | Accepted Types |
|---|---|---|
| `candidate-audio` | 50MB | audio/mpeg, audio/mp4, audio/wav |
| `candidate-video` | 500MB | video/mp4, video/quicktime, video/webm |
| `candidate-documents` | 25MB | application/pdf |
| `candidate-images` | 10MB | image/png, image/jpeg, image/webp |

File path pattern: `{clerk_user_id}/{timestamp}-{sanitized-filename}`

### 8.2 Signed URL Generation

Signed URLs are generated server-side in the Server Component that renders the modal. The modal client receives pre-signed URLs -- it never talks to Supabase Storage directly.

```typescript
// lib/storage/signed-urls.ts
export async function getSignedAssetUrl(bucket: string, path: string): Promise<string> {
  const supabase = await getRequestClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600); // 1 hour TTL
  if (error) throw error;
  return data.signedUrl;
}
```

---

## 9. Feature Flags by Tier

| Feature | Free | Basic | Pro | Starter | Growth | Scale |
|---|---|---|---|---|---|---|
| Hosted profile | ✓ | ✓ | ✓ | -- | -- | -- |
| 1 asset slot | ✓ | -- | -- | -- | -- | -- |
| All asset slots | -- | ✓ | ✓ | -- | -- | -- |
| View analytics | -- | ✓ | ✓ | -- | -- | -- |
| Feedback inbox | -- | -- | ✓ | -- | -- | -- |
| 5 saved candidates | -- | -- | -- | -- (note: free employer gets 5) | -- | -- |
| 50 saved candidates | -- | -- | -- | ✓ | -- | -- |
| Unlimited saved | -- | -- | -- | -- | ✓ | ✓ |
| 1 job posting | -- | -- | -- | -- (free gets 1) | -- | -- |
| 5 job postings | -- | -- | -- | ✓ | -- | -- |
| Unlimited postings | -- | -- | -- | -- | ✓ | ✓ |
| Team collaboration | -- | -- | -- | -- | ✓ | ✓ |
| Priority support | -- | -- | -- | -- | -- | ✓ |

---

## 10. Accessibility Requirements

All UI must meet WCAG 2.1 AA. This is non-negotiable and applies to every component.

- Minimum 44px touch targets on mobile
- Minimum 4.5:1 contrast ratio for normal text
- Minimum 3:1 for large text and UI components
- All interactive elements keyboard accessible
- All images have meaningful alt text or `aria-hidden="true"` for decorative images
- Focus indicators visible on all focusable elements
- Focus trapped inside modal while open
- ESC closes modal and returns focus to trigger
- All form inputs have associated `<label>` elements
- Error messages programmatically associated with inputs via `aria-describedby`
- No information conveyed by color alone

---

## 11. Build Phases

### Phase 0 -- Foundation (Week 1-2)
- [ ] Initialize Next.js project with TypeScript and Tailwind
- [ ] Configure Clerk
- [ ] Configure Supabase with Clerk third-party auth
- [ ] Run database migrations (all tables from Section 6)
- [ ] Create Supabase Storage buckets
- [ ] Set up Vercel deployment under `builtwithrobots`
- [ ] Configure environment variables in Vercel

### Phase 1 -- Candidate Side (Week 2-4)
- [ ] Sign up / sign in pages
- [ ] Onboarding -- role selection
- [ ] Candidate onboarding flow (3 steps)
- [ ] Candidate dashboard layout and navigation
- [ ] Profile editor (Section 3.1)
- [ ] Asset upload (Section 3.2)
- [ ] Public modal at `/c/[slug]` (Section 4)
- [ ] View tracking

### Phase 2 -- Employer Side (Week 4-7)
- [ ] Employer onboarding flow (2 steps)
- [ ] Employer dashboard layout and navigation
- [ ] Candidate pool -- Candidates tab (Section 5.1)
- [ ] Save candidate from modal
- [ ] Job postings -- Jobs tab (Section 5.2)
- [ ] Candidate board -- Board tab (Section 5.3)
- [ ] Stage assignment
- [ ] Candidate notes
- [ ] Feedback compose and send (Section 5.5)

### Phase 3 -- Collaboration and Polish (Week 7-10)
- [ ] Team member invites -- Team tab (Section 5.4)
- [ ] Candidate analytics tab (Section 3.4)
- [ ] Feedback inbox for candidates (Section 3.5)
- [ ] Profile preview tab (Section 3.3)
- [ ] Mobile responsive audit
- [ ] WCAG 2.1 AA full audit
- [ ] Error states and empty states for all screens
- [ ] Loading states and skeleton screens

### Phase 4 -- Payments (Week 10-12)
- [ ] Paddle JS integration
- [ ] Upgrade prompts at free tier limits
- [ ] Checkout flow
- [ ] Paddle webhook handler (Section 7.3)
- [ ] Subscription status gates on features
- [ ] Billing management (Paddle customer portal link)

---

## 12. Out of Scope for MVP

Do not build these. Push back if asked.

- AI generation on the platform (NotebookLM does the generation -- [APPNAME] is hosting and delivery)
- Drag and drop Kanban board (dropdown stage assignment in MVP)
- Employer candidate browse/search directory (employers save via shared links only)
- Resume parsing or ATS keyword optimization
- Video or audio recording in browser
- Real-time notifications (polling or manual refresh only)
- Native mobile app
- Social features, endorsements, or recommendations
- Integration with external ATS systems (Workday, Greenhouse, Lever)
- Advanced analytics beyond view counts and engagement duration
- Email newsletter or marketing automation
