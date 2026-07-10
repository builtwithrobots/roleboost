# RoleBoost TODO: complete the recruiter conversation loop

Build plan from the flagship review (the recruiter-facing personal career AI).
The brain itself is well aligned with the vision; this list closes the conversion
loop and adds polish. Ordered by leverage. No em dashes anywhere (project rule).

Source files to know:
- `components/chat/ChatPanel.tsx` (the conversation UI)
- `components/chat/ChatOverlay.tsx` (the dialog wrapper)
- `components/modal/CallingCard.tsx` (passes props into the overlay)
- `app/api/chat/route.ts` (creates the session via `ensureChatSession`)
- `lib/ai/log-chat.ts` (`ensureChatSession`, `logChatExchange`)
- `app/api/transcripts/deliver/route.ts` (emails both sides, runs gap analysis)
- `lib/email/transcript.ts` (email templates)
- `supabase/migrations/` (schema, source of truth)

---

## Codebase review fixes (July 2026 audit)

Findings from the full-codebase review (security, AI pipeline, data layer, frontend,
config). Ordered by consequence. Each item is a small, well-scoped PR unless noted.

### P0: Critical, fix before anything else

- [ ] **Paddle webhook: verify the signature and implement the handlers**
      (`app/api/webhooks/paddle/route.ts`). Today it only checks the header exists,
      never validates against `PADDLE_WEBHOOK_SECRET`, the event `switch` is empty
      (subscription status never written), and `JSON.parse` is unguarded. Anyone can
      POST forged events; when `BILLING_ENFORCED` flips, paying users get locked out.
      Mirror the Clerk webhook's structure (svix-style verify, guarded parse).
- [ ] **Defensive writes for not-yet-applied migrations.** Two writes break the whole
      save if the column is missing from the live DB:
      - `app/(candidate)/dashboard/settings/actions.ts` writes `search_discoverable`
        (20260715 migration) in the same `.update()` as `is_published`/`ai_enabled`.
      - `app/(candidate)/dashboard/profile/actions.ts` writes `secondary_target_roles`
        (20260711 migration) inside the main profile update, so every profile save fails.
      Split each new column into its own error-tolerant `.update()` (the
      `readSuspendedAt` pattern).
- [ ] **`check_rate_limit()` is still callable with the public anon key.** The
      20260709 migration revokes from `anon, authenticated` but not from `PUBLIC`,
      and Postgres grants EXECUTE to PUBLIC by default. New migration:
      `REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;`
      (founder runs it manually against the live DB).
- [ ] **Transcript emails can be lost forever.** `lib/transcripts/deliver.ts` flips
      `transcript_sent = true` before sending; a Resend failure is only logged and the
      cron sweep never retries. Reset the flag on send failure, or split into
      `claimed_at` (race exclusion) and `sent_at` (set after confirmed send).
- [ ] **Drop the anon INSERT policy on `chat_sessions`** (20260626 migration,
      `WITH CHECK (TRUE)`). With the public anon key anyone can insert junk sessions
      attributed to any candidate straight through PostgREST, bypassing every rate
      limit. All real writes use the service-role client, which does not need it.
      Review `profile_views` (same shape, analytics-only) at the same time.

### P1: High

- [ ] **Durable rate limits on the other public endpoints.** Only `/api/chat` uses
      `check_rate_limit`; `/api/chat/schedule` (sends candidate an email per call),
      `/api/chat/identify`, and `/api/transcripts/deliver` rely on WAF rules that
      no-op until published. Add `checkAppRateLimit` buckets to all three.
- [ ] **Error monitoring.** No `instrumentation.ts`, no Sentry/OTel anywhere; the
      fail-open paths (rate limiter, grounding validator) degrade silently. Add
      Sentry via `instrumentation.ts` + `onRequestError`, and log/alert when the
      fail-open catches fire.
- [ ] **First tests.** Zero test infra. Start with pure functions:
      `detectHighRiskContent` / `detectComplexQuestion` (cost + safety routing),
      the `lib/auth/entitlements.ts` truth table (pin before the billing flip),
      rate-limit fail-open behavior, prompt-builder snapshot (section order,
      custom QA above resume, no-em-dash rule present). Add a `test` script.
- [ ] **Fix the high-risk and complexity detectors** (`app/api/chat/route.ts`).
      `/\d{4}/` matches every employment year so most answers trigger an extra
      Sonnet validation call; `lean` matches inside `clean`; `prove` matches
      `improve` in the complexity router. Use word boundaries, drop or narrow the
      bare four-digit rule. Big per-conversation cost win.
- [ ] **Security headers.** `next.config.ts` has no `headers()` block: add CSP
      (report-only to start), `frame-ancestors`/`X-Frame-Options`, HSTS,
      `X-Content-Type-Options: nosniff`, and `poweredByHeader: false`. Public
      calling cards are currently clickjackable.
- [ ] **Recruiter-controlled text in the system prompt.** The identify flow's
      name/company are interpolated into `<conversation_partner>` in the system
      prompt unsanitized and persist all session. Strip newlines, cap to one line,
      frame as literal labels never instructions (`app/api/chat/route.ts`,
      `lib/ai/build-system-prompt.ts`).
