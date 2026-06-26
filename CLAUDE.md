# CLAUDE.md — RoleBoost

> This file is the project memory for Claude Code. Read it at the start of every session.
> Last updated: June 2026

---

## What This Project Is

RoleBoost is the world's first AI-powered candidate intelligence platform. Job seekers upload their resume and career context, receive a complete multi-format career narrative produced via Google NotebookLM, get a personal career AI chatbot trained on their career data, and share one link that gives hiring managers everything they need -- audio, video, infographic, slide deck, ATS resume, and a live AI they can interrogate 24/7. Every AI conversation generates a transcript delivered by email to both sides. Candidates fine-tune their AI over time based on what recruiters actually ask.

**The one-line pitch:** "Your career. Your AI. Finally heard."

**Domain:** getroleboost.com (brand name: RoleBoost) **GitHub org:** builtwithrobots **Independent codebase.** No shared infrastructure with any other project.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router (TypeScript, strict mode) |
| Styling | Tailwind CSS |
| Auth | Clerk (single sign-up, role declared in onboarding) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (audio, video, documents, images) |
| AI Chatbot | Anthropic Claude API (claude-haiku-4-5-20251001 for chat, claude-sonnet-4-6 for prompt generation) |
| Email | Resend (transcript delivery to candidates and employers) |
| Payments | Paddle (employer subscription tiers only -- candidates always free) |
| Deployment | Vercel (auto-deploy from GitHub, `builtwithrobots` org) |
| Validation | Zod (schema validation at every server entry point) |

---

## Commands

Claude runs these to verify its own work. All are safe to run in any session.

| Command | Purpose |
|---|---|
| `npm run build` | Production build -- run after every non-trivial change. |
| `npm run lint` | ESLint via `next lint`. |
| `npx tsc --noEmit` | Typecheck -- run after every TypeScript change. |

After a command fails, fix the underlying issue before moving on. Never suppress type errors with `@ts-ignore` or `any` -- ask for clarification instead.

---

## Project Structure

```
roleboost/
├── app/
│   ├── (auth)/                  # Clerk auth pages
│   ├── (candidate)/             # Candidate dashboard
│   │   └── dashboard/
│   │       ├── profile/         # Profile builder and asset management
│   │       ├── assets/          # Upload and manage career assets
│   │       ├── ai/              # AI chatbot fine-tuning interface
│   │       ├── transcripts/     # All recruiter conversation transcripts
│   │       ├── analytics/       # Profile view and engagement data
│   │       └── preview/         # Preview modal as employers see it
│   ├── (employer)/              # Employer dashboard
│   │   └── dashboard/
│   │       ├── candidates/      # Saved candidate pool
│   │       ├── jobs/            # Job postings management
│   │       ├── board/           # Candidate board with stage assignment
│   │       ├── transcripts/     # Saved AI chat transcripts
│   │       └── team/            # Team member management
│   ├── c/[slug]/                # Public candidate profile -- modal experience
│   └── api/
│       ├── chat/                # AI chatbot endpoint
│       ├── transcripts/         # Transcript storage and email delivery
│       ├── candidates/
│       ├── employers/
│       ├── assets/
│       ├── jobs/
│       ├── feedback/
│       └── webhooks/
│           └── paddle/
├── lib/
│   ├── auth/                    # getUserContext(), AuthError
│   ├── supabase/                # server.ts, admin.ts, browser.ts
│   ├── storage/                 # Signed URL generation helpers
│   ├── ai/                      # Claude API chat handler, prompt builder
│   ├── email/                   # Resend email helpers, transcript templates
│   └── types/                   # Shared TypeScript types
├── components/
│   ├── modal/                   # Candidate profile pop-up modal
│   ├── chat/                    # AI chat interface components
│   ├── candidate/               # Candidate dashboard UI components
│   ├── employer/                # Employer dashboard UI components
│   └── ui/                      # Shared UI primitives
└── supabase/
    └── migrations/              # All database migrations
```

---

## Key Architectural Decisions

### Single Sign-Up Flow, Two Experiences

One Clerk auth flow. Role declared in onboarding. After onboarding routing diverges:

- Candidates land on `/dashboard/profile`
- Employers land on `/dashboard/candidates`

Role stored in Supabase `users.role` -- never in Clerk metadata. Always look up role from Supabase on the server. Never trust client-side role claims.

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

```sql
CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT auth.jwt() ->> 'sub';
$$;
```

