# 12 · Security

> **Living document.** RoleBoost holds candidates' career data and private
> recruiter conversations, so security is a first-class concern, not a
> bolt-on. This page is the durable, evolving picture of how the platform is
> protected. Update it whenever the posture changes; log the change in the
> Changelog at the bottom. Detailed anti-abuse mechanics live in
> [11 · Anti-Spam & Abuse](./11-anti-spam.md).

## Principles

1. **Isolation by default.** Every user-scoped table has Row Level Security on
   from the migration that creates it. A missed `.eq()` must never leak data.
2. **Least privilege.** The service-role key bypasses RLS and is confined to a
   single file; everything else runs through RLS-scoped clients.
3. **Validate at the edge of trust.** Every server entry point validates input
   with Zod before touching the database.
4. **Fail safe, fail closed on data, fail open on friction.** Data-exposure
   decisions default to denying; abuse controls default to letting a real user
   through (an infra blip should not lock out a legitimate recruiter).
5. **Retain only what serves the user.** Recruiter transcripts are kept solely
   to power the candidate's own AI and reference; uploaded third-party
   transcripts are analyzed and discarded.

## Authentication (Clerk)

- Clerk is the single sign-up / sign-in provider and is **authentication only**.
- Roles, relationships, and all user data live in Supabase keyed by
  `clerk_user_id TEXT`. Role is stored in `users.role`, **never** in Clerk
  metadata, and is always looked up server-side. Client-side role claims are
  never trusted.
- `middleware.ts` runs Clerk on every route and `auth.protect()`s everything
  except an explicit public allowlist (marketing, `/c/[slug]`, `/api/chat`,
  `/api/transcripts`, `/api/cron`, webhooks). Public API routes re-check auth
  themselves where they need identity.

## Authorization & data isolation (RLS)

- RLS policies key off `requesting_user_id()`, a `SECURITY DEFINER` function
  returning `auth.jwt() ->> 'sub'` (the Clerk user id forwarded as a Bearer
  token by the request-scoped client).
- Server queries **also** include `.eq('clerk_user_id', userId)` as defense in
  depth and for index performance, even though RLS would enforce it.
- Employer multi-tenancy is enforced through `employer_members` membership
  subqueries in the relevant policies (e.g. `chat_sessions_employer_read`).

## Supabase clients

| Client | File | Trust | Use |
|---|---|---|---|
| Request-scoped | `lib/supabase/server.ts` | RLS-enforced (forwards Clerk JWT) | API routes, Server Actions, Server Components. The default. |
| Service-role | `lib/supabase/admin.ts` | **Bypasses RLS**, server-only | Migrations, webhooks, and anonymous-caller paths (public chat logging, transcript delivery) where no Clerk JWT exists. Every use is security-review-worthy. |
| Browser (anon) | `lib/supabase/browser.ts` | RLS via anon role | `"use client"` components. |

Hard rules:
- `SUPABASE_SERVICE_ROLE_KEY` is read **only** inside `lib/supabase/admin.ts`.
- Never import `lib/supabase/admin` from a file reachable by the browser bundle.
- Reach for the admin client only when RLS bypass is genuinely required (the
  caller is anonymous, or the write precedes knowing the role).

## Sensitive columns & the anon grant

Brain material (résumé markdown, `context_package_md`, custom Q&A, intake
answers) must stay out of the anon role's column grant. The explicit
REVOKE/GRANT pattern established in the `20260626` migration covers all
later-added columns automatically, so new sensitive columns are protected by
default. New sensitive columns still get a review to confirm they are not
exposed to anon.

## Input validation & error handling

- Every Server Action and API route validates input with **Zod before any
  Supabase call**.
- Failures return the standard envelope `{ error: { code, message?, details? } }`
  with the documented status/code mapping (see
  [10 · Conventions & Ops](./10-conventions-and-ops.md)), never a raw stack.

## Public endpoints & abuse control

The public chatbot (`/c/[slug]` → `/api/chat`, `/api/chat/schedule`,
`/api/transcripts/deliver`) is open to anonymous recruiters and is the primary
abuse surface. Each message can trigger up to three Anthropic calls, so **token
burn** is the core risk. It is protected by layered controls, all fail-open:

1. **Vercel BotID** invisible bot detection on `/api/chat` and
   `/api/chat/schedule`. The front line against automation.
2. **Vercel WAF rate limiting** (`@vercel/firewall`) per IP at the edge, before
   the function runs. *Dashboard-gated: no-ops until its rule is published.*
