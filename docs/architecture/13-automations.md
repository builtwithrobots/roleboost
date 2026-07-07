# 13, Automations & Scheduled Jobs

> How RoleBoost runs work on a clock and enforces quality automatically:
> Vercel Cron jobs, GitHub CI, dependency + security scanning, and the local
> typecheck hook. Code is the source of truth; this doc explains the wiring.

---

## Scheduled jobs (Vercel Cron)

All scheduled routes live under `app/api/cron/*` and are registered in
`vercel.json`. Every one shares the same spine:

- **Auth:** `guardCron(req)` (`lib/cron/guard.ts`) checks
  `Authorization: Bearer $CRON_SECRET`. Until `CRON_SECRET` is provisioned the
  route is a harmless no-op (`200 { skipped: 'no_secret' }`) rather than a hard
  failure, so a job can ship ahead of its env var. Once set, a missing or
  mismatched token is a `401 UNAUTHENTICATED`.
- **Client:** the service-role `adminClient` (RLS-bypassing), because these jobs
  run without any user session.
- **Public route:** `middleware.ts` already lists `/api/cron/(.*)` as public;
  the job self-authenticates via the secret.
- **Best-effort:** email/side-effects never throw out of the loop; one failure
  does not abort the batch.

| Route | Schedule (UTC) | What it does |
|---|---|---|
| `deliver-transcripts` | `*/15 * * * *` | Safety-net sweep for the transcript pipeline: delivers idle/abandoned sessions the browser beacon missed (see [07](./07-chat-and-transcripts.md)). |
| `prune-rate-limits` | `0 3 * * *` | Deletes `rate_limits` rows whose window started > 30 days ago, so the abuse-counter table (and the cron idempotency keys) never grow unbounded. |
| `meeting-request-reminders` | `0 15 * * *` | Emails a candidate once about a live-meeting request still `new` 2–14 days after a recruiter submitted it. The highest-intent signal on the platform; a dropped request is a dropped hire. |
| `weekly-digest` | `0 15 * * 1` | Monday re-engagement email to each candidate with real recruiter activity that week: views, conversations, questions asked. Zero-activity candidates are skipped. |

### Idempotency without new schema

`meeting-request-reminders` and `weekly-digest` must send **once**, even if a
Vercel Cron run retries. Rather than add tracking columns, they reuse the
existing fixed-window limiter (`checkAppRateLimit`, `check_rate_limit()` RPC) as
a "have I done X in window W" gate:

- reminders: key `meeting-reminder:{requestId}`, max 1, 30-day window (outlives
  the 14-day reminder window).
- digest: key `weekly-digest:{clerkUserId}`, max 1, ~6-day window (clears before
  the next Monday run, blocks same-week retries).

`prune-rate-limits` uses a 30-day retention that sits safely past both, so a
prune never clears a marker that still matters.

### Aggregation note (weekly-digest)

The digest tallies views/conversations/questions in-process over three capped
scans (`profile_views`, `chat_sessions`, `chat_messages`) rather than a SQL
`GROUP BY`, to stay inside the untyped service-role client the rest of the
pipeline uses. Sandbox sessions are excluded so a candidate's own testing never
inflates their numbers. `SCAN_LIMIT` bounds each scan; revisit if candidate
volume outgrows it (move to an RPC with server-side aggregation).

### Deferred: trial-expiry sweep

A daily job to expire candidate AI-Studio trials and flip entitlements is the
natural fifth cron, but it is **intentionally not built here**. There is no trial
schema yet (`users` has `subscription_status`/`subscription_tier` but no trial
clock), and billing is its own unstarted workstream (`BILLING_ENFORCED = false`,
see [03](./03-auth-and-entitlements.md)). Build it alongside the trial columns,
not against phantom fields.

---

## Continuous integration (GitHub Actions)

`.github/workflows/ci.yml` runs on every PR into `main` and on pushes to `main`,
formalizing the checks CLAUDE.md already treats as required:

1. `npm ci`
2. `npx tsc --noEmit` (typecheck)
3. `npm run lint` (0 errors; the ~16 known warnings are acceptable and do not
   fail the job)
4. `npm run build`

The build step supplies **placeholder** `NEXT_PUBLIC_*` Clerk/Supabase values so
Next can resolve its clients; no real secrets are needed to catch build breaks.
`concurrency` cancels a superseded run when a newer commit lands on the same PR.

## Dependency & security scanning

- **Dependabot** (`.github/dependabot.yml`): weekly npm updates, minor/patch
  bumps **grouped** into a couple of reviewable PRs; framework majors (Next,
  React) are ignored by the bot so they get a deliberate, focused upgrade. Also
  keeps the workflows' own Actions current. Every bot PR is gated by CI above.
- **CodeQL** (`.github/workflows/codeql.yml`): `security-and-quality` query pack
  on PRs, pushes to `main`, and a weekly schedule. Findings land in the repo's
  Security tab. Worth the minutes given the Clerk JWTs, service-role key, and
  Paddle/Anthropic/Resend secrets this app handles.

## Local typecheck hook (Claude Code)

`.claude/hooks/typecheck.sh` is a `Stop` hook (registered in
`.claude/settings.json`). When a Claude Code turn finishes, if any `*.ts`/`*.tsx`
files are dirty in the working tree it runs `npx tsc --noEmit` and blocks the
stop (exit 2) with the errors if it fails, so type breaks surface locally before
work is reported done, mirroring the CI gate. It is a fast no-op when nothing
TS changed, and honors `stop_hook_active` to avoid loops.

---

## Environment variables

No new variables. The jobs use existing ones:

- `CRON_SECRET`: required for the cron routes to do real work (no-op without it).
- `RESEND_API_KEY`: the reminder and digest jobs no-op when email is unconfigured
  (`isEmailConfigured()`).
- `NEXT_PUBLIC_APP_URL`: absolute links in the emails (falls back to
  `https://roleboost.app`).
