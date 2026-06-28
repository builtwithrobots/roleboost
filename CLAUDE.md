# CLAUDE.md — RoleBoost

> Project memory for Claude Code. Read at the start of every session.
> Holds durable rules and decisions you can't infer from the code. It does **not** mirror
> code or schema — those live in the repo and drift; the repo is always the source of truth.
> Last updated: June 2026

> 📖 **The architecture bible lives in [`docs/architecture/`](docs/architecture/README.md)** —
> the detailed, living reference for how every subsystem is built and works (brain, career
> context document, AI Studio, chat/transcripts, data model, auth, employer side). This file
> is durable rules and decisions; that folder is the how-it-works. Read both.

---

## What This Project Is

RoleBoost is an AI-powered candidate intelligence platform. Job seekers upload a resume and career
context, receive a multi-format career narrative (produced via Google NotebookLM), get a personal
career AI chatbot trained on their data, and share one link that gives hiring managers everything:
audio, video, infographic, slide deck, ATS resume, and a live AI they can interrogate 24/7. Every AI
conversation emails a transcript to both sides. Candidates fine-tune their AI over time.

**Pitch:** "Your career. Your AI. Finally heard."
**Domain:** roleboost.app **GitHub org:** builtwithrobots. Independent codebase; no shared infra.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router (TypeScript, strict mode) |
| Styling | Tailwind CSS |
| Auth | Clerk (single sign-up, role declared in onboarding) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (audio, video, documents, images) |
| AI Chatbot | Anthropic Claude API (Haiku for chat, Sonnet for generation) |
| Email | Resend (transcript delivery) |
| Payments | Paddle (employer tiers; candidate AI Studio moving to paid + trial — see Paddle Payments) |
| Deployment | Vercel (auto-deploy from GitHub, `builtwithrobots` org) |
| Validation | Zod (every server entry point) |

Model ids are **never hardcoded** — import `CHAT_MODEL` / `GENERATION_MODEL` from `lib/ai/models.ts`.

---

## Commands

Claude runs these to verify its own work. Safe in any session.

| Command | Purpose |
|---|---|
| `npm run build` | Production build — run after every non-trivial change. |
| `npm run lint` | ESLint. 0 errors required; ~16 pre-existing warnings are acceptable. |
| `npx tsc --noEmit` | Typecheck — run after every TypeScript change. |

After a failure, fix the underlying issue. Never suppress type errors with `@ts-ignore` or `any` — ask for clarification instead.

---

## Project Structure

```
app/
  (auth)/                  Clerk auth pages
  (candidate)/dashboard/   profile · assets · ai · transcripts · analytics · preview
  (employer)/dashboard/    candidates · jobs · board · transcripts · team
  c/[slug]/                Public candidate calling card (chat-first experience)
  api/                     chat · transcripts · candidates · employers · assets · jobs
                           feedback · intake · sandbox · resume · webhooks/paddle
lib/
  auth/        getUserContext(), AuthError
  supabase/    server.ts · admin.ts · browser.ts
  storage/     signed-URL helpers
  ai/          chat handler, prompt builder, models.ts, brain assembly
  email/       Resend client + transcript templates
  types/       shared TypeScript types
components/
  modal/ · chat/ · candidate/ · employer/ · ui/
supabase/migrations/       all database migrations (source of truth for schema)
```

---

## Key Architectural Decisions

### Single Sign-Up Flow, Two Experiences

One Clerk auth flow; role declared in onboarding. After onboarding routing diverges:
candidates → `/dashboard/profile`, employers → `/dashboard/candidates`.

Role is stored in Supabase `users.role` (`candidate` | `employer`) — **never** in Clerk metadata.
Always look up role from Supabase on the server. Never trust client-side role claims.

### user_id = Clerk userId (TEXT)

Clerk is authentication only. All user data, roles, and relationships live in Supabase keyed by
`clerk_user_id TEXT`. No Clerk Organizations. Employer multi-tenancy uses the `employer_accounts` table.

### Supabase Clients — Three Clients, One Purpose Each

- **`lib/supabase/server.ts`** — request-scoped authenticated client. `getRequestClient()` forwards the
  Clerk JWT as Bearer token; RLS enforced. Use in every API route, Server Action, Server Component.
