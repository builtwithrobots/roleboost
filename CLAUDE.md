# CLAUDE.md — RoleBoost

> This file is the project memory for Claude Code. Read it at the start of every session.
> Last updated: June 2026

---

## What This Project Is

RoleBoost is a two-sided candidate narrative platform. Job seekers upload their resume and context, the platform generates an elite AI prompt, and they use Google NotebookLM to produce a suite of professional career assets -- audio narrative, video overview, slide deck, career infographic, and ATS resume. Those assets are hosted on a shareable candidate profile page that opens as a pop-up modal when clicked. Employers get a candidate management dashboard with job postings, stage tracking, team collaboration, and a feedback loop back to candidates.

**The one-line pitch:** "When everyone sounds the same on paper -- be heard."

**Independent codebase.** Standalone project under the `builtwithrobots` GitHub organization. No shared infrastructure with any other project.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router (TypeScript, strict mode) |
| Styling | Tailwind CSS |
| Auth | Clerk (single sign-up flow, role declared in onboarding) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (audio, video, documents, images) |
| Payments | Paddle (candidate and employer subscription tiers) |
| Deployment | Vercel (auto-deploy from GitHub, `builtwithrobots` org) |
| Validation | Zod (schema validation at every server entry point) |

---

## Commands

Claude runs these to verify its own work. All are safe to run in any session.

| Command | Purpose |
|---|---|
| `npm run build` | Production build. Run to confirm a change does not break the build. |
| `npm run lint` | ESLint via `next lint`. |
| `npx tsc --noEmit` | Typecheck. Run this after every non-trivial TypeScript change. |

After a command fails, fix the underlying issue before moving on. Do not suppress type errors with `@ts-ignore` or `any` -- ask for clarification instead.

---

## Project Structure

```
roleboost/
├── app/
│   ├── (auth)/                  # Clerk auth pages (sign-in, sign-up, onboarding)
│   ├── (candidate)/             # Candidate-facing pages
│   │   └── dashboard/
│   │       ├── profile/         # Build and manage profile
│   │       ├── assets/          # Upload and manage career assets
│   │       ├── preview/         # Preview modal as employers see it
│   │       ├── analytics/       # Profile view counts, engagement data
│   │       └── feedback/        # Employer feedback received
│   ├── (employer)/              # Employer-facing pages
│   │   └── dashboard/
│   │       ├── candidates/      # Saved candidate pool
│   │       ├── jobs/            # Job postings management
│   │       ├── board/           # Candidate board with stage assignment
│   │       └── team/            # Team member management
│   ├── c/[slug]/                # Public candidate profile page (modal experience)
│   └── api/
│       ├── candidates/
│       ├── employers/
│       ├── assets/
│       ├── jobs/
│       ├── feedback/
│       └── webhooks/            # Paddle webhook handler
├── lib/
│   ├── auth/                    # Clerk helpers, role and user context
│   ├── supabase/                # Supabase clients (server, admin, browser)
│   ├── storage/                 # Supabase Storage upload helpers
│   └── types/                   # Shared TypeScript types
├── components/
│   ├── modal/                   # Candidate profile pop-up modal
│   ├── candidate/               # Candidate dashboard UI components
│   ├── employer/                # Employer dashboard UI components
│   └── ui/                      # Shared UI primitives
└── middleware.ts                 # Clerk middleware -- role-based route protection
```

---

## Key Architectural Decisions

### Single Sign-Up Flow, Two Experiences

There is one Clerk auth flow for all users. Role is declared during onboarding -- `candidate` or `employer`. After onboarding, routing diverges:

- Candidates land on `/dashboard/profile`
- Employers land on `/dashboard/candidates`

Role is stored in Supabase `users.role` -- never in Clerk metadata. Always look up role from Supabase on the server. Never trust client-side role claims.

### user_id = Clerk userId (TEXT)

Clerk is used for authentication only. All user data, roles, and relationships live in Supabase keyed by `clerk_user_id TEXT`. There are no Clerk Organizations. Multi-tenancy on the employer side is handled via the `employer_accounts` table.

### Supabase Clients -- Three Clients, One Purpose Each

