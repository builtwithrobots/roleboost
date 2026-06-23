# Super Admin Dashboard — Build Plan & Checklist

> Owner control center for RoleBoost. Tracks platform health, growth, engagement,
> revenue, and operations — and surfaces silent failures before they cost you users.
> Gated by `users.is_admin = TRUE`. All reads via the service-role admin client.

---

## Why this exists

Today's debugging session was caused by **silent operational failures** — an invalid
Supabase service-role key, failing Clerk webhooks, and schema drift between the preview
branch and production. None of them surfaced anywhere; they were only found by reading
Vercel logs by hand. The single highest-value thing this dashboard does is make that
class of failure **visible at a glance**. Vanity metrics come second.

Design priorities, in order:
1. **Operational health** — webhooks, email, keys, errors. Catch breakage early.
2. **Activation funnel** — signup → onboarding → published → viewed → chatted.
3. **Engagement** — AI usage, the core product loop.
4. **Revenue** — Paddle subscriptions / MRR.
5. **Moderation & user ops** — search, impersonate, suspend, inspect.

---

## Recommended sections

### 1. KPI header row (always visible)
Small stat cards with current value + 7-day delta:
- Total users · candidates · employers
- Published profiles (and % of candidates published)
- AI chat sessions (this week) + transcripts sent
- Profile views (this week)
- Active subscriptions + **MRR**
- 🔴 **Open operational alerts** (webhook failures, email bounces, key errors)

### 2. Operational Health  ⭐ (the most important new capability)
- **Webhook monitor** — Clerk (`user.created/updated/deleted`) and Paddle success/failure
  counts + last failure detail. Requires a `system_events` log table (today these only
  `console.error`).
- **Email delivery** — Resend sends/bounces/failures for transcript + feedback emails.
- **External key/health checks** — last successful Supabase admin write, Anthropic API
  reachability, Paddle webhook signature failures.
- **Recent errors feed** — tail of logged server errors with context.
- **Schema/migration drift indicator** — surfaces missing expected columns/tables
  (would have caught the `is_admin` loop instantly).

### 3. Growth & Activation
- New signups over time, candidate vs employer (line chart, range-filtered).
- **Activation funnel:** signed up → completed onboarding → profile published →
  ≥1 asset uploaded → received first view → received first AI chat.
- Drop-off % at each step. This is your north-star operational chart.

### 4. AI Engagement (core product loop)
- Chat sessions/day, avg messages/session, % sessions that emailed a transcript.
- Top candidates by chat volume; most-asked question themes.
- Fine-tuning activity (candidates editing `custom_qa_pairs`, redirect-topic usage).
- **Anthropic cost/usage** — tokens + estimated $ per day (needs per-call logging).

### 5. Marketplace (employer side)
- Active employer accounts, jobs posted, saved candidates.
- Pipeline stage distribution (Saved → Screening → Interview → Offer → Passed).
- Feedback messages sent; employers by activity.

### 6. Revenue (Paddle)
- MRR + breakdown by tier (Starter / Growth / Scale).
- Subscription status mix (free / active / cancelled / past_due).
- New vs churned subscriptions over time; past-due watchlist.

### 7. Content & Assets
- Asset completion distribution (X / 6 per candidate).
- Profiles missing key assets (no audio / no resume / unpublished).
- Stale profiles (published, zero views or chats in N days).

### 8. User Management & Moderation
- Searchable/filterable users table (role, tier, status, admin, signup date).
- Per-user drill-down: profile, assets, transcripts, views, subscription.
- Actions: **impersonate/preview** (extend existing switcher), grant/revoke admin,
  suspend, delete (with cascade confirmation).
- Trust & safety: flagged content, AI answers hitting redirect topics.

### Cross-cutting
- Global **date-range filter** + manual refresh.
- **CSV export** on every table.
- Drill-down links from every metric to the underlying rows.
- Mobile-readable; WCAG 2.1 AA (per project standard).

---

## Suggested scope phasing

- **v1 (must-have):** KPI row, Operational Health, Activation funnel, User management.
  This is the "never get blindsided again" release.
- **v2:** AI Engagement, Revenue (Paddle), Marketplace.
- **v3:** Content/Assets quality, cohort retention, CSV export, trust & safety.

---

## Build Checklist