- **`lib/supabase/admin.ts`** — service-role client; bypasses RLS; server-only. Migrations and webhooks
  only. Every import must carry a comment explaining why RLS bypass is required.
- **`lib/supabase/browser.ts`** — anon client for `"use client"` components; RLS via anon role.

Hard rules:
- `SUPABASE_SERVICE_ROLE_KEY` is read **only** inside `lib/supabase/admin.ts`. Never from client code.
- Never import `lib/supabase/admin` from a file that could reach the browser bundle.
- Default to `getRequestClient()`; reach for admin only when RLS bypass is explicitly required.

### Row Level Security (RLS)

RLS is enabled on every user-scoped table from day one. A missed `.eq()` would silently leak data
without it. Rules:
- Every new user-scoped table ships with `ENABLE ROW LEVEL SECURITY` and an isolation policy **in the
  same migration** that creates the table.
- Server queries still include `.eq('clerk_user_id', userId)` as defense in depth and for index perf.
- New sensitive columns must stay out of the anon grant (REVOKE/GRANT pattern).
- Treat every admin-client usage as security-review-worthy.

Isolation policies key off `requesting_user_id()`:

```sql
CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT auth.jwt() ->> 'sub'; $$;
```

### AI Chatbot Architecture

The candidate career AI is a single Claude API call with a layered, XML-structured system prompt.
No fine-tuning, embeddings, or vector DB for MVP. Resume text is sourced from
`resume_documents.canonical_markdown` and passed to the builder as a **separate argument** — there is
**no `resume_text` column** in active use (the prompt builder reads the markdown, not the candidate record).

**Prompt structure (`lib/ai/build-system-prompt.ts`) — data near the top, rules near the bottom:**

1. `<role>` — first-person identity; not a FAQ bot
2. `<career_information>` — full resume markdown
3. `<context>` — named career-context fields
4. `<custom_answers priority="highest">` — candidate-refined QA pairs; highest priority
5. `<few_shot_examples>` — 2–3 worked hard-question exemplars from custom QA
6. `<knowledge_boundary>` — explicit known / not_known / when_not_known
7. `<principles>` — honesty, calm confidence, human warmth
8. `<adversarial_posture>` — handling skeptical / pressure-testing questions
9. `<redirect_topics>` — topics that go to a direct conversation, not the AI
10. `<voice>` — tone derived from the candidate's own writing
11. `<reasoning_instruction>` — synthesis and numeric grounding

**Complexity router (`app/api/chat/route.ts`):** simple factual → `CHAT_MODEL` (Haiku);
multi-part / adversarial / synthesis → `GENERATION_MODEL` (Sonnet). Detection is a fast string
heuristic (`detectComplexQuestion`) — no API call.

**Post-generation validation:** runs only when an answer contains numbers, dollars, percentages, or
credential claims (`detectHighRiskContent`). A fast Sonnet call (`validateAndSanitize`) checks every
such claim traces to the candidate's data; if not grounded, the answer becomes a safe deflection; if
the validation call fails for any reason, the original answer is returned (fail-safe). Deliberately
**no token streaming** — it conflicts with post-gen validation.

**Per-turn tracking:** each assistant `chat_messages` row records `model_used`, `was_complex`,
`was_validated`. Blended cost ≈ $0.01 per 10-turn session.

### Candidate AI Fine-Tuning (`/dashboard/ai`)

Candidates see most-asked questions, edit answers (stored as `custom_qa_pairs` JSONB on
`candidate_profiles`), toggle redirect topics / `ai_enabled`, and test in a sandbox. Custom QA pairs
are injected above base career data, giving them priority over resume-derived answers.

### Transcript Delivery

Every AI chat session emails a transcript to both sides when the modal closes or after 30 min of
inactivity. Trigger: `POST /api/transcripts/deliver` (idempotent, fired by `sendBeacon` on chat close).
Candidate email: full transcript, company name if employer logged in, pattern insights at 3+ same-topic
questions, fine-tune link. Employer email: full transcript, profile link, save-candidate + feedback CTAs.
All email via Resend; client (`lib/email/client.ts`) and templates (`lib/email/`) are server-only —
never send from client components.

### Asset Storage