Rules:
- Every new user-scoped table ships with `ENABLE ROW LEVEL SECURITY` and an isolation policy in the same migration that creates the table.
- Server queries still include `.eq('clerk_user_id', userId)` as defense in depth and for index performance.
- The admin client bypasses RLS -- treat every usage as security-review-worthy.

### AI Chatbot Architecture

The candidate career AI is a Claude API call with a layered, XML-structured system prompt. No fine-tuning, no embeddings, no vector database needed for MVP. Resume text is sourced from `resume_documents.canonical_markdown` and passed to the builder as a separate argument -- there is no `resume_text` column on `candidate_profiles`.

**Prompt structure (`lib/ai/build-system-prompt.ts`) -- data near the top, rules near the bottom:**

1. `<role>` -- Identity assignment. First-person framing. Not a FAQ bot.
2. `<career_information>` -- Full resume markdown.
3. `<context>` -- The named career-context fields.
4. `<custom_answers priority="highest">` -- Candidate-refined QA pairs. Highest priority.
5. `<few_shot_examples>` -- 2 to 3 worked hard-question exemplars built from custom QA.
6. `<knowledge_boundary>` -- Explicit known / not_known / when_not_known blocks.
7. `<principles>` -- Three constitutional values: honesty, calm confidence, human warmth.
8. `<adversarial_posture>` -- Pattern for handling skeptical or pressure-testing questions.
9. `<redirect_topics>` -- Topics that go to a direct conversation, not the AI.
10. `<voice>` -- Tone instruction derived from the candidate's own writing.
11. `<reasoning_instruction>` -- Explicit guidance for synthesis and numeric grounding.

**Complexity router (`app/api/chat/route.ts`):**
- Simple factual questions: `claude-haiku-4-5-20251001` (fast, cheap).
- Multi-part, adversarial, or synthesis questions: `claude-sonnet-4-6` (better reasoning).
- Detection is a fast string heuristic (`detectComplexQuestion`) -- no API call. Model ids come from `lib/ai/models.ts` (`CHAT_MODEL` / `GENERATION_MODEL`); never hardcode them.

**Post-generation validation:**
- Runs only when the answer contains numbers, dollar figures, percentages, or credential claims (`detectHighRiskContent`).
- A fast Sonnet call (`validateAndSanitize`) checks that every such claim traces to the candidate's career data.
- If not grounded: the answer is replaced with a safe, natural deflection.
- If the validation call fails for any reason: the original answer is returned (fail-safe).

**Per-turn tracking:** each assistant `chat_messages` row records `model_used`, `was_complex`, and `was_validated` for analytics.

**Cost estimate:**
- Simple turns (Haiku, no validation): ~$0.0008 per session.
- Complex turns (Sonnet): ~$0.003 per turn -- estimate 2 to 3 complex turns per session.
- Validation pass (Sonnet, 200 tokens, only on high-risk answers): ~$0.001 per validated turn.
- Blended estimate for a 10-turn session with 2 complex + 1 validated turn: ~$0.01 per session.

### Transcript Delivery

Every AI chat session generates a transcript delivered by email to both sides when the modal closes or after 30 minutes of inactivity.

**Trigger:** Modal close event or inactivity timeout fires `POST /api/transcripts/deliver`

**Candidate email:** Full transcript of all questions and answers, company name if employer is logged in, pattern insights if 3+ questions on same topic, link to fine-tune AI.

**Employer email:** Full transcript, link to candidate profile, save candidate CTA, send feedback CTA.

Use Resend for all email delivery. Templates live in `lib/email/templates/`.

### Candidate AI Fine-Tuning

Candidates refine their AI through the dashboard at `/dashboard/ai`:

- See questions asked most frequently this week
- See how their AI answered each one
- Edit specific answers -- stored as `custom_qa_pairs` JSONB in `candidate_profiles`
- Toggle privacy settings -- which topics redirect to direct conversation
- Test mode -- ask their own AI questions in a sandbox

Custom QA pairs are injected into the system prompt above base career data, giving them priority over resume-derived answers.

### Asset Storage

All buckets private. Assets served via signed URLs with 1-hour TTL.

| Bucket | Contents |
|---|---|
| `candidate-audio` | Audio overview and debate audio files |
| `candidate-video` | Video overview files |
| `candidate-documents` | Slide decks and ATS resumes (PDF) |
| `candidate-images` | Career infographics |

File path pattern: `{clerk_user_id}/{timestamp}-{sanitized-filename}`

Signed URLs generated server-side on every modal load. Modal client receives pre-signed URLs -- never calls Supabase Storage directly.

### Email Delivery -- Resend

