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