All buckets private; assets served via signed URLs with 1-hour TTL, generated server-side on every
modal load. The modal client receives pre-signed URLs and never calls Supabase Storage directly.

| Bucket | Contents |
|---|---|
| `candidate-audio` | Audio overview + debate audio |
| `candidate-video` | Video overview |
| `candidate-documents` | Slide decks + ATS resumes (PDF) |
| `candidate-images` | Career infographics |

Path pattern: `{clerk_user_id}/{timestamp}-{sanitized-filename}`.

### Candidate Calling Card (public `/c/[slug]`)

The core employer-facing experience — chat-first (`CallingCard` + `ChatOverlay` + `AssetGallery`),
replacing the old modal. Opens without page navigation. Tabs: Audio · Debate · Video · Deck ·
Infographic · Resume · Chat. Each tab loads its asset lazily. Focus trapped while open; ESC closes and
returns focus to trigger; fully keyboard navigable; WCAG 2.1 AA.

### Employer Candidate Board

Filtered view of the saved pool scoped to a job posting. Stage assignment via dropdown in MVP — **no**
drag and drop. Stages: `Saved → Screening → Interview → Offer → Passed`.

### Paddle Payments

Paddle handles employer billing. Webhook at `/api/webhooks/paddle` — always verify the signature
before processing. Price-id env vars: `PADDLE_EMPLOYER_{STARTER,GROWTH,SCALE}_PRICE_ID`
($49 / $99 / $249 per mo).

**Candidate AI Studio is moving to a paid component** (subscription + free trial of duration TBD;
the free tier has no chatbot). This reverses the original "candidates always free" decision. The
billing/trial system is its own workstream and is **not yet built**. All candidate AI access flows
through one seam — `lib/auth/entitlements.ts` (`assertCandidateAiAccess`). It is open to all
candidates during rollout (`BILLING_ENFORCED = false`); flip the flag and the real
subscription/trial check takes over with no caller changes.

### Career Context Document (`context_package_md`)

A polished, single-file career-context document — generated by the "Candidate Asset Production Skill"
(`docs/CANDIDATE_ASSET_PRODUCTION_SKILL.md`), Section 1 only (the Narrative Guide Block; the NotebookLM
prompt sets in Section 2 are excluded from the candidate flow).

- **Self-serve generation** (`/api/career-context/generate`, `lib/ai/career-context.ts`): reads the
  candidate's résumé + career sources and produces **two narrative angles**; the candidate picks one
  (`selectCareerContextAngle`). Staged in `candidate_profiles.career_context_drafts` (JSONB).
- The selected angle's markdown — or an externally-generated doc uploaded on `/dashboard/assets` —
  lands in the **single** `context_package_md` slot. That column is the active document the brain
  reads and the assets page downloads.
- **Augment loop** (`/api/career-context/augment`, `augmentCareerContextAngle`): re-synthesizes the
  *selected* angle, folding in the candidate's newer authored material (brain fields, refined Q&A,
  career sources) and refreshing verbatim third-party **evidence snippets** from sources. New context
  enters the brain **distilled, not appended** — the deliberate "deepen the synthesis loop" decision
  over adding raw context layers. The story-type/angle framing is preserved across updates.
- `context_package_md` is sensitive brain material: it stays out of the anon column grant (the
  explicit-grant pattern from the 20260626 migration covers all later-added columns automatically).

### Data Fetching — RSC + Server Actions

- **Reads** — Server Components call Supabase via `getRequestClient()` (no API round-trip).
- **Mutations** — Server Actions (`"use server"`): Zod-validate, write, `revalidatePath`.
- **`/api` routes** — reserved for: Paddle webhook, AI chat (`/api/chat`), transcript delivery
  (`/api/transcripts/deliver`), intake / sandbox / resume / harden endpoints, and any caller without
  a Clerk session.
- **Default to Server Components.** Every `app/` `.tsx` is a Server Component unless it opts out with
  `"use client"`. Push interactive subtrees into small `*Client.tsx` children.

---

## Claude API Usage

Two models, two purposes — never swap them. Ids come from `lib/ai/models.ts`.

| Constant | Value | Use |
|---|---|---|
| `CHAT_MODEL` | `claude-haiku-4-5-20251001` | Chatbot responses — fast, cheap |
| `GENERATION_MODEL` | `claude-sonnet-4-6` | Prompt / bullet generation, validation — higher quality |