- **`lib/supabase/server.ts`** -- request-scoped authenticated client. Exports `getRequestClient()`. Forwards the Clerk JWT as Bearer token. RLS enforced. Use in every API route, Server Action, and Server Component.
- **`lib/supabase/admin.ts`** -- service-role client. Bypasses RLS. Server-only. Reserved for migrations and webhooks only. Every import must have a comment explaining why RLS bypass is required.
- **`lib/supabase/browser.ts`** -- anon client for `"use client"` components. RLS enforced via anon role.

Hard rules:
- `SUPABASE_SERVICE_ROLE_KEY` is only read inside `lib/supabase/admin.ts`. Never import it from client code.
- Never import `lib/supabase/admin` from a file that could end up in the browser bundle.
- Default to `getRequestClient()` -- reach for admin only when RLS bypass is explicitly required.

### Row Level Security (RLS)

RLS is enabled on every user-scoped table from day one. A missed `.eq()` filter would silently leak data without RLS -- this makes that impossible.

Pattern:

```sql
CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT auth.jwt() ->> 'sub';
$$;

ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY candidate_profiles_user_isolation ON candidate_profiles
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());
```

Rules:
- Every new user-scoped table ships with `ENABLE ROW LEVEL SECURITY` and an isolation policy in the same migration that creates the table.
- Server queries still include `.eq('clerk_user_id', userId)` as defense in depth and for index performance.
- The admin client bypasses RLS -- treat every usage as security-review-worthy.

### Employer Accounts and Team Members

Employers operate in accounts. One employer creates an account and can invite team members. All saved candidates, job postings, and board data are scoped to the `employer_account_id`, not the individual user.

```sql
CREATE TABLE employer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  created_by TEXT NOT NULL, -- clerk_user_id of account creator
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_account_id, clerk_user_id)
);
```

### Candidate Profile Slugs

Every candidate gets a unique public URL: `/c/[slug]`. Slug is generated from their name on profile creation and stored in `candidate_profiles.slug`. Must be unique across the platform. If the slug is taken, append a short random suffix.

The `/c/[slug]` route is **public** -- no Clerk session required to view a candidate profile. This is the shareable link candidates put in their email signatures, LinkedIn profiles, and job applications.

### Asset Storage

Supabase Storage buckets:

| Bucket | Access | Contents | Path Pattern |
|---|---|---|---|
| `candidate-audio` | Private (signed URL) | Audio overview files | `{clerk_user_id}/{filename}` |
| `candidate-video` | Private (signed URL) | Video overview files | `{clerk_user_id}/{filename}` |
| `candidate-documents` | Private (signed URL) | Slide decks, ATS resumes (PDF) | `{clerk_user_id}/{filename}` |
| `candidate-images` | Private (signed URL) | Career infographics | `{clerk_user_id}/{filename}` |

Signed URL TTL: 1 hour. Regenerated on every profile modal load. Never store assets in a public bucket.

The public `/c/[slug]` route generates fresh signed URLs server-side on every load. The modal client receives pre-signed URLs -- it never calls Supabase Storage directly.

### Data Fetching -- RSC + Server Actions, API Routes Only for External Callers

- **Reads** -- Server Components call Supabase directly via `getRequestClient()`. No API round-trip.
- **Mutations** -- Server Actions (`"use server"`). Zod-validate input first, run the write, call `revalidatePath` before returning.
- **`/api` routes** -- reserved for: Paddle webhook handler, external integrations, and any caller without a Clerk session.

### Default to Server Components

Every `.tsx` in `app/` is a Server Component unless it explicitly opts out with `"use client"`. Opt in only when required: React hooks, browser APIs, interactive DOM event handlers, or third-party components that need them. Push the interactive subtree into a small `*Client.tsx` child and keep the parent on the server.

### Candidate Profile Modal

The modal is the core employer-facing experience. It is a React component rendered at `/c/[slug]` and also embedded inline inside the employer dashboard. Key rules:

- Modal opens without page navigation -- it overlays whatever the employer is looking at
- Tabs: Audio | Video | Deck | Infographic | Resume
- Each tab loads its asset lazily -- do not preload all assets on open
- Connect button triggers a direct message or email to the candidate
- Save button adds candidate to the employer's pool (requires employer session)
- Modal must be fully keyboard navigable and screen-reader accessible
- Focus must be trapped inside the modal while open
- ESC key closes the modal and returns focus to the trigger element

### Employer Candidate Board