- [ ] **Calling-card accessibility batch** (WCAG 2.1 AA rule):
      - `AudioPlayer` seek bar is click-only; make it a real slider with keyboard
        support (`role="slider"`, arrow keys, `aria-valuetext`).
      - `AudioPlayer`/`AssetGallery` have no error states; a failed signed URL leaves
        an infinite shimmer or dead play button. Add `onError` with a retry message.
      - Sub-44px touch targets: chat opener chips, chat header buttons, audio skip
        buttons, identify/schedule buttons.
      - `JobsTable` NewJobDialog: hand-rolled modal with no focus trap, no ESC, no
        focus return, labels not associated. Rebuild on Headless UI `Dialog`.

### P2: Medium

- [ ] **Cron guard fails open.** `lib/cron/guard.ts` returns 200-skip when
      `CRON_SECRET` is unset (routes publicly reachable AND the sweep silently never
      runs). Fail closed in production; confirm `CRON_SECRET` is set in Vercel.
- [ ] **Move authenticated callers off the service-role client.**
      `app/(employer)/dashboard/jobs/actions.ts` runs entirely on `adminClient` with
      no justifying comment (sibling `board/actions.ts` is the correct RLS template).
      Candidate dashboard pages/actions and `resume/parse` too. Keep the manual
      `.eq()` filters as defense in depth.
- [ ] **Apply `assertCandidateAiAccess` uniformly.** It gates
      `selectCareerContextAngle` and `adoptGapAnswer` but not `updateCandidateBrain`,
      `teachAiFromTranscript`, `saveContextPackage`, or hardening actions. The
      paywall will leak when billing flips. Decide the gated surface now.
- [ ] **Prompt cache placement.** The cached system prompt embeds the viewer intro
      and the meeting nudge that changes at exchange 3, invalidating the cache
      mid-session; Haiku/Sonnet switching also splits the cache. Move volatile parts
      after the breakpoint and log `usage.cache_read_input_tokens` to verify caching
      works at all.
- [ ] **Make destructive flows atomic.** `resetAiLearning` (five deletes + profile
      reset) and `deleteEverythingAndRestart` (storage first, then two fallible
      writes) can half-fail. Move each into one `SECURITY DEFINER` RPC.
- [ ] **Generate Supabase DB types** (`supabase gen types`) and kill the pervasive
      `(client.from('x') as any)` casts; restores column-name checking on writes
      (same failure class as the defensive-write bugs).
- [ ] **Migration hygiene:** add `DROP POLICY IF EXISTS` before `CREATE POLICY` in
      migrations that lack it (initial schema, ai_brain, others); renumber one of the
      two files sharing timestamp `20260707000000`.
- [ ] **Env hygiene:** add `CLERK_WEBHOOK_SECRET` to `.env.example` + CLAUDE.md; add
      a Zod-validated `lib/env.ts` loaded at startup so a missing
      `NEXT_PUBLIC_APP_URL` fails fast instead of emailing broken links.

### P3: Cleanup

- [ ] Delete `templates/` (~7 MB of unreferenced UI-kit zips); remove unused
      `@heroicons/react`; add a `typecheck` script to package.json.
- [ ] `components/chat/ChatOverlay.tsx` is dead code (nothing imports it; the card
      embeds `ChatPanel` inline). Delete it and update CLAUDE.md/docs, or wire it in.
- [ ] `ChatPanel`: abort/unmount guards on async `setState`; stable keys for the
      message list instead of index; catch `audio.play()` rejection.
- [ ] `signCallingCardAssets`: sign URLs with `Promise.all` instead of sequentially;
      extract a shared `SIGNED_URL_TTL_SECONDS` constant (literal `3600` in 5 places).
- [ ] Deduplicate: `custom_qa_pairs` normalize/cap logic (3 implementations with
      different behavior), employer-account resolution (3 variants), `getInitials`
      and stage config in employer components.
- [ ] Copy: en dashes in `ProfileEditor.tsx` and `AssetUploadCard.tsx`; literal
      em-dash placeholder glyphs in `AnalyticsDashboard.tsx` and the admin users
      table.
- [ ] Translate or document the `SUSPENDED`/`NO_ROLE` error codes that leak through
      Server Actions but are not in the documented envelope table.

---

## SEO / launch ops (manual, founder)

The SEO foundation is shipped in code (site metadata + title template, `robots.txt`,
`sitemap.xml`, generated OpenGraph/Twitter images, home `Organization`/`WebSite`
JSON-LD, canonical URLs). Candidate calling cards are `noindex` by default, with a
per-candidate "Discoverable in search" opt-in in Settings. Remaining manual steps:

- [x] Set `NEXT_PUBLIC_APP_URL=https://roleboost.app` in the Vercel production env.
- [ ] Submit `https://roleboost.app/sitemap.xml` in **Google Search Console** (and
      **Bing Webmaster Tools**). Then use Search Console's URL Inspection to request
      indexing of `/` and `/boosts` so they are picked up quickly.
- [ ] After a candidate opts into discovery, their `/c/<slug>` becomes indexable and
      is added to the sitemap automatically; no manual step needed per candidate.

