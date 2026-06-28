# 10, Conventions & Ops

## Server entry-point spine

Every Server Action and API route follows the same four steps:

1. `getUserContext(requiredRole?)` (`lib/auth/user-context.ts`), typed `AuthError`
   on failure; returns the RLS client + role. (Public routes like `/api/chat` skip
   this and gate visibility themselves.)
2. Zod-validate input **before** any Supabase call.
3. Run the query, RLS enforces isolation; keep explicit `.eq('clerk_user_id', …)`
   as defense-in-depth and for index performance.
4. Return typed data or the standard error envelope.

For AI generation routes, also call `assertCandidateAiAccess(user)` (the
entitlement seam, see [03](./03-auth-and-entitlements.md)).

## Error envelope

Every failed response is exactly `{ error: { code, message?, details? } }`.

| Situation | HTTP | Code |
|---|---|---|
| Zod parse failure | 400 | `INVALID_INPUT` |
| No Clerk session | 401 | `UNAUTHENTICATED` |
| Clerk session but no user row | 403 | `NO_USER` |
| Wrong role | 403 | `FORBIDDEN` |
| Lacks AI Studio entitlement | 402 | `PAYMENT_REQUIRED` |
| Row not found | 404 | `NOT_FOUND` |
| Supabase or API error | 500 | `INTERNAL` |

Server Actions return a discriminated result (`{ ok: true, … }` /
`{ ok: false, error: { code, … } }`) rather than throwing across the boundary.

## AI module conventions

- Model IDs only from `lib/ai/models.ts` (`CHAT_MODEL` / `GENERATION_MODEL`),
  never hardcode an id.
- Anthropic SDK only via `lib/ai/client.ts` (server-only lazy singleton).
- Generation/analysis modules force structured output via
  `tool_choice: { type: 'tool', name: … }` and read the first `tool_use` block,
  no free-text parsing.
- Analysis that feeds (not gates) the user experience is **best-effort /
  fail-safe**: gap analysis, chat logging, and grounding validation never break the
  primary flow on error.

## Security rules that are non-negotiable

- `SUPABASE_SERVICE_ROLE_KEY` is read only in `lib/supabase/admin.ts`; never import
  `admin.ts` anywhere reachable by the browser bundle.
- New **sensitive** columns are automatically protected by the anon column-grant
  (they're simply absent from the grant). New **public** columns must be added to
  the grant in `20260626000000_ai_brain.sql`'s pattern deliberately.
- Email and Anthropic clients are server-only. The API keys never reach the client.
- Treat every admin-client usage as security-review-worthy and comment why RLS
  bypass is required at the import.

## Webhooks

- **Clerk** (`/api/webhooks/clerk`), Svix-verified. `user.created` upserts a
  `users` row (`role = NULL`, `subscription_status = 'free'`,
  `ignoreDuplicates: true`); `user.updated` syncs email; `user.deleted` cascades.
- **Paddle** (`/api/webhooks/paddle`), **always verify the signature before
  processing.** Employer price-id env vars:
  `PADDLE_EMPLOYER_{STARTER,GROWTH,SCALE}_PRICE_ID`. Candidate AI Studio billing is
  a planned workstream (see [03](./03-auth-and-entitlements.md)).

## Accessibility, WCAG 2.1 AA (non-negotiable)

≥44px touch targets; ≥4.5:1 contrast; full keyboard navigation; focus trapped in
overlays with ESC-to-close and focus return; never rely on color alone. The chat
overlay and AI Studio tabs are built to this bar.

## Environment variables

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
NEXT_PUBLIC_APP_URL=
```

## Verify before complete

Run all three; fix the root cause rather than suppressing:

| Command | Bar |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors (≈16 pre-existing warnings are acceptable) |
| `npm run build` | passes |

## Dev workflow

One branch per task (`claude/<slug>`), draft PR into `main`, squash-merge, delete
branch. Conventional Commits (`feat:`/`fix:`/`docs:`/`refactor:`/`chore:`). Vercel
auto-deploys `main` → production and every branch → a preview URL. **Supabase
migrations auto-apply on PR merge** via the branching integration, no manual step.
Never edit the database by hand; never reproduce schema outside
`supabase/migrations/`.

## Keeping this folder honest

The code is the source of truth. When you change behavior, update the matching doc
in the same PR. If a doc and the code disagree, fix the doc. The `./specs/` folder
is historical (original build specs) and is intentionally *not* kept in sync, do
not treat it as current.