The board is a filtered view of the employer's saved candidate pool, scoped to a specific job posting. Candidates are assigned to stages via a dropdown (MVP). Stages are fixed:

`Saved → Screening → Interview → Offer → Passed`

Do not build drag and drop in MVP. Stage assignment is a dropdown on each candidate card.

### Paddle Payments

Paddle handles all billing. Candidate and employer tiers are separate product/price IDs in Paddle.

| Tier | Side | Price | Paddle Product |
|---|---|---|---|
| Basic | Candidate | $9/mo | `PADDLE_CANDIDATE_BASIC_PRICE_ID` |
| Pro | Candidate | $19/mo | `PADDLE_CANDIDATE_PRO_PRICE_ID` |
| Starter | Employer | $49/mo | `PADDLE_EMPLOYER_STARTER_PRICE_ID` |
| Growth | Employer | $99/mo | `PADDLE_EMPLOYER_GROWTH_PRICE_ID` |
| Scale | Employer | $249/mo | `PADDLE_EMPLOYER_SCALE_PRICE_ID` |

Paddle webhooks update `users.paddle_subscription_id` and `users.subscription_status` in Supabase. The webhook handler lives at `/api/webhooks/paddle`. Always verify the Paddle webhook signature before processing.

Free tier limits enforced server-side:
- Candidate free: 1 asset slot, no analytics, no feedback
- Employer free: 5 saved candidates, 1 job posting, no team members

---

## Database Schema

All migrations live in `supabase/migrations/`. Never edit the database manually -- always use migrations.

### Core Tables

```sql
-- All users (candidates and employers share this table)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL, -- 'candidate' | 'employer'
  email TEXT NOT NULL,
  paddle_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'free', -- 'free' | 'active' | 'cancelled' | 'past_due'
  subscription_tier TEXT, -- 'basic' | 'pro' | 'starter' | 'growth' | 'scale'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate profiles (one per candidate user)
CREATE TABLE candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE REFERENCES users(clerk_user_id),
  slug TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  headline TEXT, -- e.g. "Director of Operations | 20+ years warehouse leadership"
  target_role TEXT,
  location TEXT,
  summary_bullets TEXT[], -- AI-generated or manually entered bullet points
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Career assets uploaded by candidates
CREATE TABLE candidate_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- 'audio' | 'video' | 'deck' | 'infographic' | 'resume'
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  duration_seconds INTEGER, -- audio/video only
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employer accounts (team-level entity)
CREATE TABLE employer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  industry TEXT,
  created_by TEXT NOT NULL, -- clerk_user_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employer team members
CREATE TABLE employer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id),
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_account_id, clerk_user_id)
);

-- Job postings created by employers
CREATE TABLE job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidates saved by employers (the candidate pool)
CREATE TABLE saved_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE CASCADE,
  candidate_profile_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_posting_id UUID REFERENCES job_postings(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'saved', -- 'saved' | 'screening' | 'interview' | 'offer' | 'passed'
  notes TEXT,
  saved_by TEXT NOT NULL, -- clerk_user_id of team member who saved
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_account_id, candidate_profile_id)
);

-- Feedback sent from employers to candidates
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE CASCADE,
  candidate_profile_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  sent_by TEXT NOT NULL, -- clerk_user_id
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile view analytics
CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  viewer_clerk_user_id TEXT, -- NULL for anonymous views
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER -- how long they engaged
);
```

---

## User Roles

| Role | Who | Access |
|---|---|---|
| `candidate` | Job seeker | Own profile, own assets, own analytics, received feedback |
| `employer_owner` | Created the employer account | Full employer dashboard, team management, billing |
| `employer_member` | Invited team member | Candidate pool, job board, feedback -- no billing |

Role is stored in `users.role` as either `candidate` or `employer`. Employer sub-role (owner vs member) is stored in `employer_members.role`.

---

## Server Code Patterns

Every Server Action and API route follows this spine:

1. Resolve user context via `getUserContext()` -- throws typed errors on auth failure
2. Validate input with Zod before any Supabase call
3. Run the query -- RLS enforces data isolation
4. Return typed data or the standard error envelope

### `lib/auth/user-context.ts`