All transactional email goes through Resend. Two critical email types:

1. **Transcript emails** -- triggered after every AI chat session
2. **Feedback emails** -- triggered when employer sends feedback to candidate

Both use React Email templates in `lib/email/templates/`. Never send email from client components -- always server-side via Server Actions or API routes.

```typescript
// lib/email/send-transcript.ts
import 'server-only';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTranscriptEmails(session: ChatSession, messages: ChatMessage[]) {
  await resend.emails.send({
    from: 'RoleBoost <transcripts@getroleboost.com>',
    to: session.candidateEmail,
    subject: `A recruiter just chatted with your RoleBoost AI`,
    react: CandidateTranscriptEmail({ session, messages })
  });

  if (session.employerEmail) {
    await resend.emails.send({
      from: 'RoleBoost <transcripts@getroleboost.com>',
      to: session.employerEmail,
      subject: `Your RoleBoost conversation with ${session.candidateName}`,
      react: EmployerTranscriptEmail({ session, messages })
    });
  }
}
```

### Data Fetching -- RSC + Server Actions

- **Reads** -- Server Components call Supabase via `getRequestClient()`. No API round-trip.
- **Mutations** -- Server Actions (`"use server"`). Zod-validate first, write, `revalidatePath`.
- **`/api` routes** -- reserved for: Paddle webhook handler, AI chat endpoint (`/api/chat`), transcript delivery (`/api/transcripts/deliver`), and any caller without a Clerk session.

### Default to Server Components

Every `.tsx` in `app/` is a Server Component unless it explicitly opts out with `"use client"`. The chat interface is the primary client component -- it needs real-time state for the conversation. Push all other interactive subtrees into small `*Client.tsx` children.

### Candidate Profile Modal

The core employer-facing experience. Rendered at `/c/[slug]` and inline inside the employer dashboard.

Key rules:
- Modal opens without page navigation
- Tabs: Audio | Debate | Video | Deck | Infographic | Resume | Chat
- Chat tab opens the AI conversation interface
- Each tab loads its asset lazily -- do not preload all assets on open
- Focus trapped while open
- ESC closes modal and returns focus to trigger element
- Fully keyboard navigable
- WCAG 2.1 AA compliant

### Employer Candidate Board

Filtered view of saved candidate pool scoped to a job posting. Stage assignment via dropdown in MVP -- no drag and drop.

Stages: `Saved → Screening → Interview → Offer → Passed`

### Paddle Payments

Candidate tier is always free. Paddle handles employer billing only.

| Variable | Tier |
|---|---|
| `PADDLE_EMPLOYER_STARTER_PRICE_ID` | Employer Starter $49/mo |
| `PADDLE_EMPLOYER_GROWTH_PRICE_ID` | Employer Growth $99/mo |
| `PADDLE_EMPLOYER_SCALE_PRICE_ID` | Employer Scale $249/mo |

Webhook handler at `/api/webhooks/paddle`. Always verify Paddle webhook signature before processing.

---

## Claude API Usage

Two models. Two purposes. Never swap them.

| Model | Use | Why |
|---|---|---|
| `claude-haiku-4-5-20251001` | AI chatbot responses | Fast, cheap, perfect for conversational chat |
| `claude-sonnet-4-6` | Prompt generation, bullet summary generation | Higher quality for one-time generation tasks |

Always import the Anthropic SDK from a server-only file. Never expose the API key to the client.

```typescript
// lib/ai/client.ts
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});
```

---

## Database Schema

All migrations live in `supabase/migrations/`. Never edit the database manually -- always use migrations.

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('candidate', 'employer')),
  email TEXT NOT NULL,
  paddle_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'cancelled', 'past_due')),
  subscription_tier TEXT
    CHECK (subscription_tier IN ('pro', 'starter', 'growth', 'scale')),
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
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  full_name TEXT NOT NULL,
  headline TEXT CHECK (char_length(headline) <= 200),
  target_role TEXT,
  location TEXT,
  linkedin_url TEXT,
  resume_text TEXT,
  summary_bullets TEXT[] DEFAULT '{}',
  -- AI context fields
  leadership_philosophy TEXT,
  key_wins TEXT,
  departure_reasons TEXT,
  biggest_challenge TEXT,
  ideal_environment TEXT,
  manager_needs TEXT,
  honest_weaknesses TEXT,
  wish_questions TEXT,
  custom_qa_pairs JSONB DEFAULT '[]',
  redirect_topics TEXT[] DEFAULT '{}',
  ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Profile settings
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
    CHECK (asset_type IN ('audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume')),
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

