# 01, System Overview

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router (TypeScript, strict mode) |
| Styling | Tailwind CSS (design tokens via CSS variables, `--rb-*`) |
| Auth | Clerk (single sign-up; role declared in onboarding) |
| Database | Supabase (PostgreSQL) with Row Level Security everywhere |
| Storage | Supabase Storage (private buckets, signed URLs) |
| AI | Anthropic Claude, Haiku for chat, Sonnet for generation |
| Email | Resend (transcript delivery) |
| Payments | Paddle (employer billing live; candidate AI Studio billing planned) |
| Deployment | Vercel (auto-deploy `main` → prod, every branch → preview) |
| Validation | Zod at every server entry point |

## Repository layout

```
app/
  (auth)/                  Clerk auth + onboarding (role declaration)
  (candidate)/dashboard/   profile · assets · ai (AI Studio) · analytics · feedback · preview
  (employer)/dashboard/    candidates · jobs · board · team
  c/[slug]/                Public candidate calling card (chat-first)
  api/                     chat · career-context · intake · sandbox · transcript(s) ·
                           resume · sources · assets · profile · webhooks · admin
lib/
  ai/          brain assembly, prompt builder, the generation/analysis modules, models.ts, client.ts
  auth/        getUserContext + AuthError, entitlements seam, admin actions
  supabase/    server.ts (RLS) · admin.ts (service role) · browser.ts (anon)
  career-sources/  ingest + queries for external career material
  email/       Resend client + transcript templates (server-only)
  resume/      text extraction, canonical render, PDF/DOCX generation, asset storage
  storage/     signed-URL helpers
  types/       shared TypeScript types (single file: index.ts)
components/
  modal/ (CallingCard, AssetGallery) · chat/ (ChatOverlay) · candidate/ · employer/ · ui/
supabase/migrations/       all schema, the source of truth for the database
docs/architecture/         this folder (the bible)
```

## The two experiences, one auth flow

One Clerk sign-up. During onboarding the user declares a role
(`app/(auth)/onboarding/actions.ts` → `setUserRole`). After that, routing
diverges: **candidates** → `/dashboard/profile`, **employers** →
`/dashboard/candidates`. Role lives in Supabase `users.role`
(`candidate | employer | admin`), never in Clerk metadata, always read
server-side. See [03, Auth](./03-auth-and-entitlements.md).

## Request lifecycle (the spine)

Two server surfaces, used deliberately:

- **Reads**, React Server Components call Supabase directly via
  `getRequestClient()` (RLS-enforced). No API round-trip.
- **Mutations**, Server Actions (`"use server"`): resolve context → Zod-validate
  → write → `revalidatePath`.
- **`/api` routes**, reserved for callers without a usable Clerk session or that
  need Node APIs: the public chat (`/api/chat`), transcript delivery, the AI
  generation endpoints (career-context, intake, sandbox, harden, resume), uploads,
  and the Clerk/Paddle webhooks.

Every server entry point follows the same shape:

1. `getUserContext(requiredRole?)` (`lib/auth/user-context.ts`), throws typed
   `AuthError`; returns the RLS client + role.
2. Zod-validate input **before** any Supabase call.
3. Run the query, RLS enforces isolation; explicit `.eq('clerk_user_id', …)` is
   defense-in-depth and keeps indexes hot.
4. Return typed data or the standard error envelope (see
   [10, Conventions](./10-conventions-and-ops.md)).

## Where the AI lives

All Anthropic access is server-only, through `lib/ai/client.ts` (lazy singleton;
the API key never reaches the browser). Model IDs come from `lib/ai/models.ts`:
`CHAT_MODEL` (Haiku) and `GENERATION_MODEL` (Sonnet). Every generation/analysis
module uses **forced tool calls** (`tool_choice`) so output is structured and
parse-safe rather than free text. Details in [04, The AI Brain](./04-ai-brain.md).

## Deployment

Vercel auto-deploys `main` to production and every branch to a preview URL (the
primary dev surface). Supabase migrations auto-apply via the Supabase branching
integration on PR merge, there is no manual migration step. One branch per task
(`claude/<slug>`), draft PR into `main`, squash-merge.