```typescript
import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { getRequestClient } from '@/lib/supabase/server';

export type UserRole = 'candidate' | 'employer';

export class AuthError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'NO_USER' | 'FORBIDDEN') {
    super(code);
  }
}

export async function getUserContext(requiredRole?: UserRole) {
  const { userId } = await auth();
  if (!userId) throw new AuthError('UNAUTHENTICATED');

  const supabase = await getRequestClient();
  const { data: user } = await supabase
    .from('users')
    .select('role, subscription_tier, subscription_status')
    .eq('clerk_user_id', userId)
    .single();

  if (!user) throw new AuthError('NO_USER');
  if (requiredRole && user.role !== requiredRole) throw new AuthError('FORBIDDEN');

  return { userId, supabase, role: user.role as UserRole, user };
}
```

### Server Action Pattern

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

const UpdateProfileInput = z.object({
  headline: z.string().min(1).max(200),
  target_role: z.string().min(1).max(100),
  location: z.string().min(1).max(100),
});

export async function updateCandidateProfile(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const parsed = UpdateProfileInput.parse(input);

    const { error } = await supabase
      .from('candidate_profiles')
      .update({ ...parsed, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };

    revalidatePath('/dashboard/profile');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
```

### Error Envelope

Every failed response uses this exact shape:

```typescript
{ error: { code: string, message?: string, details?: unknown } }
```

| Situation | HTTP | Code |
|---|---|---|
| Zod parse failure | 400 | `INVALID_INPUT` |
| No Clerk session | 401 | `UNAUTHENTICATED` |
| Clerk session but no user row | 403 | `NO_USER` |
| Wrong role | 403 | `FORBIDDEN` |
| Row not found | 404 | `NOT_FOUND` |
| Supabase error | 500 | `INTERNAL` |

---

## Accessibility Requirements

All UI must meet WCAG 2.1 AA from the start. Non-negotiable.

- Minimum 44px touch targets on mobile
- Minimum 4.5:1 color contrast ratio for normal text
- Minimum 3:1 for large text and UI components
- All interactive elements keyboard accessible
- All images have meaningful alt text
- Focus indicators visible on all focusable elements
- Focus trapped inside modal while open
- ESC key closes modal and returns focus to trigger
- No reliance on color alone to convey information

---

## Development Workflow

**Branching and PRs**

- One branch per task, named `claude/<task-slug>`
- Every change lands via a GitHub PR opened as draft
- Ready for review only once typecheck and lint pass and the preview URL works
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Squash-merge to `main`. Delete branch on merge.
- Never force-push to `main`

**Deploy and verify**

- Vercel auto-deploys `main` to production and every branch to a preview URL under the `builtwithrobots` account
- Primary dev surface is the Vercel preview URL on the PR
- Before marking a task complete, run `npx tsc --noEmit` after any TypeScript change and verify the preview URL for any user-facing change

---

## Environment Variables Required

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Paddle
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
PADDLE_CANDIDATE_BASIC_PRICE_ID=
PADDLE_CANDIDATE_PRO_PRICE_ID=
PADDLE_EMPLOYER_STARTER_PRICE_ID=
PADDLE_EMPLOYER_GROWTH_PRICE_ID=
PADDLE_EMPLOYER_SCALE_PRICE_ID=

# App
NEXT_PUBLIC_APP_URL=
```

---

## What Not to Build in MVP

Push back if anyone asks for these during MVP:

- AI generation on the platform -- NotebookLM is the generation tool, the platform is hosting and delivery
- Drag and drop Kanban board -- stage assignment is a dropdown in MVP
- Employer candidate search or browse directory -- employers save via shared links only in MVP
- Resume parsing or ATS keyword optimization -- not this product
- Video recording in browser -- candidates upload pre-produced files only
- Real-time notifications -- polling or manual refresh in MVP
- Mobile app -- responsive web only
- Social features, endorsements, or recommendations
- Advanced analytics beyond view counts and engagement duration
- Integration with external ATS systems

These are Phase 2. Scope creep kills MVPs.

---

## Current Build Status

**Phase:** Pre-development. Vision, PRD, and CLAUDE.md complete. Ready to scaffold.

**Next steps:**
1. Initialize Next.js project with TypeScript, Tailwind, Clerk, Supabase
2. Build database schema and run migrations
3. Build auth flow with role-based onboarding
4. Build candidate profile and asset upload
5. Build public modal at `/c/[slug]`
6. Build employer dashboard and candidate pool
7. Build job postings and board
8. Build feedback loop
9. Integrate Paddle payments