Import the Anthropic SDK only from a server-only file (`lib/ai/client.ts`). Never expose the API key
to the client.

---

## Database

**The schema's source of truth is `supabase/migrations/` — never reproduce it here, and never edit the
database manually.** Migrations auto-apply via the Supabase branching integration on PR merge.

Tables (as of June 2026):

| Table | Purpose |
|---|---|
| `users` | Clerk-keyed user, role, subscription, `is_admin` |
| `candidate_profiles` | Profile + AI-brain columns (context fields, `custom_qa_pairs`, intake/readiness) |
| `candidate_assets` | Uploaded career assets (audio/video/deck/infographic/resume) |
| `resume_documents` | Parsed resume + `canonical_markdown` (the AI's resume source) |
| `chat_sessions` / `chat_messages` | AI chat logs; messages track `model_used`/`was_complex`/`was_validated` |
| `intake_answers` | AI intake-interview answers |
| `sandbox_sessions` | Candidate self-test sessions |
| `transcript_gaps` | Gaps surfaced from transcripts to improve the brain |
| `brain_hardening_sessions` | External-transcript hardening runs |
| `employer_accounts` / `employer_members` | Employer multi-tenancy + team |
| `job_postings` / `saved_candidates` | Jobs + saved pool with stage |
| `feedback` | Employer → candidate messages |
| `profile_views` | View tracking |
| `admin_role_sessions` | Admin role-switch sessions |

Every user-scoped table has RLS enabled with an owner/isolation policy in its creating migration (see
RLS section above).

---

## User Roles

| Role | Who | Access |
|---|---|---|
| `candidate` | Job seeker | Own profile, assets, analytics, feedback, transcripts |
| `employer_owner` | Created the account | Full employer dashboard, team, billing |
| `employer_member` | Invited member | Pool, board, feedback, transcripts — no billing |

`users.role` is `candidate` | `employer`. Employer sub-role (owner vs member) is in `employer_members.role`.

---

## Server Code Patterns

Every Server Action and API route follows this spine:

1. Resolve user context via `getUserContext()` (`lib/auth/user-context.ts`) — throws typed `AuthError`
   on auth failure; pass a `requiredRole` to gate.
2. Validate input with Zod **before** any Supabase call.
3. Run the query — RLS enforces isolation.
4. Return typed data or the standard error envelope.

Reference implementations live in the codebase — read them rather than copying from here:
`lib/auth/user-context.ts` (context + `AuthError`), and any existing Server Action under
`app/(candidate)/` or `app/(employer)/` for the try/catch + Zod + `revalidatePath` shape.

### Error Envelope

Every failed response uses exactly: `{ error: { code: string, message?: string, details?: unknown } }`.

| Situation | HTTP | Code |
|---|---|---|
| Zod parse failure | 400 | `INVALID_INPUT` |
| No Clerk session | 401 | `UNAUTHENTICATED` |
| Clerk session but no user row | 403 | `NO_USER` |
| Wrong role | 403 | `FORBIDDEN` |
| Lacks AI Studio entitlement | 402 | `PAYMENT_REQUIRED` |
| Row not found | 404 | `NOT_FOUND` |
| Supabase or API error | 500 | `INTERNAL` |

---

## Accessibility — WCAG 2.1 AA (non-negotiable)

- ≥44px touch targets on mobile; ≥4.5:1 contrast for normal text
- All interactive elements keyboard accessible; meaningful alt text on images
- Focus trapped in modal while open; ESC closes and returns focus to trigger
- Chat interface fully keyboard navigable; never rely on color alone

---

## Development Workflow

- One branch per task, named `claude/<task-slug>`. Each unit of work = its own draft PR off the working
  branch into `main`; PRs merge fast and sequentially (merge commits, so each new PR shows only its
  delta — keep committing on top of the prior commit).
- Ready for review once typecheck + lint pass and the preview URL works.
- Conventional Commits: `feat:` `fix:` `docs:` `refactor:` `chore:`. Squash-merge to `main`, delete
  branch on merge. Never force-push to `main`.
- Vercel auto-deploys `main` to production and every branch to a preview URL (the primary dev surface).
- Verify before complete: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

---

## Environment Variables

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=   CLERK_SECRET_KEY=
# Supabase
NEXT_PUBLIC_SUPABASE_URL=   NEXT_PUBLIC_SUPABASE_ANON_KEY=   SUPABASE_SERVICE_ROLE_KEY=
# Anthropic / Resend
ANTHROPIC_API_KEY=   RESEND_API_KEY=
# Paddle
PADDLE_API_KEY=   PADDLE_WEBHOOK_SECRET=   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
PADDLE_EMPLOYER_STARTER_PRICE_ID=   PADDLE_EMPLOYER_GROWTH_PRICE_ID=   PADDLE_EMPLOYER_SCALE_PRICE_ID=
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## What Not to Build in MVP

Push back if asked for: on-platform AI asset generation (NotebookLM is the engine) · drag-and-drop
Kanban · employer browse directory (save via shared links only) · resume parsing / ATS keyword
optimization · in-browser audio/video recording · real-time chat notifications (email transcripts are
the mechanism) · voice cloning · multi-language · native mobile app · social / endorsements · external
ATS integrations · advanced chatbot model selection.

---

## Current Build Status

> Durable cross-session handoff, updated June 2026. The in-session task list (`TaskCreate`) and any
> scheduled check-ins are **ephemeral** — only what is committed here survives. Read this first.

**Phase:** The AI Brain (Phases A–E) is fully built and merged to `main`, plus the first polish
fast-follow. **Working branch:** `claude/audit-and-build-plan-m4bci2` — one branch, sequential PRs into
`main`.

### Shipped & merged
- **A — Minimum viable brain:** `candidate_profiles` brain columns + `chat_sessions`/`chat_messages`;
  `lib/ai/build-system-prompt.ts`; `getCandidateBrainBySlug`; `/api/chat`; `ChatPanel`; AI Studio
  context form; anon-column REVOKE/GRANT security fix.
- **B — Elite chat route:** complexity router; high-risk detection + `validateAndSanitize` grounding;
  per-turn `model_used`/`was_complex`/`was_validated` tracking.
- **C — Sandbox self-testing:** `sandbox_sessions`; 20-question library; `analyze-sandbox.ts`;
  `/api/sandbox/analyze`; `SandboxPanel` with verdicts + "Strengthen <field>" deep-links.
- **Calling card (UX):** chat-first public `/c/[slug]`; replaced the old modal. No token streaming.
- **D — AI intake interview:** `intake_answers` + readiness columns; `lib/ai/intake.ts`;
  `/api/intake/analyze` + `/assemble`; `IntakeInterview` dialog.
- **E1 — Transcript email:** Resend client + branded candidate/employer emails;
  `/api/transcripts/deliver` (idempotent, `sendBeacon` on chat close).
- **E2 — Transcript→brain gap loop:** `transcript_gaps`; `analyze-transcript.ts`; gap-analysis hook in
  the deliver route; `PromptBot` in AI Studio.
- **E3 — External transcript hardening:** `brain_hardening_sessions`; `harden-transcript.ts`;
  `/api/transcript/harden` (transcript never stored); `HardenPanel` + history.
- **Fast-follow — PWA + share:** `app/manifest.ts`; code-generated `app/icons/[size]`; `ShareButton`.

### Next-session TODO (in order)
1. **A11y + empty/loading-states audit** *(unblocked — start here)* — WCAG 2.1 AA + empty/skeleton
   states across calling card, chat, AI Studio, dashboards. Keep the diff focused on high-traffic surfaces.
2. **Distinctive visual refresh** *(needs founder steer)* — elevate cream/navy/amber; propose a
   direction before any broad reskin.
3. **Phase F — voice input (Whisper)** *(held)* — browser audio → `/api/transcribe` (OpenAI Whisper) →
   editable transcript before submit. Gated on: founder has tested A–E, and `OPENAI_API_KEY` is
   provisioned. Build with graceful degradation so it is safe to merge before the key is set.

### Standing decisions
- Voice (F) is **last**, only after the rest is tested.
- DB migrations auto-apply via the Supabase branching integration on PR merge — no manual step.
- Model ids come from `lib/ai/models.ts` — never hardcode.
- New sensitive columns must stay out of the anon grant (REVOKE/GRANT pattern).