### Phase 0 — Foundations
- [ ] Confirm `is_admin` gating + `users_admin_read` policy live in **production**
      (`gsilfhywebnzlxyyzbgq`). ✅ already applied this session — verify it stays.
- [ ] Decide chart library — **Decision: Tremor** (Tailwind-native dashboard
      primitives — cards, charts, tables). Install `@tremor/react`.
- [ ] Create `app/(admin)/admin/` route group structure for sub-pages
      (overview, health, growth, ai, revenue, users).
- [ ] Add an `AdminPageHeader` consistent with the dashboard `PageHeader`.
- [ ] Shared `getAdminContext()` guard (throws if `!is_admin`).

### Phase 1 — Operational Health (highest priority)
- [ ] Migration: `system_events` table
      (`id, kind, source, severity, message, context jsonb, created_at`).
- [ ] Write to `system_events` from the **Clerk webhook** on success + failure
      (replace bare `console.error`).
- [ ] Write to `system_events` from the **Paddle webhook** (signature + processing).
- [ ] Log **Resend** send results (success/bounce/error) for transcript + feedback email.
- [ ] Log per-request failures in `ensureCandidateProfile`, `setUserRole`, admin writes.
- [ ] Health page: webhook success/fail counts (24h/7d) + last-failure detail panel.
- [ ] Health page: email delivery panel.
- [ ] Health page: "last successful admin write" + Anthropic/Paddle reachability check.
- [ ] **Schema drift check**: query `information_schema` for expected columns/tables,
      flag anything missing (catches future `is_admin`-style drift).
- [ ] Recent errors feed (latest N `system_events` of severity ≥ warning).

### Phase 2 — KPIs & Growth
- [ ] Postgres view/RPC: `admin_kpis` (counts + 7-day deltas) — keep aggregation in DB.
- [ ] KPI header card row component.
- [ ] Time-series query: signups by day, role-split.
- [ ] Activation funnel query (signup → onboarding → published → asset → view → chat).
- [ ] Funnel + signups charts with date-range filter.

### Phase 3 — User Management
- [ ] Users table: server-paginated, searchable (email), filter by role/tier/status/admin.
- [ ] Per-user drill-down page (profile, assets, transcripts, views, subscription).
- [ ] Action: grant/revoke `is_admin` (with confirm; never demote yourself by accident).
- [ ] Action: suspend user (add `users.suspended_at`; gate auth on it).
- [ ] Action: delete user (cascade preview + typed confirmation).
- [ ] Reuse/extend the existing preview/impersonate role-switcher.

### Phase 4 — AI Engagement
- [ ] Log Anthropic token usage per chat (extend `chat_sessions` or `ai_usage` table).
- [ ] Sessions/day, msgs/session, transcript-sent rate.
- [ ] Top candidates by chat volume; question-theme aggregation.
- [ ] Estimated AI spend/day.

### Phase 5 — Revenue (Paddle)
- [ ] MRR + tier breakdown from `users.subscription_*` (+ Paddle webhook truth).
- [ ] Status mix + churn over time; past-due watchlist.

### Phase 6 — Marketplace, Content, Polish
- [ ] Pipeline stage distribution; jobs + saved-candidate counts.
- [ ] Asset completion distribution; missing-asset & stale-profile lists.
- [ ] CSV export on tables.
- [ ] Trust & safety: redirect-topic hits, flagged content.
- [ ] Empty/loading/skeleton states; a11y pass.

### Cross-cutting / DX
- [ ] All admin reads via service-role client; every file documents the RLS-bypass reason.
- [ ] Heavy aggregates as Postgres views/RPC, not N+1 in the route.
- [ ] Date-range filter context shared across sub-pages.
- [ ] **Fix the migration pipeline first** so `system_events` and other tables actually
      reach production (repoint Supabase integration `aingfpepfkblqglqqlyd` →
      `gsilfhywebnzlxyyzbgq`, or adopt `supabase db push` on merge).

---

## Notes / decisions to make
- Chart lib: **Tremor** (`@tremor/react`) — decided.
- Realtime vs periodic refresh (start periodic; Supabase Realtime later if needed).
- Where to store AI token usage (denormalized on `chat_sessions` vs dedicated table).
- Retention window for `system_events` (e.g. 90 days, then prune).