3. **App-level interaction caps** in `/api/chat`, backed by the `rate_limits`
   table + `check_rate_limit()` RPC. Durable DB-backed ceilings that hold even
   with no WAF rule live: **per conversation** (40/hr; a fresh chat resets it via
   a one-tap restart) and **per source IP** (100/hr; clears a corporate NAT while
   stopping a script). A tripped cap returns a graceful in-thread message with a
   `degraded` flag, never an HTTP error, so the recruiter always has a next step.
4. **Meeting-invitation nudge** in the system prompt: after a few exchanges the
   assistant warmly invites a live meeting, so genuine conversations convert to a
   booking well before any hard cap. A soft, on-brand throttle that is also the
   product's recruiter-conversion loop.
5. **Per-candidate transcript-email throttle** so session-flooding cannot bury a
   candidate's inbox.

Design stance: bots are caught at the edge (1–2); token burn from a single source
or one runaway conversation is bounded durably (3); real recruiters are steered to
convert, not walled (4). A distributed multi-IP flood against one popular profile
is a **known gap** (see below), consciously deferred behind BotID.

Full setup, recommended thresholds, and rationale: [11 · Anti-Spam &
Abuse](./11-anti-spam.md).

## Payments & webhooks

- Paddle handles billing. The `/api/webhooks/paddle` handler **verifies the
  signature before processing** any event. Price-id and webhook secrets are
  server-only env vars.
- The cron sweep (`/api/cron/*`) authenticates with `CRON_SECRET` (Vercel Cron
  sends it as a Bearer token); it no-ops safely when the secret is unset.

## Secrets & environment

- All secrets are Vercel environment variables, never committed. `.env.example`
  documents the shape only.
- Client-exposed values must be `NEXT_PUBLIC_*` and non-sensitive by definition.
- Model ids come from `lib/ai/models.ts`; the Anthropic key is read only in the
  server-only `lib/ai/client.ts`.

## Data retention & privacy

- **Recruiter conversations** are persisted in `chat_messages` and retained for
  the candidate's own AI training and reference. They are the candidate's data,
  surfaced only to that candidate and to the employer team on the session.
- **Uploaded external transcripts** (the AI-Studio "sharpen" flow) are analyzed
  in-request and discarded; only the resulting plan + counts persist. This
  protects third-party interview content.
- Signed asset URLs are short-lived (1-hour TTL), generated server-side per
  load; storage buckets are private.

## Observability

- Transcript recording is best-effort and swallows errors so a logging failure
  never breaks a live answer. To keep that from hiding a broken config,
  `lib/ai/log-chat.ts` tags every failure with `TRANSCRIPT_RECORDING` and emits
  a one-time CRITICAL log when the cause is a missing service-role key. Grep
  production logs for `TRANSCRIPT_RECORDING`.

## Known gaps & backlog

Track outstanding hardening here so it is visible and prioritized.

- [ ] No formal privacy policy / terms pages yet (`Footer` links are
      placeholders). Needed before broad launch.
- [ ] Recording failures are logged but not alerted; wire `TRANSCRIPT_RECORDING`
      into an alerting channel.
- [ ] Rate-limit counters are per-region (Vercel WAF), so global limits are
      approximate. The app-level interaction caps (per-chat, per-IP) are exact and
      cover the common case, but a **distributed multi-IP flood** against one
      popular profile is not yet bounded. Add a per-candidate daily answer budget
      if that pattern appears.
- [ ] BotID and the WAF rules are dashboard-gated and fail-open, so "shipped" is
      not "protected": confirm the `chat`/`schedule` WAF rules and BotID are
      actually enabled in production.
- [ ] No automated dependency / secret scanning in CI yet.
- [ ] `npm audit` reports moderate advisories; triage on a schedule.

## Changelog

- **2026-07** · Initial security overview. Added layered anti-spam (BotID +
  Vercel WAF + per-candidate email throttle) and transcript-recording
  observability. See [11 · Anti-Spam & Abuse](./11-anti-spam.md).
- **2026-07** · Chat token-burn hardening. Added durable app-level interaction
  caps (per-conversation 40/hr + per-IP 100/hr) that hold regardless of WAF
  config and degrade gracefully in-thread, plus a gentle meeting-invitation nudge
  that converts long conversations to bookings before the hard cap. Flagged the
  distributed multi-IP gap and the dashboard-gated-controls caveat above.