-- AI chat sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  viewer_clerk_user_id TEXT REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE SET NULL,
  employer_company_name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  transcript_sent BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_sessions_candidate_read ON chat_sessions
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE POLICY chat_sessions_employer_read ON chat_sessions
  FOR SELECT TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE POLICY chat_sessions_insert ON chat_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

-- AI chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_session_access ON chat_messages
  FOR ALL TO anon, authenticated
  USING (
    chat_session_id IN (
      SELECT id FROM chat_sessions
      WHERE
        candidate_profile_id IN (
          SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
        )
        OR employer_account_id IN (
          SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
        )
    )
  );

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
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Employer team members
CREATE TABLE employer_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_account_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by TEXT REFERENCES users(clerk_user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employer_account_id, clerk_user_id)
);

ALTER TABLE employer_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY employer_members_same_account ON employer_members
  FOR ALL TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
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
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Saved candidates
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
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Feedback
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
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE POLICY feedback_candidate_read ON feedback
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE POLICY feedback_candidate_update ON feedback
  FOR UPDATE TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  )
  WITH CHECK (TRUE);

-- Profile views
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
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE POLICY profile_views_insert ON profile_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);
```

---

## User Roles

| Role | Who | Access |
|---|---|---|
| `candidate` | Job seeker | Own profile, own assets, own analytics, received feedback, transcripts |
| `employer_owner` | Created the employer account | Full employer dashboard, team management, billing |
| `employer_member` | Invited team member | Candidate pool, job board, feedback, transcripts -- no billing |

Role stored in `users.role` as `candidate` or `employer`. Employer sub-role (owner vs member) stored in `employer_members.role`.

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
| Supabase or API error | 500 | `INTERNAL` |

---

## Accessibility Requirements

All UI must meet WCAG 2.1 AA. Non-negotiable.

- Minimum 44px touch targets on mobile
- Minimum 4.5:1 color contrast ratio for normal text
- All interactive elements keyboard accessible
- All images have meaningful alt text
- Focus trapped inside modal while open
- ESC closes modal and returns focus to trigger
- Chat interface fully keyboard navigable
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

# Anthropic
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=

# Paddle
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
PADDLE_EMPLOYER_STARTER_PRICE_ID=
PADDLE_EMPLOYER_GROWTH_PRICE_ID=
PADDLE_EMPLOYER_SCALE_PRICE_ID=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Build Phases

### Phase 0 -- Foundation (Week 1-2)

- Initialize Next.js with TypeScript and Tailwind
- Configure Clerk
- Configure Supabase with Clerk third-party auth
- Run all database migrations
- Create Supabase Storage buckets
- Configure Resend domain and sending address
- Set up Vercel under `builtwithrobots`
- Configure all environment variables

### Phase 1 -- Candidate Profiles and Modal (Week 2-4)

- Onboarding -- role selection
- Candidate onboarding -- 3 steps
- Candidate dashboard layout and navigation
- Profile editor
- Asset upload (audio, debate audio, video, deck, infographic, resume)
- Public modal at `/c/[slug]` (without chat tab)
- View tracking
- QR code generation
- Badge download

### Phase 2 -- Employer Dashboard (Week 4-7)

- Employer onboarding -- 2 steps
- Employer dashboard layout
- Candidates tab -- saved pool
- Save candidate from modal
- Jobs tab
- Board tab with stage assignment
- Notes
- Feedback compose, send, and email notification

### Phase 3 -- AI Chatbot and Transcripts (Week 7-10)

- Candidate context form -- deep career questions
- System prompt builder (`lib/ai/build-system-prompt.ts`)
- Claude Haiku chat endpoint (`/api/chat`)
- Chat UI in modal (Chat tab)
- Chat session and message logging
- Candidate AI tab -- fine-tuning interface
- Custom QA pairs
- Privacy controls -- redirect topics and `ai_enabled` toggle
- Testing sandbox -- candidate tests their own AI
- Transcript delivery endpoint (`/api/transcripts/deliver`)
- Candidate and employer transcript email templates
- Transcripts tab for candidates and employers
- Pattern recognition -- most asked questions

### Phase 4 -- Payments and Polish (Week 10-12)

- Paddle JS integration
- Employer upgrade prompts at free tier limits
- Checkout flow
- Paddle webhook handler
- Subscription status gates on features
- Billing management via Paddle customer portal
- Error states and empty states for all screens
- Loading and skeleton screens
- Candidate Pro upgrade flow
- Analytics tab

---

## What Not to Build in MVP

Push back if asked for these:

- AI asset generation on platform -- NotebookLM is the production engine
- Drag and drop Kanban -- dropdown stage assignment only
- Employer candidate browse directory -- save via shared links only
- Resume parsing or ATS keyword optimization
- Video or audio recording in browser
- Real-time chat notifications -- email transcripts are the delivery mechanism
- Voice cloning for the AI chatbot
- Multi-language support
- Native mobile app
- Social features or endorsements
- External ATS integrations (Workday, Greenhouse, Lever)
- Advanced AI model selection for chatbot

---

## Current Build Status

> Durable cross-session handoff, updated June 2026. The in-session task list (`TaskCreate`) and any scheduled check-ins are **ephemeral** — they do not survive into a new session. Only what is committed here does. Read this first.

**Phase:** The AI Brain (Phases A–E) is fully built and merged to `main`, plus the first polish fast-follow. **Working branch:** `claude/audit-and-build-plan-m4bci2` — one branch, sequential PRs into `main`.

### Shipped & merged
- **A — Minimum viable brain:** `candidate_profiles` brain columns + `chat_sessions`/`chat_messages`; `lib/ai/build-system-prompt.ts` (elite XML-layered prompt); `getCandidateBrainBySlug`; `/api/chat`; `ChatPanel`; AI Studio context form; anon-column REVOKE/GRANT security fix.
- **B — Elite chat route:** complexity router (Haiku ↔ Sonnet via `detectComplexQuestion`); high-risk detection + `validateAndSanitize` post-generation grounding; per-turn `model_used`/`was_complex`/`was_validated` tracking.
- **C — Sandbox self-testing:** `sandbox_sessions`; 20-question library; `analyze-sandbox.ts`; `/api/sandbox/analyze`; `SandboxPanel` with verdicts + "Strengthen <field>" deep-links + full diagnostic.
- **Calling card (UX):** chat-first public `/c/[slug]` (`CallingCard` + `ChatOverlay` + `AssetGallery`); replaced the old modal. Deliberately **no token streaming** (conflicts with post-gen validation).
- **D — AI intake interview:** `intake_answers` + readiness columns; `lib/ai/intake.ts` (multi-pass analysis + brain assembly); `/api/intake/analyze` + `/assemble`; `IntakeInterview` dialog.
- **E1 — Transcript email:** Resend client + branded candidate/employer transcript emails; `/api/transcripts/deliver` (idempotent, fired by `sendBeacon` on chat close).
- **E2 — Transcript→brain gap loop:** `transcript_gaps`; `analyze-transcript.ts`; gap-analysis hook in the deliver route (dedupe by category, escalate recurring questions); `PromptBot` in AI Studio.
- **E3 — External transcript hardening:** `brain_hardening_sessions`; `harden-transcript.ts`; `/api/transcript/harden` (paste or TXT/PDF, re-analysis, transcript never stored); `HardenPanel` + history.
- **Fast-follow — PWA + share:** `app/manifest.ts`; code-generated `app/icons/[size]`; `ShareButton` (native share + copy fallback) on the calling card + Share Hub.

### Next-session TODO (in order)
1. **A11y + empty/loading-states audit** *(unblocked — start here)* — WCAG 2.1 AA pass + empty/skeleton states across the calling card, chat, AI Studio, and dashboards. Keep the diff focused on high-traffic surfaces.
2. **Distinctive visual refresh** *(needs founder steer)* — elevate the cream/navy/amber system; propose a direction before any broad reskin.
3. **Phase F — voice input (Whisper)** *(held)* — browser audio capture → `/api/transcribe` (OpenAI Whisper) → editable transcript before submit. Gated on: (a) founder has tested A–E, and (b) `OPENAI_API_KEY` is provisioned (new vendor). Build with graceful degradation so it is safe to merge before the key is set.

### Standing decisions
- Voice (F) is **last**, only after the rest is tested.
- DB migrations **auto-apply** via the Supabase branching integration on PR merge — no manual step.
- Chat/generation model ids come from `lib/ai/models.ts` (`CHAT_MODEL`/`GENERATION_MODEL`) — never hardcode.
- New sensitive columns must stay out of the anon grant (REVOKE/GRANT pattern).

### Ops notes
- Each unit of work = its own PR off the working branch into `main`; PRs merge fast and sequentially (merge commits, so each new PR shows only its delta — keep committing on top of the prior commit).
- Verify every change: `npx tsc --noEmit`, `npm run lint` (0 errors; ~16 pre-existing warnings are acceptable), `npm run build`.
