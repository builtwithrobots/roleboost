# 11 · Anti-Spam & Abuse Control

The public chatbot (`/c/[slug]` → `/api/chat`) is open to anonymous recruiters,
which makes it an abuse surface: each message triggers up to three Anthropic
calls, and each conversation can email the candidate. Three layers protect it,
all low-friction for real recruiters and all fail-open so an infra blip or
missing config never blocks a legitimate conversation.

## Layers

| Layer | Where | Purpose |
|---|---|---|
| **Vercel BotID** | `checkBotId()` in `/api/chat`, `/api/chat/schedule` | Invisible bot detection (Kasada). Blocks Playwright/Puppeteer, scrapers, credential-stuffers. |
| **Vercel WAF rate limiting** | `@vercel/firewall` `checkRateLimit()` in `/api/chat`, `/api/chat/schedule`, `/api/transcripts/deliver` | Per-IP flood control at the edge, before the function runs (no compute cost on blocked requests). |
| **App-level interaction caps** | `checkAppRateLimit()` in `/api/chat` | Durable, DB-backed ceilings on token burn: per conversation and per source IP. Enforced in-app, so they hold even when the WAF rule is unpublished, and they degrade gracefully in-thread rather than as an HTTP error. |
| **Per-candidate email throttle** | `checkAppRateLimit()` in `lib/transcripts/deliver.ts` | Caps transcript emails per candidate per hour so session-flooding can't bury an inbox. The one dimension the WAF can't express. |

## BotID

- Setup: `withBotId()` in `next.config.ts`, `initBotId({ protect: [...] })` in
  `instrumentation-client.ts`, `checkBotId()` server-side on each protected route.
- **Basic** tier is free and active automatically once deployed on Vercel. No env vars.
- **Deep Analysis** (Pro, ~$1 / 1000 `checkBotId()` calls) is stronger; enable it in
  **Vercel dashboard → Firewall → Rules → Vercel BotID Deep Analysis**.
- Owner previews (`isOwner`) skip the check. Local dev always reports not-a-bot.
- Fail-open: any error is logged and the request proceeds.

## WAF rate-limit rules (dashboard)

`checkRateLimit('<id>', { request })` references a rule by ID configured in
**Vercel dashboard → Firewall → Rules** (condition: `@vercel/firewall`, matching
Rate limit ID). Until the rule exists the call no-ops (fail-open), so the code is
safe to ship ahead of configuration. Recommended starting values (per IP):

| Rule ID | Recommended limit | Window | Rationale |
|---|---|---|---|
| `chat` | 30 requests | 60s | A human sends a handful of messages per minute; 30/min is generous headroom while blocking automated floods. |
| `schedule` | 5 requests | 300s | Emails the candidate; a real recruiter schedules once. Tight. |
| `identify` | 20 requests | 300s | Optional recruiter self-introduction; cheap, but capped so a session cannot be spammed. |
| `deliver` | 60 requests | 60s | Idempotent beacon, fired ~once per conversation; only needs a ceiling on hammering. |

Notes:
- Vercel's **Fixed Window** caps the window at **300s** (5 minutes). To block for
  longer than the counting window, add a **Persistent Action** to the rule.
- WAF counters are per-region, so global traffic against one key can exceed the
  configured limit in aggregate. These are floors on abuse, not exact quotas.

## App-level interaction caps

The WAF is per-region and no-ops until its dashboard rule is published, so token
burn on `/api/chat` also has two durable, DB-backed ceilings (constants at the top
of `app/api/chat/route.ts`, backed by the `rate_limits` table + `check_rate_limit()`
RPC). Both fail open, both skip the owner's own preview (`isOwner`), and neither
returns an HTTP error: a tripped cap comes back as a normal in-thread assistant
message plus a `degraded` flag, so the recruiter always has a next step.

| Cap | Key | Default | Recruiter's next step |
|---|---|---|---|
| **Per conversation** | `chat-session:{sessionId}` | 40 / hour | `degraded: 'session_limit'` → the chat surfaces a one-tap **Start a new conversation** button; a fresh session clears the cap, so a genuine long conversation is never dead-ended. |
| **Per source IP** | `chat-ip:{ip}` | 100 / hour | `degraded: 'rate_limited'` → a restart won't help the same IP, so the message points to the follow-up path (leave email / schedule). Set high enough to clear a shared office IP (corporate NAT) while still stopping a script. |

The per-conversation cap is checked first, so a heavy but genuine single
conversation gets the restart path rather than the harder IP wall. The first
message of a session has no `sessionId` yet, so the per-chat cap engages from the
second message; the per-IP cap applies from the first. These bound a single-source
flood and one runaway conversation; a distributed attack rotating across many IPs
against one popular profile is deliberately **not** covered here (BotID is the
front line for automation, and a per-candidate daily budget can be added later if
that pattern ever appears).

## Per-candidate email throttle

`MAX_TRANSCRIPT_EMAILS_PER_HOUR` (currently 12) in `lib/transcripts/deliver.ts`,
keyed by `candidate_profile_id`, backed by the `rate_limits` table +
`check_rate_limit()` RPC (migration `20260709000000_rate_limits.sql`). When the
cap is hit, the recruiter still gets their copy; only the candidate-bound email
is suppressed for that window.

## Recording observability

Recording (`chat_sessions` / `chat_messages`) is best-effort and swallows errors
so a logging failure never breaks a live answer. To keep that from hiding a
broken config, `lib/ai/log-chat.ts` tags every failure with `TRANSCRIPT_RECORDING`
and emits a one-time CRITICAL log when the cause is a missing
`SUPABASE_SERVICE_ROLE_KEY`. Grep production logs for `TRANSCRIPT_RECORDING` if
transcripts ever look empty.