---

## Legal pages / launch ops (manual, founder)

Plain-English **Privacy Policy** (`/privacy`) and **Terms of Service** (`/terms`) are
shipped and linked from the footer. They are accurate to how the product works, but
they are drafts, not legal advice. Before relying on them publicly:

- [ ] Have a lawyer review both `/privacy` and `/terms` (confirm GDPR / CCPA-CPRA
      coverage for your user base).
- [ ] Confirm the contact addresses forward to a real inbox: `privacy@roleboost.app`
      and `legal@roleboost.app`.
- [ ] Fill in specifics in Terms: your governing-law **state** (currently "the state in
      which RoleBoost is established") and your formal **legal entity** name.
- [ ] Confirm the defaults suit you: liability cap (greater of 12-month fees or $100)
      and the no-refund-by-default clause.
- [ ] Keep both pages' "Last updated" date current whenever the policy/terms change.

---

## P1: Recruiter identity capture (the material gap)

Today anonymous recruiters never receive a transcript, and the candidate's copy
cannot say who they spoke with. The deliver route only resolves an employer email
when `viewer_clerk_user_id` is set (logged-in). On a public link the recruiter is
anonymous, so half of "transcript to both sides" and most of the conversion loop
do not fire.

- [ ] **Schema:** migration adding `viewer_email TEXT` and `viewer_name TEXT` to
      `chat_sessions` (keep out of any anon read grant; writes go through the
      service-role client). `employer_company_name` already exists, reuse it.
- [ ] **Capture endpoint:** `POST /api/chat/identify` `{ sessionId, name?, email, company? }`.
      Zod-validate, service-role update of the session row. Public (no Clerk
      session), but only updates a session that exists and has no logged-in viewer.
- [ ] **UI capture (non-blocking):** in `ChatPanel` live mode, after the first
      assistant answer, show a slim inline prompt: "Want this conversation emailed
      to you?" with email + optional name/company. Submitting calls
      `/api/chat/identify`. Dismissible. Never gate the chat behind it.
- [ ] **Deliver route:** in `transcripts/deliver/route.ts`, fall back to
      `session.viewer_email` / `viewer_name` when there is no logged-in viewer, and
      use the captured company for `employer_company_name`. Email the recruiter
      their transcript.
- [ ] **Candidate transcript:** include "you spoke with {name} at {company}" when
      captured (`lib/email/transcript.ts`).
- [ ] Acceptance: an anonymous recruiter who leaves an email receives a transcript;
      the candidate's transcript names the recruiter/company; idempotency
      (`transcript_sent`) still holds; no email captured still sends the candidate
      copy as today.

## P1: End-of-conversation CTA for the recruiter

The conversation can dead-end. Give the recruiter a next step that also carries
the capture above.

- [ ] Closing CTA in `ChatPanel` / `ChatOverlay`: "Get this transcript emailed to
      you" (email field) and "Connect with {firstName}" (LinkedIn) when available.
- [ ] Thread `linkedinUrl` from `CallingCard` through `ChatOverlay` into `ChatPanel`
      (not currently passed).
- [ ] Show it after a few turns or on a visible "End and email me" action, not just
      on unmount (the beacon is fire-and-forget and easy to miss).
- [ ] Acceptance: recruiter can connect or request the transcript without leaving
      the chat.

## P2: Dynamic follow-up suggestions

Openers show only in the empty state, then engagement can stall.

- [ ] After each assistant answer, render 2 to 3 contextual follow-up chips.
- [ ] MVP: a small, cheap derivation (heuristic or a short model call) from the last
      answer; keep latency negligible and fail silently to no chips.
- [ ] Acceptance: chips appear after answers, tapping one sends it, never blocks input.

## P2: Perceived latency on hard questions

Complex questions hit Sonnet, and high-risk answers add a second Sonnet validation
pass, so the recruiter can wait several seconds behind the typing dots.

- [ ] Keep the typing indicator; consider a subtle status line for long waits.
- [ ] Evaluate streaming the non-validated fast path while keeping validated answers
      buffered. This revisits the deliberate no-streaming decision, so decide
      consciously and document the outcome in `docs/architecture/04-ai-brain.md`.
- [ ] Acceptance: no regression to grounding; waits feel responsive.

## P3: Deferred and minor

- [ ] Voice input (Whisper), the spec's Phase F. Still held; track only.
- [ ] Trust micro-polish: a small "answers are grounded in verified career data"
      tooltip near the chat input.
- [ ] Keep deflection copy in the candidate's voice (currently a static line in
      `app/api/chat/route.ts`).

---

## Out of scope here (tracked elsewhere)

- **Candidate subscription + free trial (the paywall).** The entitlement seam
  (`lib/auth/entitlements.ts`, `BILLING_ENFORCED`) is wired for a clean activation:
  candidate Paddle products, trial clock, gate the public chat + AI Studio, flip
  the flag. Its own workstream.

## Done in prior work (reference)

Career context document (generate, select, augment, evidence), brain wiring,
tabbed AI Studio, candidate education UX, two-column calling card, architecture
bible in `docs/architecture/`, em-dash removal and enforcement.
