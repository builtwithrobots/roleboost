# RoleBoost, AI Brain & Chatbot Architecture Snapshot

> Generated 2026-07-11 from the live working tree (branch `claude/plugin-development-q66sgp`, in sync with `main` for these files). Every piece of content below is copied verbatim from the repo and labeled with its file path. Where only part of a file is relevant, the line range is given.

## Table of Contents

1. [Orientation: how the brain works end to end](#1-orientation-how-the-brain-works-end-to-end)
2. [Database: tables, migrations, and RLS](#2-database-tables-migrations-and-rls)
3. [API routes: chat, AI responses, brain endpoints](#3-api-routes-chat-ai-responses-brain-endpoints)
4. [Prompt engineering and the core AI library (`lib/ai`)](#4-prompt-engineering-and-the-core-ai-library-libai)
5. [Fine-tuning, context accumulation, and learning over time](#5-fine-tuning-context-accumulation-and-learning-over-time)
6. [UI surfaces: chatbot, AI Studio, recruiter chat](#6-ui-surfaces-chatbot-ai-studio-recruiter-chat)
7. [Access control: Clerk middleware, entitlements, RLS inventory](#7-access-control-clerk-middleware-entitlements-rls-inventory)
8. [Spec documents and architecture docs](#8-spec-documents-and-architecture-docs)
9. [PRD.md: AI brain and chat sections](#9-prdmd-ai-brain-and-chat-sections)
10. [CLAUDE.md: AI brain and chat sections](#10-claudemd-ai-brain-and-chat-sections)
11. [Appendix: shared types and open work items](#11-appendix-shared-types-and-open-work-items)

---

## 1. Orientation: how the brain works end to end

The candidate AI ("the brain") is a single Claude API call per turn with a layered, XML-structured system prompt. There is no fine-tuned model, no embeddings, and no vector DB; "fine-tuning" in this product means candidate-curated data that is injected into the prompt with priority. The moving parts:

**Data in (the brain's memory):**
- `resume_documents.canonical_markdown`, the parsed resume as markdown (built by `lib/ai/canonical-resume.ts`, migration `20260622100000_resume_pipeline.sql`).
- Brain columns on `candidate_profiles` (migration `20260626000000_ai_brain.sql`): named career-context fields, `custom_qa_pairs` (JSONB, the candidate's refined Q&A, highest priority in the prompt), redirect topics, `ai_enabled`.
- `context_package_md` on `candidate_profiles` (migration `20260705000000_context_package.sql`), the single polished career-context document the brain reads. Produced by the Asset Package generator (Section 1 Narrative Guide Block) or uploaded externally; refreshed by the augment loop which distills (never appends) new material.
- `career_sources`, third-party evidence feeding the career-context synthesis.
- `intake_answers` + readiness columns, answers from the AI intake interview.

**Assembly:** `lib/ai/get-candidate-brain.ts` fetches everything by public slug; `lib/ai/build-system-prompt.ts` layers it into the system prompt (data near the top, rules near the bottom): role, career_information (resume markdown), context, custom_answers (priority=highest), few_shot_examples, knowledge_boundary, principles, adversarial_posture, redirect_topics, voice, reasoning_instruction.

**Serving (`app/api/chat/route.ts`, public):** complexity router picks Haiku (`CHAT_MODEL`) for simple factual questions and Sonnet (`GENERATION_MODEL`) for multi-part/adversarial/synthesis ones via a string heuristic. High-risk answers (numbers, dollars, credentials) go through a forced-tool Sonnet grounding pass (`validateAndSanitize`); ungrounded claims become an honest handoff. No token streaming (it conflicts with post-generation validation). Conversation history is rebuilt server-side from `chat_messages` (client-supplied history is a jailbreak vector); `sessionId` is verified against the candidate's profile. The system prompt carries a `cache_control` breakpoint for prompt caching. Each assistant row records `model_used` / `was_complex` / `was_validated`.

**Learning over time (all prompt-side, no model training):**
1. Custom Q&A editing in AI Studio (`custom_qa_pairs`).
2. Transcript gap loop: every delivered transcript is analyzed (`lib/ai/analyze-transcript.ts`), gaps land in `transcript_gaps` with a drafted `suggested_answer`; one-click adopt turns them into custom QA pairs (`PromptBot`, `adoptGapAnswer`).
3. Sandbox self-testing (`sandbox_sessions`) with verdicts and "strengthen field" deep links.
4. External transcript hardening (`brain_hardening_sessions`; the pasted transcript itself is never stored).
5. Intake interview (`intake_answers`) filling gaps and inconsistencies up front.
6. Career-context augment loop, re-synthesizing `context_package_md` from all newer authored material.
7. Fresh start (Settings), a full brain wipe back to a blank slate.

**Out (the transcript loop):** every recruiter chat session emails a transcript to both sides on chat close (`sendBeacon` to `/api/transcripts/deliver`, idempotent) with a cron sweep for abandoned sessions. Anonymous recruiters can self-identify (`/api/chat/identify`); when the AI cannot answer, it offers a live meeting (`/api/chat/schedule` into `meeting_requests`). The public pipeline is rate-limited via the `rate_limits` table and `check_rate_limit()` (service-role only).

**Access:** all candidate AI access flows through one seam, `lib/auth/entitlements.ts` (`assertCandidateAiAccess`), currently open (`BILLING_ENFORCED = false`) ahead of the paid AI Studio plan.

---

## 2. Database: tables, migrations, and RLS

Source of truth is `supabase/migrations/`. Migrations are applied manually by the founder (see CLAUDE.md, Database), so server code reads newly added columns defensively. Below is every migration that touches the brain, chat, conversations, messages, context, or memory, in chronological order. RLS policies live inside these same files; a cross-table policy inventory is in section 7.

#### `supabase/migrations/20260620000000_initial_schema.sql` (lines 1-56)

Relevant excerpt: the `requesting_user_id()` RLS helper, `users`, and `candidate_profiles` (the table that later gains all brain columns) with its owner + public-read policies. Employer tables omitted as unrelated.

````sql
-- Function to extract Clerk user ID from JWT sub claim
CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT auth.jwt() ->> 'sub';
$$;

-- Users (all roles share this table)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('candidate', 'employer')),
  email TEXT NOT NULL,
  paddle_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'cancelled', 'past_due')),
  subscription_tier TEXT
    CHECK (subscription_tier IN ('basic', 'pro', 'starter', 'growth', 'scale')),
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
  slug TEXT NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9-]+$'),
  full_name TEXT NOT NULL,
  headline TEXT CHECK (char_length(headline) <= 200),
  target_role TEXT,
  location TEXT,
  linkedin_url TEXT,
  summary_bullets TEXT[] DEFAULT '{}',
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
````


#### `supabase/migrations/20260620000000_initial_schema.sql` (lines 211-231)

Relevant excerpt: `profile_views` (chat/view analytics surface reads it alongside `chat_sessions`).

````sql
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
      SELECT id FROM candidate_profiles
      WHERE clerk_user_id = requesting_user_id()
    )
  );
CREATE POLICY profile_views_insert ON profile_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);
````


#### `supabase/migrations/20260622100000_resume_pipeline.sql`

`resume_documents` with `canonical_markdown`, the resume text the brain actually reads (there is no `resume_text` column in active use).

````sql
-- Resume → ATS pipeline.
--
-- resume_documents holds the canonical structured résumé (JSON) + its editable
-- Markdown source, and links to the generated .docx / .pdf candidate_assets rows.
-- Kept in a separate table (not columns on candidate_profiles) to keep the large
-- JSON/markdown off the hot profile row and to support multiple variants later.

CREATE TABLE IF NOT EXISTS resume_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  source_asset_id UUID REFERENCES candidate_assets(id) ON DELETE SET NULL,
  canonical_json JSONB NOT NULL DEFAULT '{}',
  canonical_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'ready', 'approved')),
  docx_asset_id UUID REFERENCES candidate_assets(id) ON DELETE SET NULL,
  pdf_asset_id UUID REFERENCES candidate_assets(id) ON DELETE SET NULL,
  derived_suggestions JSONB,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active résumé document per candidate for now (Phase 4 relaxes this for variants).
CREATE UNIQUE INDEX IF NOT EXISTS resume_documents_one_per_profile
  ON resume_documents(candidate_profile_id);

ALTER TABLE resume_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resume_documents_owner ON resume_documents;
CREATE POLICY resume_documents_owner ON resume_documents
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());

-- Extend the asset_type CHECK to allow the generated ATS .docx (resume_docx).
-- Also fixes the pre-existing gap: 'debate_audio' is used in app code but was
-- missing from the original constraint.
ALTER TABLE candidate_assets DROP CONSTRAINT IF EXISTS candidate_assets_asset_type_check;
ALTER TABLE candidate_assets
  ADD CONSTRAINT candidate_assets_asset_type_check
  CHECK (asset_type IN ('audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume', 'resume_docx'));
````


#### `supabase/migrations/20260622200000_additional_context.sql`

Freeform "Additional Context" pitch column on the profile, one of the context fields fed to the prompt.

````sql
-- Optional freeform "Additional Context" pitch on the candidate profile.
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS additional_context TEXT
  CHECK (additional_context IS NULL OR char_length(additional_context) <= 2000);
````


#### `supabase/migrations/20260626000000_ai_brain.sql`

THE core migration: brain columns on `candidate_profiles`, `chat_sessions`, `chat_messages`, RLS for both, and the anon-role explicit column grant that keeps brain material private.

````sql
-- AI Brain -- Phase A.
--
-- Adds the candidate "brain" context fields that feed the career-AI system
-- prompt, plus the chat_sessions / chat_messages tables that log every recruiter
-- conversation. Resume text is NOT duplicated here -- it is sourced from
-- resume_documents.canonical_markdown at prompt-build time.
--
-- Security note: candidate_profiles has a public-read RLS policy for the anon
-- role (is_published = TRUE), which exposes every granted column of a published
-- row. Several of the new fields are sensitive (honest weaknesses, departure
-- reasons, refined answers) and must never be scrapeable by an anonymous client.
-- This migration therefore narrows the anon role's column grants to the
-- public-safe set only. The chat path reads the full brain server-side via the
-- service-role client, so restricting anon does not affect the chatbot.

-- 1. Brain context fields on candidate_profiles --------------------------------
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS leadership_philosophy TEXT,
  ADD COLUMN IF NOT EXISTS key_wins TEXT,
  ADD COLUMN IF NOT EXISTS departure_reasons TEXT,
  ADD COLUMN IF NOT EXISTS biggest_challenge TEXT,
  ADD COLUMN IF NOT EXISTS ideal_environment TEXT,
  ADD COLUMN IF NOT EXISTS manager_needs TEXT,
  ADD COLUMN IF NOT EXISTS honest_weaknesses TEXT,
  ADD COLUMN IF NOT EXISTS wish_questions TEXT,
  ADD COLUMN IF NOT EXISTS custom_qa_pairs JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS redirect_topics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Narrow anon column access ------------------------------------------------
-- Replace the anon role's table-wide SELECT with an explicit safe-column grant.
-- The sensitive brain columns are intentionally omitted, so an anonymous client
-- can never read them even on a published profile. RLS (public_read) still gates
-- which rows are visible; this gates which columns. The authenticated role is
-- untouched -- candidates read their own full row in the dashboard, and the
-- owner RLS policy already scopes that to their own profile only.
REVOKE SELECT ON candidate_profiles FROM anon;
GRANT SELECT (
  id,
  clerk_user_id,
  slug,
  full_name,
  headline,
  target_role,
  location,
  linkedin_url,
  summary_bullets,
  additional_context,
  is_published,
  ai_enabled,
  created_at,
  updated_at
) ON candidate_profiles TO anon;

-- 3. Chat sessions ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  viewer_clerk_user_id TEXT REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  employer_account_id UUID REFERENCES employer_accounts(id) ON DELETE SET NULL,
  employer_company_name TEXT,
  is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  transcript_sent BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Candidate can read sessions on their own profile.
CREATE POLICY chat_sessions_candidate_read ON chat_sessions
  FOR SELECT TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Employer team members can read sessions tied to their account.
CREATE POLICY chat_sessions_employer_read ON chat_sessions
  FOR SELECT TO authenticated
  USING (
    employer_account_id IN (
      SELECT employer_account_id FROM employer_members WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Anonymous recruiters start sessions from the public modal. The write path uses
-- the service-role client, but this policy keeps the door open for future
-- client-side inserts without weakening read isolation above.
CREATE POLICY chat_sessions_insert ON chat_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS chat_sessions_candidate_profile_id_idx
  ON chat_sessions(candidate_profile_id);

-- 4. Chat messages ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Messages are readable by the candidate who owns the profile or the employer
-- team on the session. Inserts run via the service-role client.
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

CREATE INDEX IF NOT EXISTS chat_messages_chat_session_id_idx
  ON chat_messages(chat_session_id);
````


#### `supabase/migrations/20260627000000_chat_message_model_tracking.sql`

Per-turn tracking columns: `model_used`, `was_complex`, `was_validated`.

````sql
-- Phase B -- model + validation tracking on chat turns.
--
-- The complexity router escalates adversarial / multi-part questions from Haiku
-- to Sonnet; the post-generation validation pass runs on answers that contain
-- numbers or credential claims. These columns record both, for analytics. They
-- are populated on the assistant turn (the generated message); the user turn
-- leaves them at their defaults.

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS was_complex BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS was_validated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chat_messages.model_used IS
  'claude-haiku-4-5-20251001 or claude-sonnet-4-6 -- which model generated this assistant turn';
COMMENT ON COLUMN chat_messages.was_complex IS
  'true if the complexity router escalated this question to Sonnet';
COMMENT ON COLUMN chat_messages.was_validated IS
  'true if the post-generation validation pass ran on this response';
````


#### `supabase/migrations/20260628000000_sandbox_sessions.sql`

Candidate self-test sessions for the brain.

````sql
-- Phase C -- sandbox self-testing.
--
-- Every time a candidate runs one of their own AI's answers through the sandbox
-- analyzer, the verdict + coaching is stored here. Used for the per-answer
-- analysis card, the full-diagnostic report, and the lightweight pattern signal
-- (a category that keeps producing weak/hallucinated answers). Owner-scoped --
-- this is the candidate's private practice data, never recruiter-facing.

CREATE TABLE IF NOT EXISTS sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_category TEXT NOT NULL,
  ai_answer TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('strong', 'adequate', 'weak', 'hallucinated')),
  diagnosis TEXT NOT NULL,
  prescription TEXT NOT NULL,
  brain_field_target TEXT,
  expansion_prompt TEXT,
  pattern_signal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sandbox_sessions_owner ON sandbox_sessions
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS sandbox_sessions_profile_created_idx
  ON sandbox_sessions(candidate_profile_id, created_at DESC);
````


#### `supabase/migrations/20260629000000_intake.sql`

AI intake-interview answers + brain readiness columns.

````sql
-- Phase D -- AI intake interview.
--
-- The document-aware, multi-pass interview that builds the brain. Raw answers are
-- stored in intake_answers; they are then synthesized into the candidate_profiles
-- brain fields (one source of truth, editable in AI Studio). The new profile
-- columns track interview progress + the brain-readiness score. None of these are
-- granted to the anon role (the Phase A migration grants anon only the public-safe
-- column set), so intake data is never exposed on the public profile.

CREATE TABLE IF NOT EXISTS intake_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  answer_source TEXT NOT NULL DEFAULT 'typed' CHECK (answer_source IN ('typed', 'voice')),
  pass_number INTEGER NOT NULL CHECK (pass_number IN (1, 2, 3)),
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE intake_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY intake_answers_owner ON intake_answers
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS intake_answers_profile_idx
  ON intake_answers(candidate_profile_id, pass_number);

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS intake_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS intake_pass1_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_pass2_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_pass3_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brain_readiness_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inconsistencies_found JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS inconsistencies_resolved JSONB NOT NULL DEFAULT '[]';
````


#### `supabase/migrations/20260630000000_transcript_gaps.sql`

Gaps mined from delivered transcripts, the transcript-to-brain learning loop.

````sql
-- Phase E2 -- transcript-to-brain gap loop.
--
-- After each recruiter conversation, the transcript is analyzed against the brain
-- and any gaps (deflections, weak answers, uncovered topics) are stored here. The
-- prompt bot surfaces them to the candidate as targeted expansion prompts. Owner-
-- scoped; never granted to anon.

CREATE TABLE IF NOT EXISTS transcript_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  question_asked TEXT NOT NULL,
  chatbot_answer TEXT NOT NULL,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('deflection', 'weak', 'new_topic')),
  suggested_prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  is_addressed BOOLEAN NOT NULL DEFAULT FALSE,
  pattern_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transcript_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY transcript_gaps_owner ON transcript_gaps
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS transcript_gaps_open_idx
  ON transcript_gaps(candidate_profile_id, is_addressed, created_at DESC);
````


#### `supabase/migrations/20260701000000_brain_hardening.sql`

External-transcript hardening runs (the transcript itself is never stored).

````sql
-- Phase E3 -- external transcript hardening.
--
-- Candidates paste or upload a real conversation transcript (a recruiter screen,
-- a practice session with another AI, interview-debrief notes) and the platform
-- analyzes it against their brain to produce a prioritized hardening plan. The
-- raw transcript is processed in-request and NEVER stored -- only the resulting
-- plan + counts land here. Owner-scoped; never granted to anon.

CREATE TABLE IF NOT EXISTS brain_hardening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  transcript_source TEXT NOT NULL CHECK (transcript_source IN ('paste', 'file')),
  source_context TEXT,
  questions_found INTEGER NOT NULL DEFAULT 0,
  gaps_identified INTEGER NOT NULL DEFAULT 0,
  gaps_addressed INTEGER NOT NULL DEFAULT 0,
  hardening_plan JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reanalyzed_at TIMESTAMPTZ
);

ALTER TABLE brain_hardening_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY hardening_sessions_owner ON brain_hardening_sessions
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS brain_hardening_sessions_recent_idx
  ON brain_hardening_sessions(candidate_profile_id, created_at DESC);
````


#### `supabase/migrations/20260702000000_career_sources.sql`

Third-party sources feeding career-context synthesis.

````sql
-- Career Sources.
--
-- External career material a candidate brings in (LinkedIn / Indeed / GitHub /
-- performance reviews / recommendations) by upload or paste. Persisted as
-- extracted text and fed into the AI brain as additional grounding -- for brain
-- assembly, recruiter-question generation, and cross-source discrepancy checks
-- in the intake interview.
--
-- This is a TEXT INPUT to the brain, not a displayable asset, so it is a sibling
-- of resume_documents (NOT candidate_assets, which holds recruiter-facing media
-- served via signed URLs). We store only the extracted text, never the original
-- binary (mirrors the résumé-parse and transcript-hardening precedents).
--
-- Security: extracted_text is private brain material. Like intake/brain data it
-- is NEVER granted to the anon role -- only the owner reads it, via the
-- authenticated RLS client. The chat/intake paths read it server-side.

CREATE TABLE IF NOT EXISTS career_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('linkedin', 'indeed', 'github', 'portfolio', 'review', 'recommendation', 'other')),
  label TEXT NOT NULL,
  ingest_method TEXT NOT NULL CHECK (ingest_method IN ('upload', 'paste', 'link')),
  extracted_text TEXT NOT NULL DEFAULT '',
  char_count INTEGER NOT NULL DEFAULT 0,
  source_url TEXT,
  file_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE career_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_sources_owner ON career_sources;
CREATE POLICY career_sources_owner ON career_sources
  FOR ALL TO authenticated
  USING (clerk_user_id = requesting_user_id())
  WITH CHECK (clerk_user_id = requesting_user_id());

CREATE INDEX IF NOT EXISTS career_sources_profile_idx
  ON career_sources(candidate_profile_id, is_active);
````


#### `supabase/migrations/20260705000000_context_package.sql`

The single `context_package_md` slot, the active career-context document the brain reads.

````sql
-- Asset Package -- the candidate's career-context Markdown document.
--
-- A polished, single-file context doc (generated externally for now -- e.g. a
-- Fiverr service / Claude skill) that the candidate uploads to RoleBoost to
-- store, download, and reuse (NotebookLM source, AI chat context, etc.). Stored
-- as text on the profile; private (not granted to anon). A future one-time
-- roleboost.app charge will gate generation/download.

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS context_package_md TEXT,
  ADD COLUMN IF NOT EXISTS context_package_updated_at TIMESTAMPTZ;
````


#### `supabase/migrations/20260706000000_career_context_drafts.sql`

Two-angle draft staging for self-serve career-context generation. NOTE: retired by the 20260714 asset_package migration (column left in place, no longer read or written).

````sql
-- Career Context Document -- self-serve generation staging.
--
-- The candidate can generate their career-context document in-app (the RoleBoost
-- Candidate Asset Production Skill, Section 1 only) from their résumé + career
-- sources. The generator produces TWO narrative angles; the candidate picks one,
-- whose rendered markdown becomes the active context_package_md (added in the
-- 20260705 migration). This column stages both angles + the selection so the
-- candidate can switch angles later without regenerating.
--
-- Security: this is private brain material. candidate_profiles narrows the anon
-- role to an explicit safe-column grant (see the 20260626 ai_brain migration), so
-- columns added afterwards -- including this one and context_package_md -- are
-- already unreadable by anon. No grant change is required here; the chat/studio
-- paths read it server-side via the authenticated or service-role client.

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS career_context_drafts JSONB;
````


#### `supabase/migrations/20260707000000_meeting_requests.sql`

Recruiter-requested live conversations, created from inside the chat.

````sql
-- Meeting requests.
--
-- When the candidate's Personal Assistant cannot answer a recruiter's question,
-- it offers to schedule a live conversation. The recruiter submits a couple of
-- availability ranges plus their email from the chat; that lands here for the
-- candidate to action. Inserts come from the public chat via the service-role
-- client (the recruiter is anonymous); the candidate reads/updates their own.

CREATE TABLE IF NOT EXISTS meeting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  recruiter_email TEXT NOT NULL,
  recruiter_name TEXT,
  availability TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'responded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

-- The candidate who owns the profile can read and manage their own requests.
DROP POLICY IF EXISTS meeting_requests_owner ON meeting_requests;
CREATE POLICY meeting_requests_owner ON meeting_requests
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  )
  WITH CHECK (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

-- Recruiter submissions are inserted via the service-role client (bypasses RLS),
-- so no anon insert policy is granted here.

CREATE INDEX IF NOT EXISTS meeting_requests_profile_idx
  ON meeting_requests(candidate_profile_id, created_at DESC);
````


#### `supabase/migrations/20260708000000_meeting_request_statuses.sql`

Status workflow for meeting requests.

````sql
-- Meeting request status pipeline.
--
-- Expand the two-state status (new / responded) into a lightweight inbound
-- pipeline so the candidate can track where each request stands:
--   new -> contacted -> scheduled -> closed
-- Existing 'responded' rows map to 'closed'.

ALTER TABLE meeting_requests DROP CONSTRAINT IF EXISTS meeting_requests_status_check;

UPDATE meeting_requests SET status = 'closed' WHERE status = 'responded';

ALTER TABLE meeting_requests ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE meeting_requests
  ADD CONSTRAINT meeting_requests_status_check
  CHECK (status IN ('new', 'contacted', 'scheduled', 'closed'));
````


#### `supabase/migrations/20260709000000_rate_limits.sql`

Fixed-window anti-spam counters + `check_rate_limit()` guarding the public chat pipeline (service-role only).

````sql
-- Abuse control: a shared fixed-window rate-limit counter.
--
-- Backs the anti-spam layer on the public chat pipeline (/api/chat,
-- /api/transcripts/deliver, /api/chat/schedule) and the per-candidate
-- transcript-email cap. Keyed by an opaque bucket string (ip:route,
-- session:id, transcript-email:profile, ...). Written only by the
-- service-role client via check_rate_limit(); never exposed to anon or
-- authenticated roles.

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (which bypasses RLS) touches this
-- table, and only through the function below. Lock the table down explicitly.
REVOKE ALL ON rate_limits FROM anon, authenticated;

-- Atomically records a hit against a bucket and returns whether the caller is
-- still within the limit. Fixed-window: the window resets once window_start
-- ages past p_window_seconds. Returns TRUE when the request is allowed.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limits (bucket_key, window_start, count)
  VALUES (p_key, NOW(), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET count = CASE
          WHEN rate_limits.window_start < NOW() - make_interval(secs => p_window_seconds)
            THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < NOW() - make_interval(secs => p_window_seconds)
            THEN NOW()
          ELSE rate_limits.window_start
        END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- Only the service-role client may execute the limiter.
REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
````


#### `supabase/migrations/20260710000000_recruiter_identity.sql`

Anonymous recruiter self-identification on chat sessions (name/email), so both sides get transcripts.

````sql
-- Optional recruiter self-identification on a chat session.
--
-- Anonymous recruiters can (optionally, never required) share who they are so
-- the candidate knows who reached out and can follow up, and so the recruiter
-- gets their own copy of the transcript by email. Company reuses the existing
-- employer_company_name column. Written via the service-role client from the
-- public /api/chat/identify endpoint.

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS recruiter_name TEXT;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS recruiter_email TEXT;
````


#### `supabase/migrations/20260711000000_secondary_target_roles.sql`

Secondary target roles, brain/profile context.

````sql
-- Secondary target roles: additional roles the candidate is open to, beyond
-- their single primary target_role. Populated from the AI role recommendations
-- ("Use" adds one here) and surfaced to the chat AI as context, so it can speak
-- to a fitting opportunity a recruiter raises.

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS secondary_target_roles TEXT[] NOT NULL DEFAULT '{}';
````


#### `supabase/migrations/20260712000000_gap_suggested_answer.sql`

AI-drafted suggested answer on transcript gaps (one-click adopt in PromptBot).

````sql
-- One-click learning for the transcript-gap loop.
--
-- The gap analyzer now drafts a ready-to-approve answer (grounded only in the
-- brain's existing data) alongside the expansion prompt. The candidate approves
-- it with one click and it lands in custom_qa_pairs. NULL when the brain lacks
-- the substance to draft from (the candidate must write it themselves).
-- Same sensitivity as the sibling columns; owner-scoped via the existing RLS
-- policy, never granted to anon.

ALTER TABLE transcript_gaps ADD COLUMN IF NOT EXISTS suggested_answer TEXT;
````


#### `supabase/migrations/20260713000000_transcript_archive.sql`

Candidate-side conversation memory management: archive + permanent delete.

````sql
-- Transcript archive + candidate management of their own conversation records.
--
-- Candidates can archive a reviewed conversation (soft state via archived_at)
-- and permanently delete it only from the archive (chat_messages cascade on the
-- session delete). The answers a candidate teaches from a transcript live
-- independently on candidate_profiles.custom_qa_pairs, so deleting a transcript
-- never removes training, deliberately: tidying the inbox must not weaken the AI.
--
-- Reads were already covered by chat_sessions_candidate_read. These add owner-
-- scoped UPDATE (for archived_at) and DELETE so the authenticated request client
-- can manage a candidate's own sessions under RLS, no service-role bypass.

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE POLICY chat_sessions_candidate_update ON chat_sessions
  FOR UPDATE TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  )
  WITH CHECK (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE POLICY chat_sessions_candidate_delete ON chat_sessions
  FOR DELETE TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );

CREATE INDEX IF NOT EXISTS chat_sessions_archived_idx
  ON chat_sessions(candidate_profile_id, archived_at);
````


#### `supabase/migrations/20260714000000_asset_package.sql`

The asset-package staging column whose chosen perspective renders the active `context_package_md`; documents the retirement of `career_context_drafts`.

````sql
-- Asset Package -- the candidate's full career asset package (self-serve, in-app).
--
-- The AI Studio "Asset Package" tab runs the RoleBoost Candidate Asset Production
-- Skill in full (Section 1 Narrative Guide Block + Section 2, two narrative
-- perspectives each with four ready-to-run NotebookLM prompts: Deep Dive, Brief,
-- Infographic, Short Video), strategized toward a target role + optional job
-- description. The generator produces TWO perspectives; the candidate chooses one,
-- whose Section 1 renders to the active context_package_md (the single slot the
-- chat brain reads, added in the 20260705 migration). This column stages the whole
-- package + which perspective is chosen so it can be re-shown, downloaded, and
-- re-geared without regenerating.
--
-- This replaces the retired career_context_drafts staging column (left in place,
-- no longer read or written).
--
-- Security: private brain material. candidate_profiles narrows the anon role to an
-- explicit safe-column grant (see the 20260626 ai_brain migration), so columns
-- added afterwards -- including this one -- are already unreadable by anon. No
-- grant change is required here; the studio path reads/writes it server-side via
-- the authenticated client (RLS-scoped to the owner).

ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS asset_package JSONB;
````


---

## 3. API routes: chat, AI responses, brain endpoints

All public chat-pipeline routes (`/api/chat`, `/api/chat/identify`, `/api/chat/schedule`, `/api/transcripts/deliver`) are listed as public in `middleware.ts` (section 7) and are abuse-controlled by `check_rate_limit()`. Everything candidate-facing goes through `getUserContext()` + `assertCandidateAiAccess`.

#### `app/api/chat/route.ts`

The chat endpoint: session verification, server-rebuilt history, complexity router, high-risk detection, forced-tool grounding validation, honest-handoff fallback, per-turn model tracking.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { anthropic } from '@/lib/ai/client';
import { CHAT_MODEL, GENERATION_MODEL } from '@/lib/ai/models';
import { buildCandidateSystemPrompt, REDIRECT_SENTINEL } from '@/lib/ai/build-system-prompt';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { ensureChatSession, logChatExchange } from '@/lib/ai/log-chat';
import { resolveEmployerViewer } from '@/lib/employer/resolve-viewer';
import { adminClient } from '@/lib/supabase/admin';
import { checkAppRateLimit } from '@/lib/security/rate-limit';
import { checkRateLimit } from '@vercel/firewall';
import { checkBotId } from 'botid/server';
import type { CandidateBrain } from '@/lib/types';

// Node runtime: the Anthropic SDK and service-role logging need Node APIs.
// This route is intentionally open to anonymous recruiters -- no Clerk session
// is required (CLAUDE.md reserves /api for callers without a Clerk session).
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_HISTORY = 20;

// ── App-level interaction caps ─────────────────────────────────────────────────
// Durable, DB-backed ceilings that bound token burn regardless of the Vercel WAF
// (which is per-region and no-ops until its dashboard rule is published). Two
// dimensions, both generous enough that a real recruiter never trips them, both
// fail-open (an infra blip never blocks a live conversation), owner previews
// exempt. Backed by check_rate_limit() (lib/security/rate-limit.ts).
//   - Per chat: caps one conversation. A fresh chat resets it (the client offers
//     a one-tap restart), so a genuine long conversation is never dead-ended.
//   - Per IP: caps one source across all conversations, so a single-machine flood
//     is bounded even with no WAF rule configured. Set high enough to clear a
//     shared office IP (corporate NAT) while still stopping a script.
const MAX_MESSAGES_PER_CHAT = 40; // per hour, per session
const MAX_MESSAGES_PER_IP = 100; // per hour, per source IP

// After this many completed exchanges, the assistant begins gently inviting the
// recruiter to continue live with the candidate (conversion loop + soft throttle).
// Set to fire once the AI has proven its value (a few good answers) but before the
// recruiter feels done: earlier reads as pushy, later risks them leaving unbooked.
const NUDGE_AFTER_EXCHANGES = 3;

const ChatInput = z.object({
  candidateSlug: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
  // Optional recruiter self-introduction, captured before the first message.
  visitor: z
    .object({
      name: z.string().max(120).optional(),
      company: z.string().max(160).optional(),
      email: z.string().email().max(200).optional().or(z.literal('')),
    })
    .optional(),
  // Accepted for backward compatibility but IGNORED: history is rebuilt
  // server-side from chat_messages. A client-supplied history is untrusted --
  // fabricated assistant turns could plant "facts" the grounding rules would
  // then treat as conversation context.
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(MAX_HISTORY)
    .optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Expected JSON body' } },
      { status: 400 },
    );
  }

  const parsed = ChatInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', details: parsed.error.issues } },
      { status: 400 },
    );
  }
  const { candidateSlug, message, sessionId: claimedSessionId, visitor } = parsed.data;
  const visitorName = visitor?.name?.trim() || null;
  const visitorCompany = visitor?.company?.trim() || null;
  const visitorEmail = (visitor?.email || '').trim() || null;

  // ── Abuse control ──────────────────────────────────────────────────────────
  // Edge rate limit (Vercel WAF) runs before the expensive brain load and up-to-
  // three Anthropic calls, so a flood is blocked before it costs compute.
  // Defaults to a per-IP bucket. No-ops until the matching WAF rule ("chat") is
  // published, so it is safe to ship ahead of it.
  // Recommended rule: 30 requests / 60s per IP (see docs/architecture/11-anti-spam.md).
  try {
    const { rateLimited } = await checkRateLimit('chat', { request: req });
    if (rateLimited) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many messages just now. Please slow down and try again shortly.' } },
        { status: 429 },
      );
    }
  } catch (e) {
    // Fail-open: a limiter error must never block a real recruiter.
    console.error('chat: rate limit check failed', e);
  }

  const brain = await getCandidateBrainBySlug(candidateSlug);
  if (!brain || !brain.aiEnabled) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Profile not found or AI is disabled' } },
      { status: 404 },
    );
  }

  // Recruiters are anonymous and may only chat with published profiles. The
  // owner (authenticated) can preview their own AI before publishing.
  const { userId } = await auth();
  const isOwner = !!userId && userId === brain.ownerClerkUserId;
  if (!brain.isPublished && !isOwner) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Profile not found or AI is disabled' } },
      { status: 404 },
    );
  }

  // Bot check (Vercel BotID). Invisible for real recruiters; blocks automated
  // clients (Playwright/Puppeteer, scrapers). Skipped for the owner previewing
  // their own AI. Basic tier is free and active once deployed on Vercel; local
  // dev always reports not-a-bot. Fail-open on any error so a misconfiguration
  // never breaks the chat.
  if (!isOwner) {
    try {
      const verification = await checkBotId();
      if (verification.isBot) {
        return NextResponse.json(
          { error: { code: 'BOT_CHECK_FAILED', message: 'Could not verify you are human. Please reload and try again.' } },
          { status: 403 },
        );
      }
    } catch (e) {
      console.error('chat: botid check failed', candidateSlug, e);
    }
  }

  // Attribute a signed-in recruiter to their employer account/company, so the
  // candidate sees a real name and the employer transcripts view is populated.
  const employerViewer =
    userId && !isOwner ? await resolveEmployerViewer(userId) : null;

  // ── Session verification + server-side history ────────────────────────────
  // The sessionId is client-supplied, so it must be proven to belong to THIS
  // candidate before anything reads from or writes to it; a mismatched id is
  // treated as absent (a fresh session gets created at logging time).
  // Conversation history is rebuilt from chat_messages rather than trusted from
  // the client, so a fabricated assistant turn can never enter the prompt.
  let sessionId: string | undefined;
  let sessionIntro: { name: string | null; company: string | null } | null = null;
  if (claimedSessionId) {
    const { data: sess } = await (adminClient.from('chat_sessions') as any)
      .select('id, recruiter_name, employer_company_name, candidate_profile_id')
      .eq('id', claimedSessionId)
      .eq('candidate_profile_id', brain.candidateProfileId)
      .maybeSingle();
    if (sess) {
      sessionId = sess.id as string;
      const name = (sess.recruiter_name as string | null)?.trim() || null;
      const company = (sess.employer_company_name as string | null)?.trim() || null;
      if (name || company) sessionIntro = { name, company };
    }
  }

  let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  if (sessionId) {
    // Both rows of an exchange are bulk-inserted with the same created_at, so
    // 'role' breaks the tie: descending created_at + ascending role puts the
    // assistant row first within a pair, which the reverse() below flips back
    // to user-before-assistant in chronological order.
    const { data: rows } = await (adminClient.from('chat_messages') as any)
      .select('role, content')
      .eq('chat_session_id', sessionId)
      .order('created_at', { ascending: false })
      .order('role', { ascending: true })
      .limit(MAX_HISTORY);
    conversationHistory = ((rows ?? []) as { role: 'user' | 'assistant'; content: string }[])
      .reverse()
      // The API requires alternating turns starting with 'user'; a partially
      // logged exchange could leave an assistant row first after the window cut.
      .filter((m, i, arr) => (i === 0 ? m.role === 'user' : m.role !== arr[i - 1].role));
  }

  // ── Interaction caps ───────────────────────────────────────────────────────
  // Bound token burn on the two dimensions the WAF can't durably express: a
  // single conversation and a single source IP. Both fail-open and both skip the
  // owner's own preview. A tripped cap returns a graceful, in-thread assistant
  // message (never an HTTP error), so the recruiter always has a next step: the
  // per-chat cap offers a restart; the per-IP cap offers a follow-up.
  const firstName = brain.candidate.full_name.split(' ')[0] || brain.candidate.full_name;
  if (!isOwner) {
    // Per-conversation cap first: a fresh chat resets it, so a heavy but genuine
    // single conversation gets the restart path rather than the harder IP wall.
    if (sessionId) {
      const withinChat = await checkAppRateLimit(`chat-session:${sessionId}`, MAX_MESSAGES_PER_CHAT, 3600);
      if (!withinChat) {
        return NextResponse.json({
          answer: `We've covered a lot of ground in this conversation. You can start a fresh chat to keep exploring, or leave your email and ${firstName} will follow up with you directly.`,
          sessionId,
          offerSchedule: true,
          degraded: 'session_limit',
        });
      }
    }

    // Per-source cap: bounds a single-machine flood even with no WAF rule live.
    const ip = getClientIp(req);
    if (ip) {
      const withinIp = await checkAppRateLimit(`chat-ip:${ip}`, MAX_MESSAGES_PER_IP, 3600);
      if (!withinIp) {
        return NextResponse.json({
          answer: `You've sent a lot of messages in a short time, so ${firstName}'s assistant is taking a brief pause. Please try again in a little while, or leave your email and ${firstName} will follow up with you directly.`,
          sessionId: sessionId ?? null,
          offerSchedule: true,
          degraded: 'rate_limited',
        });
      }
    }
  }

  // If the recruiter introduced themselves, the assistant addresses them by
  // name. Prefer the intro carried on this (first) message; otherwise the one
  // recorded on the verified session; otherwise fall back to a signed-in
  // employer's company. No intro -> generic greeting.
  let chatViewer: { name?: string | null; company?: string | null } | null = null;
  if (visitorName || visitorCompany) {
    chatViewer = { name: visitorName, company: visitorCompany };
  } else if (sessionIntro) {
    chatViewer = sessionIntro;
  } else if (employerViewer?.employerCompanyName) {
    chatViewer = { name: null, company: employerViewer.employerCompanyName };
  }

  // ── Meeting-invitation nudge ────────────────────────────────────────────────
  // Once a conversation has run several exchanges deep, the assistant starts
  // warmly (and occasionally) inviting the recruiter to continue live with the
  // candidate. This is the conversion loop AND a soft, on-brand throttle: most
  // recruiters convert or wind down well before the 40/hr abuse cap. The invite
  // is woven into the model's own answer (relatable on any model), never scripted,
  // and never replaces a real answer. Owner previews never get nudged.
  const priorExchanges = conversationHistory.filter((m) => m.role === 'user').length;
  const meetingInvitation: 'none' | 'gentle' =
    !isOwner && priorExchanges >= NUDGE_AFTER_EXCHANGES ? 'gentle' : 'none';

  const systemPrompt = buildCandidateSystemPrompt(
    brain.candidate,
    brain.resumeMarkdown,
    brain.careerContextMarkdown,
    chatViewer,
    meetingInvitation,
  );

  // ── Complexity router ──────────────────────────────────────────────────────
  // Adversarial / multi-part / synthesis questions go to Sonnet for better
  // reasoning; everything else stays on Haiku. Fast string heuristic, no API call.
  const wasComplex = detectComplexQuestion(message);
  const model = wasComplex ? GENERATION_MODEL : CHAT_MODEL;

  let answer = '';
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 500,
      // The brain (resume + context doc + custom answers) is stable for the
      // whole session, so a cache breakpoint here makes every turn after the
      // first read the prompt at ~0.1x price with lower latency.
      system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
      messages: [
        ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: message },
      ],
    });
    // Guard the block type rather than blind-indexing content[0].
    const textBlock = response.content.find((b) => b.type === 'text');
    if (textBlock && textBlock.type === 'text') answer = textBlock.text.trim();
    // A max_tokens cutoff would otherwise end mid-sentence; trim back to the
    // last completed sentence so the recruiter never sees a broken reply.
    if (response.stop_reason === 'max_tokens') {
      answer = trimToLastSentence(answer);
    }
  } catch (e) {
    console.error('chat: generation failed', candidateSlug, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Chat generation failed' } },
      { status: 500 },
    );
  }

  if (!answer) {
    answer = "I'm sorry, I couldn't answer that just now. Please try asking again.";
  }

  // ── Post-generation validation ─────────────────────────────────────────────
  // Only runs when the answer asserts a specific number, figure, or credential.
  // Confirms each claim traces back to the brain; if not, swaps in a safe,
  // natural deflection. Fail-safe: any error returns the original answer.
  let wasValidated = false;
  if (detectHighRiskContent(answer)) {
    wasValidated = true;
    answer = await validateAndSanitize(
      answer,
      brain.candidate,
      brain.resumeMarkdown,
      brain.careerContextMarkdown,
    );
  }

  // ── Honest redirect ────────────────────────────────────────────────────────
  // When the assistant cannot answer from the candidate's information (or the
  // grounding validator rejected an unsupported figure), the model emits the
  // sentinel. A small Haiku call writes a natural handoff that acknowledges the
  // specific question (stating no facts), so repeated deflections don't read as
  // the same canned paragraph; the scripted message is the fallback. The client
  // is told to offer scheduling. No plausible-but-unsupported answer ever
  // reaches the recruiter.
  let offerSchedule = false;
  if (answer.includes(REDIRECT_SENTINEL)) {
    offerSchedule = true;
    const first = brain.candidate.full_name.split(' ')[0] || brain.candidate.full_name;
    answer = await generateRedirectMessage(message, first);
  }

  // Owner self-tests are marked as sandbox so they don't pollute recruiter
  // analytics. Anonymous recruiter sessions log the viewer id when present.
  const resolvedSessionId = await ensureChatSession(brain.candidateProfileId, sessionId, {
    viewerClerkUserId: userId ?? null,
    employerAccountId: employerViewer?.employerAccountId ?? null,
    // Prefer a signed-in employer's company; otherwise the recruiter's own intro.
    employerCompanyName: employerViewer?.employerCompanyName ?? visitorCompany,
    recruiterName: visitorName,
    recruiterEmail: visitorEmail,
    isSandbox: isOwner,
  });
  if (resolvedSessionId) {
    await logChatExchange({
      sessionId: resolvedSessionId,
      question: message,
      answer,
      modelUsed: model,
      wasComplex,
      wasValidated,
    });
  }

  return NextResponse.json({
    answer,
    sessionId: resolvedSessionId ?? sessionId ?? null,
    offerSchedule,
    // Signals the client to surface the persistent, low-key "Request time" chip.
    inviteMeeting: meetingInvitation === 'gentle',
  });
}

/** The scripted, honest handoff; the fallback when the model-written one fails. */
function buildRedirectMessage(firstName: string): string {
  return `Great question, and an honest answer: I don't have that detail in what ${firstName} has shared with me. It's exactly the kind of thing ${firstName} would be glad to cover directly. Would you like to schedule a time to talk with ${firstName}?`;
}

/**
 * Writes a natural, varied handoff for a question the assistant cannot answer.
 * The model is forbidden from stating any fact; its only job is to acknowledge
 * the specific question warmly and offer the direct conversation. Falls back to
 * the scripted message on any failure.
 */
async function generateRedirectMessage(question: string, firstName: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 150,
      system: `You write a short, warm handoff reply for ${firstName}'s career assistant when it cannot answer a recruiter's question from ${firstName}'s information.

Rules, all strict:
- 2 to 3 sentences. Acknowledge the specific topic of the question naturally, then say honestly that you don't have that detail, and offer to set up a time to talk with ${firstName} directly.
- State NO facts about ${firstName} whatsoever: no numbers, no history, no claims, no guesses. You know nothing except that the detail is not available to you.
- Sound like a thoughtful human assistant, not a bot. No apology theater, no corporate filler.
- Never use em dashes ("--" or the long dash). Use commas, semicolons, or periods instead.`,
      messages: [{ role: 'user', content: `The recruiter asked: "${question}"\n\nWrite the handoff reply.` }],
    });
    const block = response.content.find((b) => b.type === 'text');
    const text = block && block.type === 'text' ? block.text.trim() : '';
    // Guard: if the model produced something empty or suspiciously long, fall back.
    if (text && text.length <= 600) return text;
    return buildRedirectMessage(firstName);
  } catch (e) {
    console.error('chat: redirect generation failed', e);
    return buildRedirectMessage(firstName);
  }
}

/**
 * Best-effort client IP for the per-source interaction cap. On Vercel the real
 * client is the first entry in x-forwarded-for; x-real-ip is the fallback. A
 * missing IP simply skips the per-IP cap (fail-open) rather than blocking.
 */
function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim() || null;
  return req.headers.get('x-real-ip');
}

/** Trims a max_tokens-truncated answer back to its last completed sentence. */
function trimToLastSentence(answer: string): string {
  const lastEnd = Math.max(answer.lastIndexOf('.'), answer.lastIndexOf('!'), answer.lastIndexOf('?'));
  if (lastEnd > 0) return answer.slice(0, lastEnd + 1);
  return answer;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detects whether a recruiter question is complex enough to warrant Sonnet.
 * Triggers on adversarial framing, multi-fact synthesis, or multi-clause
 * questions. Fast string heuristic -- no API call. Errs toward Sonnet: a false
 * positive costs a few cents, a false negative costs answer quality.
 */
function detectComplexQuestion(message: string): boolean {
  const lower = message.toLowerCase();

  const adversarialSignals = [
    'why should i',
    'convince me',
    'prove',
    'walk me through exactly',
    'how did you calculate',
    'how did you arrive',
    'that seems',
    'i find it hard to believe',
    'your resume shows',
    'i notice that',
    'i see that',
    'but you left',
    'short tenure',
    'job hopp',
    'why would this be different',
    'what actually happened',
    'be honest',
    'really why',
    'true reason',
  ];

  const synthesisSignals = [
    'given that',
    'considering',
    'taking into account',
    'with your background',
    'despite',
    'even though',
    'and also',
    'in addition to',
    'gap',
    'pivot',
    'switch',
    'change',
    'transition',
    'commitment',
  ];

  const hasAdversarialSignal = adversarialSignals.some((s) => lower.includes(s));
  const hasTwoOrMoreSynthesisSignals =
    synthesisSignals.filter((s) => lower.includes(s)).length >= 2;
  const hasMultipleClauses =
    (lower.match(/\band\b|\bbut\b|\bhowever\b|\balso\b/g) ?? []).length >= 2;

  return hasAdversarialSignal || hasTwoOrMoreSynthesisSignals || hasMultipleClauses;
}

/**
 * Detects whether a generated answer contains high-risk content -- specific
 * numbers, dollar figures, percentages, or credential claims that must trace
 * back to the brain. Fast regex, no API call.
 */
function detectHighRiskContent(answer: string): boolean {
  const highRiskPatterns = [
    /\$[\d,]+/, // dollar figures
    /\d+%/, // percentages
    /\d+[xX]\b/, // multipliers (3x, 10X)
    /\d{4}/, // four-digit numbers (years, large figures)
    /certified|certification|license|degree|pmp|six sigma|lean/i,
  ];
  return highRiskPatterns.some((pattern) => pattern.test(answer));
}

/**
 * Post-generation validation pass. Asks Sonnet whether every specific number or
 * credential in the answer appears in the candidate's career data. If grounded,
 * returns the answer unchanged; if not, returns a natural deflection. Any failure
 * returns the original answer rather than breaking the chat (fail-safe).
 */
async function validateAndSanitize(
  answer: string,
  candidate: CandidateBrain,
  resumeMarkdown: string | null,
  careerContextMarkdown: string | null = null,
): Promise<string> {
  const careerData = [
    careerContextMarkdown,
    resumeMarkdown,
    candidate.key_wins,
    candidate.departure_reasons,
    candidate.biggest_challenge,
    candidate.leadership_philosophy,
    candidate.ideal_environment,
    candidate.manager_needs,
    candidate.honest_weaknesses,
    candidate.wish_questions,
    candidate.additional_context,
    ...candidate.custom_qa_pairs.map((p) => `${p.question}\n${p.answer}`),
  ]
    .filter(Boolean)
    .join('\n\n');

  const validationPrompt = `You are validating an AI-generated answer for factual grounding.

CANDIDATE CAREER DATA:
${careerData}

GENERATED ANSWER TO CHECK:
"${answer}"

Task: Does every specific number, dollar figure, percentage, multiplier, year, certification, or credential mentioned in the answer appear explicitly in the career data above? Submit the verdict via the submit_validation tool.`;

  try {
    // Forced tool call, same pattern as every other structured call in lib/ai,
    // so a chatty preamble or markdown fence can never break the parse.
    const validation = await anthropic.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 300,
      tools: [
        {
          name: 'submit_validation',
          description: 'Submit the grounding verdict for the answer.',
          input_schema: {
            type: 'object' as const,
            properties: {
              grounded: { type: 'boolean' },
              unsupported_claims: { type: 'array', items: { type: 'string' } },
            },
            required: ['grounded', 'unsupported_claims'],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_validation' },
      messages: [{ role: 'user', content: validationPrompt }],
    });

    const block = validation.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') return answer;
    const result = block.input as { grounded: boolean; unsupported_claims: string[] };

    if (result.grounded) return answer;

    // Ungrounded figure: route to the honest redirect rather than approximating.
    return REDIRECT_SENTINEL;
  } catch {
    // Validation failed (API error) -- let the original answer through rather
    // than break the chat experience.
    return answer;
  }
}
````


#### `lib/security/rate-limit.ts`

Shared fixed-window rate limiter used across the public chat pipeline.

````ts
import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// Application-level fixed-window rate limiting, backed by the rate_limits table +
// check_rate_limit() RPC (see 20260709 migration). Edge/IP flood protection now
// lives in the Vercel WAF (@vercel/firewall); this remains for app-domain limits
// the platform cannot express, e.g. "transcript emails per candidate per hour".
// Runs through the service-role client (callers may be anonymous recruiters).
//
// Fail-open by design: if the limiter itself errors, we allow rather than block.

/**
 * Records a hit against `key` and returns whether the caller is still within
 * `max` events per `windowSeconds`. Returns true (allowed) on any error so an
 * infra blip never breaks the flow.
 */
export async function checkAppRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await (adminClient.rpc as any)('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('checkAppRateLimit: rpc error', key, error);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error('checkAppRateLimit: threw', key, e);
    return true;
  }
}
````


#### `app/api/chat/identify/route.ts`

Anonymous recruiter self-identification onto the chat session.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@vercel/firewall';

// Public endpoint. A recruiter optionally attaches their name / company / email
// to their chat session, so the candidate sees who reached out and the recruiter
// gets their own transcript copy. Never required; all fields optional. Rate
// limited at the edge; writes via the service-role client (recruiter is anon).
export const runtime = 'nodejs';
export const maxDuration = 10;

const Input = z.object({
  sessionId: z.string().uuid(),
  name: z.string().max(120).optional(),
  company: z.string().max(160).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
});

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export async function POST(req: NextRequest) {
  // Recommended rule: 20 requests / 300s per IP (see docs/architecture/11-anti-spam.md).
  try {
    const { rateLimited } = await checkRateLimit('identify', { request: req });
    if (rateLimited) return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 });
  } catch (e) {
    console.error('identify: rate limit check failed', e);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', details: parsed.error.issues } }, { status: 400 });
  }
  const { sessionId } = parsed.data;
  const name = clean(parsed.data.name);
  const company = clean(parsed.data.company);
  const email = clean(parsed.data.email || undefined);

  // Only update the fields actually provided; leave the rest untouched (so a
  // resolved employer company is not wiped by an empty submission).
  const update: Record<string, string> = {};
  if (name) update.recruiter_name = name;
  if (email) update.recruiter_email = email;
  if (company) update.employer_company_name = company;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, skipped: 'empty' });
  }

  const { error } = await (adminClient.from('chat_sessions') as any)
    .update(update)
    .eq('id', sessionId)
    .eq('is_sandbox', false);
  if (error) {
    console.error('identify: update failed', sessionId, error);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
````


#### `app/api/chat/schedule/route.ts`

Meeting-request submission from inside the chat when the AI cannot answer.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase/admin';
import { isEmailConfigured } from '@/lib/email/client';
import { sendMeetingRequestEmail } from '@/lib/email/meeting';
import { checkRateLimit } from '@vercel/firewall';
import { checkBotId } from 'botid/server';
import type { ChatTurn } from '@/lib/types';

// Public endpoint. A recruiter (usually anonymous) submits availability + email
// from the chat when the Personal Assistant offered to schedule. Stores the
// request for the candidate and emails them. Service-role: the recruiter has no
// Clerk session, and the candidate row is resolved by public slug.
export const runtime = 'nodejs';
export const maxDuration = 15;

const Input = z.object({
  candidateSlug: z.string().min(1).max(200),
  email: z.string().email().max(200),
  availability: z.string().min(1).max(2000),
  name: z.string().max(200).optional(),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  // Meeting requests email the candidate, so gate this endpoint hardest: a bot
  // check plus an edge rate limit. Both degrade gracefully (BotID reports
  // not-a-bot off Vercel; the WAF rule no-ops until published).
  // Recommended rule: 5 requests / 300s per IP (Vercel Fixed Window caps at
  // 300s; see docs/architecture/11-anti-spam.md).
  try {
    const { rateLimited } = await checkRateLimit('schedule', { request: req });
    if (rateLimited) {
      return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 });
    }
  } catch (e) {
    console.error('schedule: rate limit check failed', e);
  }
  try {
    const { isBot } = await checkBotId();
    if (isBot) {
      return NextResponse.json({ error: { code: 'BOT_CHECK_FAILED' } }, { status: 403 });
    }
  } catch (e) {
    console.error('schedule: botid check failed', e);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', details: parsed.error.issues } }, { status: 400 });
  }
  const { candidateSlug, email, availability, name, sessionId } = parsed.data;

  // Resolve the published candidate by slug (service-role read).
  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('id, full_name, clerk_user_id, is_published')
    .eq('slug', candidateSlug)
    .maybeSingle();
  if (!profile || !profile.is_published) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  const { error: insErr } = await (adminClient.from('meeting_requests') as any).insert({
    candidate_profile_id: profile.id,
    chat_session_id: sessionId ?? null,
    recruiter_email: email,
    recruiter_name: name?.trim() || null,
    availability: availability.trim(),
  });
  if (insErr) {
    console.error('schedule: insert failed', candidateSlug, insErr);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  // Email the candidate (best-effort; never fail the request over delivery).
  if (isEmailConfigured()) {
    try {
      const { data: candUser } = await (adminClient.from('users') as any)
        .select('email')
        .eq('clerk_user_id', profile.clerk_user_id)
        .maybeSingle();

      // Attach the conversation that led to the request so the candidate walks
      // into the meeting with full context. Confirm the session belongs to this
      // candidate before reading its messages (the sessionId is client-supplied).
      let messages: ChatTurn[] | undefined;
      if (sessionId) {
        const { data: sess } = await (adminClient.from('chat_sessions') as any)
          .select('id')
          .eq('id', sessionId)
          .eq('candidate_profile_id', profile.id)
          .maybeSingle();
        if (sess) {
          const { data: msgs } = await (adminClient.from('chat_messages') as any)
            .select('role, content, created_at')
            .eq('chat_session_id', sessionId)
            .order('created_at', { ascending: true });
          if (msgs && msgs.length > 0) {
            messages = (msgs as { role: ChatTurn['role']; content: string }[]).map((m) => ({
              role: m.role,
              content: m.content,
            }));
          }
        }
      }

      await sendMeetingRequestEmail({
        candidateName: profile.full_name,
        candidateEmail: candUser?.email ?? null,
        recruiterEmail: email,
        recruiterName: name,
        availability,
        messages,
      });
    } catch (e) {
      console.error('schedule: email failed', candidateSlug, e);
    }
  }

  return NextResponse.json({ ok: true });
}
````


#### `app/api/transcripts/deliver/route.ts`

Idempotent transcript delivery, fired by sendBeacon when the chat closes.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deliverTranscript } from '@/lib/transcripts/deliver';
import { checkRateLimit } from '@vercel/firewall';

// Public endpoint -- triggered by the chat surface on close/background
// (sendBeacon + pagehide/visibilitychange), so the recruiter is usually
// anonymous. Idempotent via chat_sessions.transcript_sent; the shared
// deliverTranscript() pipeline claims delivery atomically and emails once.
export const runtime = 'nodejs';
export const maxDuration = 30;

const Input = z.object({ sessionId: z.string().uuid() });

export async function POST(req: NextRequest) {
  // Cheap edge guard: delivery is idempotent anyway, but this caps how hard an
  // anonymous caller can hammer the endpoint. No-ops until the WAF rule is set.
  // Recommended rule: 60 requests / 60s per IP (see docs/architecture/11-anti-spam.md).
  try {
    const { rateLimited } = await checkRateLimit('deliver', { request: req });
    if (rateLimited) {
      return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 });
    }
  } catch (e) {
    console.error('deliver: rate limit check failed', e);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
  }

  await deliverTranscript(parsed.data.sessionId);
  // Always 200: the recruiter's browser is firing this on unload and cannot act
  // on the result. Delivery is idempotent and best-effort.
  return NextResponse.json({ ok: true });
}
````


#### `lib/transcripts/deliver.ts`

The delivery engine behind the route: builds the transcript, emails both sides, triggers gap analysis.

````ts
import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import { isEmailConfigured } from '@/lib/email/client';
import { sendTranscriptEmails } from '@/lib/email/transcript';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { analyzeTranscriptGaps } from '@/lib/ai/analyze-transcript';
import { checkAppRateLimit } from '@/lib/security/rate-limit';
import type { ChatTurn } from '@/lib/types';

// Shared transcript-delivery pipeline. Called from two places:
//   1. /api/transcripts/deliver -- the sendBeacon fired when the recruiter's
//      chat surface closes/backgrounds.
//   2. /api/cron/deliver-transcripts -- the safety-net sweep that catches
//      sessions the browser beacon never reached (tab closed, mobile killed).
// Recording (chat_sessions/chat_messages) already happened inside /api/chat;
// this step only emails the transcript and feeds the AI-improvement gap loop.
// Everything runs through the service-role client: recruiters are anonymous.

// Per-candidate cap so a flood of sessions cannot email-bomb a candidate.
const MAX_TRANSCRIPT_EMAILS_PER_HOUR = 12;

export type DeliverResult =
  | { ok: true; delivered: true }
  | { ok: true; delivered: false; reason: string };

/**
 * Delivers the transcript for a single chat session: marks it sent (winning any
 * race against a duplicate beacon), emails both sides, and runs gap analysis.
 * Idempotent -- a second call for the same session is a no-op. Never throws;
 * best-effort delivery must not break the caller.
 */
export async function deliverTranscript(sessionId: string): Promise<DeliverResult> {
  const { data: session } = await (adminClient.from('chat_sessions') as any)
    .select(
      'id, candidate_profile_id, viewer_clerk_user_id, employer_company_name, recruiter_email, transcript_sent, is_sandbox',
    )
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return { ok: true, delivered: false, reason: 'unknown_session' };
  if (session.transcript_sent) return { ok: true, delivered: false, reason: 'already_sent' };
  if (session.is_sandbox) return { ok: true, delivered: false, reason: 'sandbox' };

  const { data: msgs } = await (adminClient.from('chat_messages') as any)
    .select('role, content, created_at')
    .eq('chat_session_id', sessionId)
    .order('created_at', { ascending: true });
  const messages: ChatTurn[] = (msgs ?? []).map((m: { role: ChatTurn['role']; content: string }) => ({
    role: m.role,
    content: m.content,
  }));
  if (messages.length === 0) return { ok: true, delivered: false, reason: 'empty' };

  // Claim delivery atomically: only the writer that flips transcript_sent from
  // false wins and proceeds. Concurrent beacons/cron passes get zero rows back
  // and bail, so the emails send exactly once.
  const { data: claimed } = await (adminClient.from('chat_sessions') as any)
    .update({ transcript_sent: true, ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('transcript_sent', false)
    .select('id');
  if (!claimed || claimed.length === 0) {
    return { ok: true, delivered: false, reason: 'already_sent' };
  }

  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('full_name, slug, clerk_user_id')
    .eq('id', session.candidate_profile_id)
    .maybeSingle();
  if (!profile) return { ok: true, delivered: false, reason: 'no_profile' };

  const { data: candUser } = await (adminClient.from('users') as any)
    .select('email')
    .eq('clerk_user_id', profile.clerk_user_id)
    .maybeSingle();
  const candidateEmail: string | null = candUser?.email ?? null;

  // The recruiter's copy goes to their signed-in account email, or the email they
  // optionally left when introducing themselves in the chat.
  let employerEmail: string | null = null;
  if (session.viewer_clerk_user_id && session.viewer_clerk_user_id !== profile.clerk_user_id) {
    const { data: viewer } = await (adminClient.from('users') as any)
      .select('email')
      .eq('clerk_user_id', session.viewer_clerk_user_id)
      .maybeSingle();
    employerEmail = viewer?.email ?? null;
  }
  if (!employerEmail && session.recruiter_email) {
    employerEmail = session.recruiter_email as string;
  }

  if (isEmailConfigured()) {
    // Throttle candidate-bound transcript emails so session-flooding cannot
    // bury a candidate's inbox. The recruiter copy is unaffected.
    const withinCap = await checkAppRateLimit(
      `transcript-email:${session.candidate_profile_id}`,
      MAX_TRANSCRIPT_EMAILS_PER_HOUR,
      3600,
    );
    try {
      await sendTranscriptEmails({
        candidateName: profile.full_name,
        candidateSlug: profile.slug,
        candidateEmail: withinCap ? candidateEmail : null,
        employerEmail,
        employerCompany: session.employer_company_name ?? null,
        messages,
      });
    } catch (e) {
      console.error('deliverTranscript: send failed', sessionId, e);
    }
  } else {
    console.warn('deliverTranscript: RESEND_API_KEY not set; skipping send', sessionId);
  }

  // Post-session: analyze the transcript against the brain and store gaps for the
  // prompt bot. This is the transcript -> AI-improvement loop; best-effort.
  try {
    const brain = await getCandidateBrainBySlug(profile.slug);
    if (brain) {
      const gaps = await analyzeTranscriptGaps({
        candidate: brain.candidate,
        resumeMarkdown: brain.resumeMarkdown,
        messages,
      });
      for (const g of gaps) {
        const { count } = await (adminClient.from('transcript_gaps') as any)
          .select('id', { count: 'exact', head: true })
          .eq('candidate_profile_id', session.candidate_profile_id)
          .eq('category', g.category);
        const patternCount = (count ?? 0) + 1;
        await (adminClient.from('transcript_gaps') as any).insert({
          candidate_profile_id: session.candidate_profile_id,
          chat_session_id: sessionId,
          question_asked: g.questionAsked,
          chatbot_answer: g.chatbotAnswer,
          gap_type: g.gapType,
          suggested_prompt: g.suggestedPrompt,
          suggested_answer: g.suggestedAnswer?.trim() || null,
          category: g.category,
          priority: patternCount >= 3 ? 'high' : g.priority,
          pattern_count: patternCount,
        });
      }
    }
  } catch (e) {
    console.error('deliverTranscript: gap analysis failed', sessionId, e);
  }

  return { ok: true, delivered: true };
}
````


#### `lib/email/transcript.ts`

Resend transcript email orchestration (candidate + employer/recruiter copies).

````ts
import 'server-only';
import { getResend } from './client';
import type { ChatTurn } from '@/lib/types';

const FROM = 'RoleBoost <transcripts@roleboost.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roleboost.app';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTranscript(messages: ChatTurn[], candidateName: string): string {
  return messages
    .map((m) => {
      const who = m.role === 'user' ? 'Recruiter' : `${candidateName}'s AI`;
      const color = m.role === 'user' ? '#4B6580' : '#1E3A5F';
      return `<p style="margin:0 0 14px;line-height:1.5"><strong style="color:${color}">${esc(who)}</strong><br>${esc(m.content).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

function shell(inner: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;color:#1E3A5F;background:#F5F0E8;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D4;border-radius:16px;padding:28px">
      ${inner}
      <hr style="border:none;border-top:1px solid #E8E0D4;margin:20px 0"/>
      <p style="font-size:12px;color:#8FA3B8;margin:0">Powered by RoleBoost AI · honest by design</p>
    </div>
  </div>`;
}

interface DeliverArgs {
  candidateName: string;
  candidateSlug: string;
  candidateEmail: string | null;
  employerEmail: string | null;
  employerCompany: string | null;
  messages: ChatTurn[];
}

/** Sends the post-conversation transcript to the candidate and (if known) the employer. */
export async function sendTranscriptEmails(args: DeliverArgs): Promise<void> {
  const resend = getResend();
  const transcript = renderTranscript(args.messages, args.candidateName);
  const qCount = args.messages.filter((m) => m.role === 'user').length;
  const company = args.employerCompany || 'An anonymous recruiter';
  const heading = `font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#1E3A5F;font-size:18px;margin:0 0 8px`;
  const link = `color:#B45309;font-weight:600;text-decoration:none`;

  if (args.candidateEmail) {
    const inner = `
      <h2 style="${heading}">A recruiter just chatted with your RoleBoost AI</h2>
      <p style="margin:0 0 16px;color:#4B6580">${esc(company)} asked your AI ${qCount} question${qCount === 1 ? '' : 's'}.</p>
      ${transcript}
      <p style="margin:16px 0 0"><a href="${APP_URL}/dashboard/ai" style="${link}">Fine-tune your AI →</a></p>`;
    await resend.emails.send({
      from: FROM,
      to: args.candidateEmail,
      subject: 'A recruiter just chatted with your RoleBoost AI',
      html: shell(inner),
    });
  }

  if (args.employerEmail) {
    const inner = `
      <h2 style="${heading}">Your RoleBoost conversation with ${esc(args.candidateName)}</h2>
      <p style="margin:0 0 16px;color:#4B6580">${qCount} question${qCount === 1 ? '' : 's'} asked.</p>
      ${transcript}
      <p style="margin:16px 0 0"><a href="${APP_URL}/c/${esc(args.candidateSlug)}" style="${link}">View ${esc(args.candidateName)}&rsquo;s profile →</a></p>`;
    await resend.emails.send({
      from: FROM,
      to: args.employerEmail,
      subject: `Your RoleBoost conversation with ${args.candidateName}`,
      html: shell(inner),
    });
  }
}
````


#### `app/api/cron/deliver-transcripts/route.ts`

Sweep for stale/abandoned sessions the beacon missed.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { deliverTranscript } from '@/lib/transcripts/deliver';
import { guardCron } from '@/lib/cron/guard';

// Safety-net sweep for the transcript pipeline. The browser beacon
// (pagehide/visibilitychange) delivers most conversations, but tab kills and
// mobile backgrounding can drop it. This fulfills the "deliver after 30 min of
// inactivity" guarantee: any un-delivered, non-sandbox session older than the
// idle window gets its transcript emailed + gap-analyzed here.
//
// Secured by CRON_SECRET (Vercel Cron sends it as a Bearer token). Until the
// secret is provisioned the route simply 401s -- the beacon path keeps working,
// so this is safe to ship ahead of the env var (graceful degradation).
export const runtime = 'nodejs';
export const maxDuration = 60;

const IDLE_MINUTES = 30;
const BATCH = 100;

export async function GET(req: NextRequest) {
  const guard = guardCron(req);
  if (!guard.ok) return guard.response;

  const cutoff = Date.now() - IDLE_MINUTES * 60_000;

  // Candidate sessions still awaiting delivery. Ordered oldest-first so a backlog
  // drains steadily across runs.
  const { data: sessions, error } = await (adminClient.from('chat_sessions') as any)
    .select('id')
    .eq('transcript_sent', false)
    .eq('is_sandbox', false)
    .order('started_at', { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error('cron/deliver-transcripts: query failed', error);
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  const ids = (sessions ?? []).map((s: { id: string }) => s.id);
  if (ids.length === 0) return NextResponse.json({ ok: true, scanned: 0, delivered: 0 });

  // Idle is measured from the LAST message, not session start, so an active
  // conversation is never delivered mid-stream. Fetch the latest message time
  // per candidate session (bounded by BATCH) and deliver only the truly idle.
  const { data: msgs } = await (adminClient.from('chat_messages') as any)
    .select('chat_session_id, created_at')
    .in('chat_session_id', ids)
    .order('created_at', { ascending: false });

  const lastMessageAt = new Map<string, number>();
  for (const m of (msgs ?? []) as { chat_session_id: string; created_at: string }[]) {
    // Rows are newest-first, so the first time seen per session is its latest.
    if (!lastMessageAt.has(m.chat_session_id)) {
      lastMessageAt.set(m.chat_session_id, new Date(m.created_at).getTime());
    }
  }

  let delivered = 0;
  let scanned = 0;
  for (const id of ids as string[]) {
    const last = lastMessageAt.get(id);
    if (last === undefined || last >= cutoff) continue; // no messages, or still active
    scanned += 1;
    const result = await deliverTranscript(id);
    if (result.ok && result.delivered) delivered += 1;
  }

  return NextResponse.json({ ok: true, scanned, delivered });
}
````


#### `app/api/sandbox/analyze/route.ts`

Sandbox self-test: runs the brain against test questions and grades the answers.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { anthropic } from '@/lib/ai/client';
import { CHAT_MODEL } from '@/lib/ai/models';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { buildCandidateSystemPrompt } from '@/lib/ai/build-system-prompt';
import { analyzeSandboxAnswer } from '@/lib/ai/analyze-sandbox';

// Owner-only sandbox analysis. Generates an answer (when none is supplied, the
// full-diagnostic path) and grades it against the candidate's own brain. Never
// delivers a transcript and is never reachable by a recruiter.
export const runtime = 'nodejs';
export const maxDuration = 45;

const PATTERN_THRESHOLD = 3;

const Input = z.object({
  candidateSlug: z.string().min(1).max(200),
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(4000).optional(),
  category: z.string().min(1).max(50),
});

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }
  const { userId, supabase } = ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Expected JSON body' } },
      { status: 400 },
    );
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', details: parsed.error.issues } },
      { status: 400 },
    );
  }
  const { candidateSlug, question, category } = parsed.data;
  let answer = parsed.data.answer;

  // Load the brain (service-role read) and confirm the caller owns it.
  const brain = await getCandidateBrainBySlug(candidateSlug);
  if (!brain || brain.ownerClerkUserId !== userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Not your profile' } },
      { status: 403 },
    );
  }

  const systemPrompt = buildCandidateSystemPrompt(
    brain.candidate,
    brain.resumeMarkdown,
    brain.careerContextMarkdown,
  );

  // Full-diagnostic path sends only the question -- generate the answer the same
  // way a recruiter would receive it (Haiku, same system prompt).
  if (!answer) {
    try {
      const gen = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      });
      const block = gen.content.find((b) => b.type === 'text');
      answer = block && block.type === 'text' ? block.text.trim() : '';
    } catch (e) {
      console.error('sandbox: generation failed', candidateSlug, e);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Could not generate an answer' } },
        { status: 500 },
      );
    }
  }
  if (!answer) {
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Empty answer' } },
      { status: 500 },
    );
  }

  let analysis;
  try {
    analysis = await analyzeSandboxAnswer({
      candidate: brain.candidate,
      resumeMarkdown: brain.resumeMarkdown,
      question,
      answer,
      category,
    });
  } catch (e) {
    console.error('sandbox: analysis failed', candidateSlug, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Analysis failed' } },
      { status: 500 },
    );
  }

  // Pattern signal: this category has produced >= threshold weak/hallucinated
  // verdicts (counting this one). RLS scopes the count to the owner's rows.
  let patternSignal = false;
  if (analysis.verdict === 'weak' || analysis.verdict === 'hallucinated') {
    const { count } = await supabase
      .from('sandbox_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_profile_id', brain.candidateProfileId)
      .eq('question_category', category)
      .in('verdict', ['weak', 'hallucinated']);
    patternSignal = (count ?? 0) + 1 >= PATTERN_THRESHOLD;
  }

  // Store the session. Best-effort -- a logging failure must not fail the response.
  const { error: insErr } = await supabase.from('sandbox_sessions').insert({
    candidate_profile_id: brain.candidateProfileId,
    question,
    question_category: category,
    ai_answer: answer,
    verdict: analysis.verdict,
    diagnosis: analysis.diagnosis,
    prescription: analysis.prescription,
    brain_field_target: analysis.brainFieldTarget,
    expansion_prompt: analysis.expansionPrompt,
    pattern_signal: patternSignal,
  });
  if (insErr) console.error('sandbox: store failed', candidateSlug, insErr);

  return NextResponse.json({ answer, ...analysis, patternSignal });
}
````


#### `app/api/intake/analyze/route.ts`

Intake interview: analyzes the resume/context and generates interview questions.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { analyzeIntakePass1, generateNextPass } from '@/lib/ai/intake';
import { getSourceDocuments } from '@/lib/career-sources/queries';
import type { IntakeDocument } from '@/lib/types';

// Owner-only, multi-pass intake question generation. Stateless per call: the
// client supplies prior answers; the route supplies the résumé + extra sources.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TOTAL = 20;

const DocSchema = z.object({ label: z.string().min(1).max(40), text: z.string().min(1).max(20000) });
const AnswerSchema = z.object({
  questionId: z.string().max(40),
  questionText: z.string().max(1000),
  answerText: z.string().min(1).max(5000),
  category: z.string().max(50),
  pass: z.number().int().min(1).max(3),
});
const Input = z.object({
  pass: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  documents: z.array(DocSchema).max(5).optional(),
  previousAnswers: z.array(AnswerSchema).max(MAX_TOTAL).optional(),
});

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }
  const { userId, supabase } = ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Expected JSON body' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', details: parsed.error.issues } }, { status: 400 });
  }
  const { pass, documents = [], previousAnswers = [] } = parsed.data;

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const profileId = (profile as { id: string }).id;

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', profileId)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  // Grounding documents: résumé + the candidate's saved career sources + any
  // one-off text pasted in this session. Saved sources are owner-scoped via RLS.
  const docs: IntakeDocument[] = [];
  if (resumeMarkdown && resumeMarkdown.trim()) docs.push({ label: 'Résumé', text: resumeMarkdown });
  docs.push(...(await getSourceDocuments(supabase, profileId)));
  docs.push(...documents);

  try {
    if (pass === 1) {
      const { inconsistencies, questions } = await analyzeIntakePass1(docs);
      await supabase
        .from('candidate_profiles')
        .update({ inconsistencies_found: inconsistencies, intake_pass1_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
      return NextResponse.json({ inconsistencies, questions, passComplete: false });
    }

    const remaining = MAX_TOTAL - previousAnswers.length;
    const questions = await generateNextPass(pass, docs, previousAnswers, remaining);
    const stamp = pass === 2 ? { intake_pass2_at: new Date().toISOString() } : { intake_pass3_at: new Date().toISOString() };
    await supabase.from('candidate_profiles').update(stamp).eq('clerk_user_id', userId);
    return NextResponse.json({ inconsistencies: [], questions, passComplete: questions.length === 0 });
  } catch (e) {
    console.error('intake analyze: failed', userId, pass, e);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Intake analysis failed' } }, { status: 500 });
  }
}
````


#### `app/api/intake/assemble/route.ts`

Intake interview: folds answers back into the brain and computes readiness.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import {
  assembleBrainFromIntake,
  computeReadiness,
  BRAIN_CATEGORIES,
  type BrainFieldKey,
} from '@/lib/ai/intake';
import { getSourceDocuments } from '@/lib/career-sources/queries';

// Owner-only. Persists the interview answers, synthesizes them into the brain
// fields (one source of truth), computes the readiness score, and marks intake
// complete. Synthesized fields only overwrite when non-empty -- never wipe
// existing content the candidate has already written.
export const runtime = 'nodejs';
export const maxDuration = 60;

const AnswerSchema = z.object({
  questionId: z.string().max(40),
  questionText: z.string().max(1000),
  answerText: z.string().min(1).max(5000),
  category: z.string().max(50),
  pass: z.number().int().min(1).max(3),
});
const Input = z.object({
  answers: z.array(AnswerSchema).min(1).max(20),
  inconsistenciesResolved: z.array(z.string().max(40)).max(50).optional(),
});

const BRAIN_SELECT = BRAIN_CATEGORIES.join(', ');

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }
  const { userId, supabase } = ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Expected JSON body' } }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_INPUT', details: parsed.error.issues } }, { status: 400 });
  }
  const { answers, inconsistenciesResolved = [] } = parsed.data;

  // The dynamic select string trips Supabase's literal-type parser, so this one
  // query goes through the untyped builder (same pattern as the admin client).
  const { data: profile } = await (supabase.from('candidate_profiles') as any)
    .select(`id, ${BRAIN_SELECT}`)
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const row = profile as Record<string, string | null> & { id: string };
  const profileId = row.id;

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', profileId)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  // Saved career sources enrich the synthesized brain as additional grounding.
  const sources = await getSourceDocuments(supabase, profileId);

  let synthesized;
  try {
    synthesized = await assembleBrainFromIntake(resumeMarkdown, answers, sources);
  } catch (e) {
    console.error('intake assemble: synthesis failed', userId, e);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'Brain assembly failed' } }, { status: 500 });
  }

  // Merge: synthesized content wins when present; otherwise keep what's there.
  const merged: Record<BrainFieldKey, string | null> = {} as Record<BrainFieldKey, string | null>;
  for (const k of BRAIN_CATEGORIES) {
    const next = synthesized[k]?.trim();
    merged[k] = next ? next : (row[k] ?? null);
  }

  const readiness = computeReadiness(merged);

  // Replace prior intake answers with this run's set.
  await supabase.from('intake_answers').delete().eq('candidate_profile_id', profileId);
  const { error: insErr } = await supabase.from('intake_answers').insert(
    answers.map((a) => ({
      candidate_profile_id: profileId,
      question_id: a.questionId,
      question_text: a.questionText,
      answer_text: a.answerText,
      answer_source: 'typed',
      pass_number: a.pass,
      category: a.category,
    })),
  );
  if (insErr) console.error('intake assemble: answer insert failed', userId, insErr);

  const { error: updErr } = await supabase
    .from('candidate_profiles')
    .update({
      ...merged,
      brain_readiness_score: readiness.overall,
      intake_completed: true,
      inconsistencies_resolved: inconsistenciesResolved,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', userId);
  if (updErr) {
    console.error('intake assemble: profile update failed', userId, updErr);
    return NextResponse.json({ error: { code: 'INTERNAL', message: updErr.message } }, { status: 500 });
  }

  revalidatePath('/dashboard/ai');
  return NextResponse.json({ brain: merged, readiness });
}
````


#### `app/api/transcript/harden/route.ts`

External-transcript hardening (transcript analyzed, never stored).

````ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { getCandidateBrainBySlug } from '@/lib/ai/get-candidate-brain';
import { hardenTranscriptAnalysis } from '@/lib/ai/harden-transcript';
import { extractResumeText } from '@/lib/resume/extract-text';
import type { BrainHardeningSession } from '@/lib/types';

// Owner-only. Accepts an external transcript (paste or txt/pdf upload), analyzes
// it against the caller's own brain, and stores ONLY the resulting plan + counts.
// The raw transcript is processed in-request and never persisted (8E.5).
export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_EXT = ['txt', 'pdf'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 60_000;
const MIN_TEXT = 30;

const Fields = z.object({
  candidateSlug: z.string().min(1).max(200),
  transcriptText: z.string().max(MAX_TEXT).optional(),
  transcriptSource: z.enum(['paste', 'file']),
  sourceContext: z.string().max(200).optional(),
  reanalyzeSessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }
  const { userId, supabase } = ctx;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Expected multipart/form-data' } },
      { status: 400 },
    );
  }

  const parsed = Fields.safeParse({
    candidateSlug: form.get('candidateSlug') ?? undefined,
    transcriptText: form.get('transcriptText') ?? undefined,
    transcriptSource: form.get('transcriptSource') ?? undefined,
    sourceContext: form.get('sourceContext') ?? undefined,
    reanalyzeSessionId: form.get('reanalyzeSessionId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', details: parsed.error.issues } },
      { status: 400 },
    );
  }
  const { candidateSlug, sourceContext, reanalyzeSessionId } = parsed.data;

  // Resolve the transcript text: a file wins, otherwise the pasted text.
  let transcriptText = (parsed.data.transcriptText ?? '').trim();
  let transcriptSource: 'paste' | 'file' = parsed.data.transcriptSource;
  const file = form.get('file') as File | null;
  if (file && file.size > 0) {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: `Unsupported file type .${ext}, use TXT or PDF` } },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'File exceeds 10MB limit' } },
        { status: 400 },
      );
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      transcriptText = (await extractResumeText(buffer, file.type, ext)).trim();
    } catch (e) {
      console.error('harden: extraction failed', userId, e);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Could not read that file' } },
        { status: 500 },
      );
    }
    transcriptSource = 'file';
  }

  if (transcriptText.length < MIN_TEXT) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Transcript is too short to analyze' } },
      { status: 400 },
    );
  }
  if (transcriptText.length > MAX_TEXT) transcriptText = transcriptText.slice(0, MAX_TEXT);

  // Load the brain (service-role read) and confirm the caller owns it.
  const brain = await getCandidateBrainBySlug(candidateSlug);
  if (!brain || brain.ownerClerkUserId !== userId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Not your profile' } },
      { status: 403 },
    );
  }

  let result;
  try {
    result = await hardenTranscriptAnalysis({
      candidate: brain.candidate,
      resumeMarkdown: brain.resumeMarkdown,
      transcriptText,
      sourceContext,
    });
  } catch (e) {
    console.error('harden: analysis failed', candidateSlug, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Analysis failed' } },
      { status: 500 },
    );
  }

  const gapsIdentified = result.gapsIdentified.length;
  const nowIso = new Date().toISOString();

  // Re-analysis: update the prior session in place and record progress. RLS scopes
  // the read/update to the owner's own rows; we also pin to this profile.
  if (reanalyzeSessionId) {
    const { data: prior } = await supabase
      .from('brain_hardening_sessions')
      .select('id, gaps_identified, candidate_profile_id, source_context, transcript_source')
      .eq('id', reanalyzeSessionId)
      .eq('candidate_profile_id', brain.candidateProfileId)
      .maybeSingle();
    if (prior) {
      const priorRow = prior as Pick<BrainHardeningSession, 'gaps_identified' | 'source_context' | 'transcript_source'>;
      const gapsAddressed = Math.max(0, priorRow.gaps_identified - gapsIdentified);
      const { error: updErr } = await supabase
        .from('brain_hardening_sessions')
        .update({
          questions_found: result.questionsFound,
          gaps_identified: gapsIdentified,
          gaps_addressed: gapsAddressed,
          hardening_plan: result.hardeningPlan,
          source_context: sourceContext ?? priorRow.source_context,
          transcript_source: transcriptSource,
          last_reanalyzed_at: nowIso,
        })
        .eq('id', reanalyzeSessionId);
      if (updErr) console.error('harden: reanalysis update failed', candidateSlug, updErr);
      return NextResponse.json({ ...result, sessionId: reanalyzeSessionId, gapsAddressed });
    }
    // Prior session not found / not owned, fall through to a fresh insert.
  }

  const { data: inserted, error: insErr } = await supabase
    .from('brain_hardening_sessions')
    .insert({
      candidate_profile_id: brain.candidateProfileId,
      transcript_source: transcriptSource,
      source_context: sourceContext ?? null,
      questions_found: result.questionsFound,
      gaps_identified: gapsIdentified,
      gaps_addressed: 0,
      hardening_plan: result.hardeningPlan,
    })
    .select('id')
    .single();
  if (insErr) console.error('harden: store failed', candidateSlug, insErr);

  return NextResponse.json({ ...result, sessionId: inserted?.id ?? null, gapsAddressed: 0 });
}
````


#### `app/api/career-context/generate/route.ts`

Self-serve career-context generation (two angles). NOTE: superseded by the Asset Package flow per the 20260714 migration; kept for reference.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { assertCandidateAiAccess, EntitlementError } from '@/lib/auth/entitlements';
import { generateCareerContext } from '@/lib/ai/career-context';
import { getSourceDocuments } from '@/lib/career-sources/queries';
import type { CareerContextDrafts } from '@/lib/types';

// Owner-only, entitlement-gated. Generates both narrative angles of the
// candidate's career-context document from their résumé + career sources and
// stages them on the profile. The candidate selects an angle separately
// (selectCareerContextAngle), which promotes it to the active context_package_md.
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(_req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }
  const { userId, supabase, user } = ctx;

  try {
    assertCandidateAiAccess(user);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json(
        { error: { code: e.code, message: 'AI Studio requires an active subscription or trial.' } },
        { status: 402 },
      );
    }
    throw e;
  }

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('id, full_name')
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const { id: profileId, full_name: fullName } = profile as { id: string; full_name: string };

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', profileId)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  // Career sources enrich the synthesis as additional grounding.
  const sources = await getSourceDocuments(supabase, profileId);

  // Nothing to synthesize from -- ask the candidate to add a résumé or source first.
  if (!resumeMarkdown?.trim() && sources.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'Add a résumé or a career source before generating a context document.',
        },
      },
      { status: 400 },
    );
  }

  let drafts: CareerContextDrafts;
  try {
    drafts = await generateCareerContext(fullName, resumeMarkdown, sources);
  } catch (e) {
    console.error('career-context generate: failed', userId, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Context document generation failed' } },
      { status: 500 },
    );
  }

  const { error: updErr } = await supabase
    .from('candidate_profiles')
    .update({ career_context_drafts: drafts, updated_at: new Date().toISOString() })
    .eq('clerk_user_id', userId);
  if (updErr) {
    console.error('career-context generate: persist failed', userId, updErr);
    return NextResponse.json({ error: { code: 'INTERNAL', message: updErr.message } }, { status: 500 });
  }

  revalidatePath('/dashboard/ai');
  return NextResponse.json({ drafts });
}
````


#### `app/api/career-context/augment/route.ts`

The augment loop: re-synthesizes the selected angle, folding in newer authored material, distilled not appended.

````ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { assertCandidateAiAccess, EntitlementError } from '@/lib/auth/entitlements';
import { augmentCareerContextAngle } from '@/lib/ai/career-context';
import { getSourceDocuments } from '@/lib/career-sources/queries';
import type { CareerContextDrafts, CustomQAPair } from '@/lib/types';

// Owner-only, entitlement-gated. Re-synthesizes the candidate's SELECTED context
// angle, folding in their newer authored material (brain fields, refined answers,
// career sources) and refreshing third-party evidence quotes. The updated angle
// replaces the selected one and is promoted to context_package_md so the brain
// picks it up immediately. This is the "deepen the synthesis loop" path: new
// context enters the brain distilled, not as raw appended text.
export const runtime = 'nodejs';
export const maxDuration = 300;

// The authored brain fields fed into the refinement, with display labels.
const FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'key_wins', label: 'Top career wins' },
  { key: 'leadership_philosophy', label: 'Leadership philosophy' },
  { key: 'departure_reasons', label: 'Reasons for leaving roles' },
  { key: 'biggest_challenge', label: 'Biggest professional challenge' },
  { key: 'ideal_environment', label: 'Ideal team and work environment' },
  { key: 'manager_needs', label: 'What I need from a manager' },
  { key: 'honest_weaknesses', label: 'Honest weaknesses' },
  { key: 'wish_questions', label: 'Questions I wish recruiters asked' },
  { key: 'additional_context', label: 'Additional context' },
];

const PROFILE_SELECT = `id, full_name, ${FIELD_LABELS.map((f) => f.key).join(', ')}, custom_qa_pairs, career_context_drafts`;

function normalizeQA(raw: unknown): CustomQAPair[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is CustomQAPair =>
      !!p &&
      typeof (p as CustomQAPair).question === 'string' &&
      typeof (p as CustomQAPair).answer === 'string',
  );
}

export async function POST(_req: NextRequest) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      const status = e.code === 'UNAUTHENTICATED' ? 401 : 403;
      return NextResponse.json({ error: { code: e.code } }, { status });
    }
    throw e;
  }
  const { userId, supabase, user } = ctx;

  try {
    assertCandidateAiAccess(user);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json(
        { error: { code: e.code, message: 'AI Studio requires an active subscription or trial.' } },
        { status: 402 },
      );
    }
    throw e;
  }

  // The dynamic select string trips Supabase's literal-type parser, so this read
  // goes through the untyped builder (same pattern as the intake assemble route).
  const { data: profile } = await (supabase.from('candidate_profiles') as any)
    .select(PROFILE_SELECT)
    .eq('clerk_user_id', userId)
    .single();
  if (!profile) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'No candidate profile' } }, { status: 404 });
  }
  const row = profile as Record<string, unknown> & {
    id: string;
    full_name: string;
    career_context_drafts: CareerContextDrafts | null;
  };

  const drafts = row.career_context_drafts;
  const selectedKey = drafts?.selected ?? null;
  const base = selectedKey ? drafts?.angles?.[selectedKey] : null;
  if (!drafts || !selectedKey || !base) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'Generate and select an angle before updating.' } },
      { status: 400 },
    );
  }

  const { data: resumeDoc } = await supabase
    .from('resume_documents')
    .select('canonical_markdown')
    .eq('candidate_profile_id', row.id)
    .maybeSingle();
  const resumeMarkdown =
    resumeDoc && typeof (resumeDoc as { canonical_markdown?: string }).canonical_markdown === 'string'
      ? (resumeDoc as { canonical_markdown: string }).canonical_markdown
      : null;

  const sources = await getSourceDocuments(supabase, row.id);

  const brainFields = FIELD_LABELS.map((f) => ({
    label: f.label,
    value: typeof row[f.key] === 'string' ? (row[f.key] as string) : null,
  }));

  let updatedAngle;
  try {
    updatedAngle = await augmentCareerContextAngle({
      fullName: row.full_name,
      base,
      resumeMarkdown,
      sources,
      brainFields,
      customQA: normalizeQA(row.custom_qa_pairs),
    });
  } catch (e) {
    console.error('career-context augment: failed', userId, e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Context document update failed' } },
      { status: 500 },
    );
  }

  const updatedDrafts: CareerContextDrafts = {
    ...drafts,
    angles: { ...drafts.angles, [selectedKey]: updatedAngle },
  };
  const now = new Date().toISOString();

  const { error: updErr } = await supabase
    .from('candidate_profiles')
    .update({
      career_context_drafts: updatedDrafts,
      context_package_md: updatedAngle.markdown,
      context_package_updated_at: now,
      updated_at: now,
    })
    .eq('clerk_user_id', userId);
  if (updErr) {
    console.error('career-context augment: persist failed', userId, updErr);
    return NextResponse.json({ error: { code: 'INTERNAL', message: updErr.message } }, { status: 500 });
  }

  revalidatePath('/dashboard/ai');
  revalidatePath('/dashboard/assets');
  return NextResponse.json({ drafts: updatedDrafts });
}
````


**Related but not included in full** (assets/NotebookLM production, not the chat brain itself): `app/api/admin/asset-package/generate/route.ts` and `lib/ai/asset-package.ts` (634 lines) run the Candidate Asset Production Skill in-app; the chosen perspective's Section 1 markdown is what lands in `context_package_md`. `app/api/resume/parse` + `lib/ai/parse-resume.ts` + `lib/ai/derive-profile.ts` feed `resume_documents.canonical_markdown`. `app/api/profile/recommend-roles` and `suggest-headline` are profile AI, not the brain.

---

## 4. Prompt engineering and the core AI library (`lib/ai`)


#### `lib/ai/models.ts`

The only place model ids live. Haiku for chat, Sonnet for generation/validation.

````ts
// Single source of truth for Claude model IDs. Two models, two purposes
// (see CLAUDE.md "Claude API Usage"):
//   - CHAT_MODEL: live recruiter chat, fast and cheap.
//   - GENERATION_MODEL: one-time generation (resume parsing, summaries), higher quality.
export const CHAT_MODEL = 'claude-haiku-4-5-20251001';
export const GENERATION_MODEL = 'claude-sonnet-4-6';
````


#### `lib/ai/client.ts`

Server-only Anthropic SDK client.

````ts
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

// Anthropic SDK client, server-only. The API key must never reach the browser.
// Lazily initialised so a missing ANTHROPIC_API_KEY doesn't crash the build
// (matches the lib/supabase/admin.ts pattern).
let _anthropic: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Diagnostic (names only -- never values): distinguishes the failure modes.
      //  - hasExactKey=true  -> the var exists but its value is empty
      //  - a similar name in `related` -> the key is mis-named (typo / trailing space)
      //  - related lists other *_KEY vars but no Anthropic one -> truly absent here
      const hasExactKey = Object.prototype.hasOwnProperty.call(process.env, 'ANTHROPIC_API_KEY');
      const related = Object.keys(process.env).filter((k) => /anthropic|claude|key/i.test(k));
      console.error(
        `ANTHROPIC_API_KEY missing or empty. hasExactKey=${hasExactKey}. Related env var names present: ${JSON.stringify(related)}`,
      );
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

// Convenience proxy, same lazy getter, ergonomic `anthropic.messages.create(...)` access.
export const anthropic = new Proxy({} as Anthropic, {
  get(_, prop) {
    return (getAnthropic() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
````


#### `lib/ai/build-system-prompt.ts`

THE system prompt builder: the full layered XML prompt structure, data near the top, rules near the bottom, custom QA pairs at highest priority.

````ts
// lib/ai/build-system-prompt.ts
// Layered XML system prompt for the candidate's Personal Assistant: the assistant
// speaks ABOUT the candidate in third person, grounded strictly in the provided
// information. It never offers a plausible-but-unsupported answer; when it cannot
// answer it emits the [[REDIRECT]] sentinel, which the chat route turns into the
// scripted handoff + scheduling offer.
//
// Resume text is passed separately (sourced from resume_documents.canonical_markdown)
// rather than read off the candidate record; there is no resume_text column.

import 'server-only';
import type { CandidateBrain, CustomQAPair } from '@/lib/types';

/** Emitted verbatim by the model when it cannot answer; the chat route detects it. */
export const REDIRECT_SENTINEL = '[[REDIRECT]]';

/** The recruiter, when they have optionally introduced themselves in the chat. */
export interface ChatViewer {
  name?: string | null;
  company?: string | null;
}

export function buildCandidateSystemPrompt(
  candidate: CandidateBrain,
  resumeMarkdown: string | null,
  careerContextMarkdown: string | null = null,
  viewer: ChatViewer | null = null,
  // 'gentle' once a conversation has run several exchanges deep: the assistant
  // keeps answering fully but may, occasionally and warmly, invite the recruiter
  // to continue live with the candidate. Model-generated so it stays relatable
  // (and reads naturally on Haiku), never a scripted append. Default 'none'.
  meetingInvitation: 'none' | 'gentle' = 'none',
): string {
  const name = candidate.full_name;
  const first = name.split(' ')[0] || name;

  const exemplarBlock = buildExemplarBlock(candidate.custom_qa_pairs, first);
  const boundaryBlock = buildKnowledgeBoundary(candidate, resumeMarkdown, careerContextMarkdown, first);
  const voiceDescriptor = deriveVoiceDescriptor(candidate, first);

  // Only present when the recruiter chose to introduce themselves; otherwise the
  // assistant greets and speaks generically.
  const viewerName = viewer?.name?.trim();
  const viewerCompany = viewer?.company?.trim();
  const partnerBlock =
    viewerName || viewerCompany
      ? `
<conversation_partner>
You are speaking with ${
          viewerName ? (viewerCompany ? `${viewerName} from ${viewerCompany}` : viewerName) : `someone from ${viewerCompany}`
        }. Address them by name naturally and warmly when it fits, and briefly acknowledge them by name the first time you reply after they introduce themselves. Never overuse their name or flatter, stay grounded and in character as ${first}'s assistant.
</conversation_partner>
`
      : '';

  // The candidate-set Target Role is the authoritative answer to "what are you
  // looking for next" -- the assistant must lead with it, not improvise a
  // different title from the narrative.
  const secondaryRoles = (candidate.secondary_target_roles ?? []).map((r) => r.trim()).filter(Boolean);
  const secondaryLine = secondaryRoles.length
    ? `\n\n${first} is also open to these related roles: ${secondaryRoles.join('; ')}. If a recruiter describes an opportunity that fits one of these, you may acknowledge it as a strong fit; the primary target above is still what ${first} is most focused on.`
    : '';
  const targetRoleBlock = candidate.target_role?.trim() || secondaryRoles.length
    ? `
<target_role priority="high">
${
  candidate.target_role?.trim()
    ? `${first}'s stated target for their next role is: ${candidate.target_role.trim()}.

This is the authoritative answer to what ${first} is looking for, seeking next, or targeting. When asked what they want next, the type or level of role they are after, or their goals, lead with this exact target. Do NOT substitute a different title or seniority, even if the career narrative could support a different one. You may add helpful color, scope, industry, environment, from the information provided, but the target role itself is exactly as stated above.`
    : `${first} is open to roles such as: ${secondaryRoles.join('; ')}.`
}${candidate.target_role?.trim() ? secondaryLine : ''}
</target_role>
`
    : '';

  // Conversion nudge, woven into the assistant's own answer rather than scripted,
  // so it sounds like the candidate's assistant and not a lead-gen bot. It must
  // never replace a real answer; that guardrail is stated inside the block.
  const meetingInvitationBlock =
    meetingInvitation === 'gentle'
      ? `
<meeting_invitation>
This conversation has run several exchanges deep, which usually signals real interest. Keep answering every question as fully and honestly as always; never hold back an answer to steer toward a meeting. When it fits naturally, and only after you have actually answered, you may add one short, warm line inviting the recruiter to continue with ${first} directly: for example, that this is exactly the kind of thing ${first} enjoys getting into in a live conversation, and offer to help find a time. Keep it light and occasional: at most once every couple of replies, never in every message, and never in place of a real answer. If the recruiter asks about next steps or seems ready to talk, lean in and offer to set up a time.
</meeting_invitation>
`
      : '';

  const contextDocumentBlock = careerContextMarkdown
    ? `
<career_context_document>
This is ${first}'s professionally synthesized career narrative, the authoritative summary of who they are, their story, and the evidence behind it. When a question touches their background, lead from this; the resume below is the factual backstop.

${careerContextMarkdown}
</career_context_document>
`
    : '';

  return `
<role>
You are the Personal Assistant for ${name}. You represent ${name} to recruiters and hiring managers who are evaluating them for a role. You speak about ${name} in the third person ("${first}", "they", "their"), as their assistant. You are not ${name}.

You are not a FAQ bot. You reason across the full picture of ${first}'s career and give considered, human-sounding answers, always grounded strictly in the information provided below.
</role>
${partnerBlock}${contextDocumentBlock}
<career_information>
${resumeMarkdown ?? 'No resume text provided.'}
</career_information>

<context>
Target Role: ${candidate.target_role ?? 'Not specified'}
${first}'s Leadership Philosophy: ${candidate.leadership_philosophy ?? 'Not provided'}
${first}'s Key Wins: ${candidate.key_wins ?? 'Not provided'}
Reasons ${first} Left Each Role: ${candidate.departure_reasons ?? 'Not provided'}
${first}'s Biggest Professional Challenge: ${candidate.biggest_challenge ?? 'Not provided'}
${first}'s Ideal Team and Work Environment: ${candidate.ideal_environment ?? 'Not provided'}
What ${first} Needs From a Manager: ${candidate.manager_needs ?? 'Not provided'}
What ${first} Is Not Good At: ${candidate.honest_weaknesses ?? 'Not provided'}
Questions ${first} Wishes Recruiters Would Ask: ${candidate.wish_questions ?? 'Not provided'}
Additional Context: ${candidate.additional_context ?? 'Not provided'}
</context>
${targetRoleBlock}
<custom_answers priority="highest">
These are answers ${first} has personally refined. They are the definitive source for these topics and take priority over everything else here. Convey their substance faithfully in your own assistant voice (third person about ${first}); never contradict them.

${formatCustomQA(candidate.custom_qa_pairs)}
</custom_answers>

${exemplarBlock}

${boundaryBlock}

<grounding priority="highest">
Answer ONLY from the information provided above about ${first}. Never give a plausible-sounding answer that is not directly supported by it. Do not guess, estimate, infer beyond the evidence, or fill gaps with anything that merely sounds right.

If you cannot answer the question accurately and specifically from the information above, do not attempt an answer. Reply with exactly this and nothing else:
${REDIRECT_SENTINEL}

This also applies when: a specific number, date, or credential is not present in the information; the question concerns a redirect topic listed below; or the honest answer would be "I am not sure". In all of those cases, reply with exactly ${REDIRECT_SENTINEL}.
</grounding>

<principles>
Three values to reason from in every answer:

1. Honesty first. Represent only what is documented about ${first}. Never inflate a number, invent a credential, or claim an outcome the information does not support. When a detail is missing, do not approximate it; use ${REDIRECT_SENTINEL}.

2. Calm confidence. Not defensive. Acknowledge real concerns honestly and point to evidence. Do not apologize for documented facts. Do not accept a false premise; gently correct it before answering when you can do so from the evidence.

3. Human warmth. Sound like a thoughtful person, not a database. Natural language, third person about ${first}, appropriate brevity. No bullet points in a chat response. No corporate filler.
</principles>

<adversarial_posture>
Some recruiters will ask skeptical, challenging, or pressure-testing questions. When you can answer from the evidence: acknowledge the concern, correct any false premise calmly, and point to a specific documented fact about ${first}. When you cannot support the answer from the evidence, reply with ${REDIRECT_SENTINEL} rather than improvising.

Never: capitulate to a false premise, invent supporting detail under pressure, or approximate a figure that is not documented.
</adversarial_posture>

<redirect_topics>
These topics are not for you to answer; they go to a direct conversation with ${first}:

${formatRedirectTopics(candidate.redirect_topics)}

When a redirected topic comes up, reply with exactly ${REDIRECT_SENTINEL}.
</redirect_topics>

<voice>
${voiceDescriptor}

Respond in this register: concise, warm, grounded, third person about ${first}. 2 to 4 sentences for straightforward questions. A short paragraph for questions that need reasoning. Never a wall of text. Never bullet points in a chat response. No corporate filler.

Never use em dashes ("--" or the long dash). Use commas, semicolons, or periods instead.
</voice>
${meetingInvitationBlock}
<reasoning_instruction>
For questions that touch multiple parts of ${first}'s career at once, gaps plus pivots, short tenures plus commitment, specific metrics, locate the relevant facts across the information above before answering. Reason from the whole picture, not just the nearest matching field. If the picture is not actually supported by the information, reply with ${REDIRECT_SENTINEL}.
</reasoning_instruction>
`.trim();
}

// ── Supporting helpers ──────────────────────────────────────────────────────

/** Formats custom QA pairs as clean Q/A blocks. Placeholder when none exist. */
function formatCustomQA(pairs: CustomQAPair[]): string {
  if (!pairs || pairs.length === 0) return 'No custom answers added yet.';
  return pairs.map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`).join('\n\n');
}

/** Formats redirect topics as a simple list. Placeholder when none set. */
function formatRedirectTopics(topics: string[]): string {
  if (!topics || topics.length === 0) return 'No redirect topics set.';
  return topics.map((t) => `- ${t}`).join('\n');
}

/**
 * Few-shot block from the first 3 custom QA pairs. These are written by the
 * candidate in their own words; they are reference material for substance, which
 * the assistant conveys in third person about the candidate.
 */
function buildExemplarBlock(pairs: CustomQAPair[], first: string): string {
  if (!pairs || pairs.length === 0) return '';

  const exampleXml = pairs
    .slice(0, 3)
    .map(
      (pair, i) => `
<example index="${i + 1}">
  <recruiter_question>${pair.question}</recruiter_question>
  <reference_from_${'candidate'}>${pair.answer}</reference_from_${'candidate'}>
</example>`,
    )
    .join('\n');

  return `
<few_shot_examples>
Reference answers ${first} wrote about these questions. Convey the same substance about ${first} in your third-person assistant voice; do not quote first-person phrasing verbatim.

${exampleXml}
</few_shot_examples>`.trim();
}

/**
 * The explicit knowledge boundary, the strongest hallucination guard. States what
 * is known and what is not, and routes any unknown to the [[REDIRECT]] sentinel.
 */
function buildKnowledgeBoundary(
  candidate: CandidateBrain,
  resumeMarkdown: string | null,
  careerContextMarkdown: string | null,
  first: string,
): string {
  const knownSections: string[] = [];

  if (careerContextMarkdown) knownSections.push('Professionally synthesized career context document');
  if (resumeMarkdown) knownSections.push('Full career history from resume');
  if (candidate.key_wins) knownSections.push('Key wins with documented context');
  if (candidate.departure_reasons) knownSections.push('Reasons for leaving each role');
  if (candidate.leadership_philosophy) knownSections.push('Leadership philosophy');
  if (candidate.biggest_challenge) knownSections.push('Biggest professional challenge');
  if (candidate.ideal_environment) knownSections.push('Ideal team and work environment');
  if (candidate.manager_needs) knownSections.push('What they need from a manager');
  if (candidate.honest_weaknesses) knownSections.push('Honest professional weaknesses');
  if (candidate.wish_questions) knownSections.push('Questions they wish recruiters asked');
  if (candidate.custom_qa_pairs.length > 0) {
    knownSections.push(`${candidate.custom_qa_pairs.length} personally refined answers`);
  }

  const knownList =
    knownSections.length > 0
      ? knownSections.map((s) => `- ${s}`).join('\n')
      : '- Resume and career context provided above';

  return `
<knowledge_boundary>
<known>
Everything in${careerContextMarkdown ? ' CAREER CONTEXT DOCUMENT,' : ''} CAREER INFORMATION, CONTEXT, and CUSTOM ANSWERS above about ${first}.
Specifically:
${knownList}
</known>

<not_known>
- Salary expectations or compensation requirements
- Contact information beyond what is on the resume
- References or reference contact details
- Any specific number, date, credential, or metric not present in the information above
- Anything that happened after the resume was last updated
- Any detail ${first} has not chosen to share

For anything in this list, reply with exactly ${REDIRECT_SENTINEL}.
</not_known>

<when_not_known>
When asked about anything outside the known information, do not improvise and do not give a plausible guess. Reply with exactly ${REDIRECT_SENTINEL} and nothing else. The system will turn that into a graceful handoff to ${first}.
</when_not_known>
</knowledge_boundary>`.trim();
}

/**
 * Derives a voice descriptor. The assistant speaks about the candidate; where the
 * candidate's own writing is available, it informs tone, not grammatical person.
 */
function deriveVoiceDescriptor(candidate: CandidateBrain, first: string): string {
  const hasSufficientVoiceSamples =
    (candidate.leadership_philosophy?.length ?? 0) > 50 ||
    (candidate.biggest_challenge?.length ?? 0) > 50;

  if (!hasSufficientVoiceSamples) {
    return `Speak in a warm, direct voice as ${first}'s assistant. Confident but not boastful. Honest and specific.`;
  }

  const sample1 = candidate.leadership_philosophy?.slice(0, 100) ?? '';
  const sample2 = candidate.biggest_challenge?.slice(0, 100) ?? '';

  return `Let ${first}'s own register inform your tone. A sample of how ${first} writes:
"${sample1}${sample1 && sample2 ? '" / "' : ''}${sample2}"

Keep a tone consistent with that, warm and grounded, while speaking about ${first} in the third person. Do not impose a corporate or polished tone on top of their natural register.`;
}
````


#### `lib/ai/get-candidate-brain.ts`

Brain assembly: fetches profile brain columns, canonical resume markdown, and context package by public slug.

````ts
import 'server-only';
import { adminClient } from '@/lib/supabase/admin';
import type { CandidateBrain, CareerContextDrafts, CustomQAPair } from '@/lib/types';

// The columns that make up the brain, plus the gating flags and owner id.
// Sensitive fields here are intentionally barred from the anon role (see the
// 20260626 migration); this read uses the service-role client so the chatbot can
// assemble the full prompt server-side without depending on anon column access.
const BRAIN_COLUMNS =
  'id, clerk_user_id, full_name, target_role, leadership_philosophy, key_wins, departure_reasons, biggest_challenge, ideal_environment, manager_needs, honest_weaknesses, wish_questions, additional_context, custom_qa_pairs, redirect_topics, ai_enabled, is_published, context_package_md, career_context_drafts';

interface BrainRow {
  id: string;
  clerk_user_id: string;
  full_name: string;
  target_role: string | null;
  leadership_philosophy: string | null;
  key_wins: string | null;
  departure_reasons: string | null;
  biggest_challenge: string | null;
  ideal_environment: string | null;
  manager_needs: string | null;
  honest_weaknesses: string | null;
  wish_questions: string | null;
  additional_context: string | null;
  custom_qa_pairs: unknown;
  redirect_topics: string[] | null;
  ai_enabled: boolean;
  is_published: boolean;
  context_package_md: string | null;
  career_context_drafts: unknown;
}

export interface CandidateBrainResult {
  candidateProfileId: string;
  ownerClerkUserId: string;
  isPublished: boolean;
  aiEnabled: boolean;
  candidate: CandidateBrain;
  resumeMarkdown: string | null;
  /** The active career-context document (synthesized narrative), if any. */
  careerContextMarkdown: string | null;
}

/**
 * Loads a candidate's brain by slug for the chat endpoint. Returns null only
 * when the profile does not exist. The caller is responsible for gating on
 * isPublished / aiEnabled / ownership -- this lets the owner preview their own
 * unpublished AI from the dashboard while keeping it hidden from recruiters.
 * Only the assembled answer is ever returned to the client; the raw brain never
 * leaves the server.
 */
export async function getCandidateBrainBySlug(
  slug: string,
): Promise<CandidateBrainResult | null> {
  const { data, error } = await (adminClient.from('candidate_profiles') as any)
    .select(BRAIN_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as BrainRow;

  // Resume text lives in resume_documents (one row per profile); may be absent.
  const { data: doc } = await (adminClient.from('resume_documents') as any)
    .select('canonical_markdown')
    .eq('candidate_profile_id', row.id)
    .maybeSingle();

  // Secondary target roles, read separately and resiliently so a not-yet-migrated
  // DB (column absent) degrades to [] instead of breaking the public chat.
  const { data: secondaryRow } = await (adminClient.from('candidate_profiles') as any)
    .select('secondary_target_roles')
    .eq('id', row.id)
    .maybeSingle();
  const secondaryTargetRoles = Array.isArray(secondaryRow?.secondary_target_roles)
    ? (secondaryRow.secondary_target_roles as string[])
    : [];

  // The selected generated angle's hard-question answer is the single most
  // important worked exemplar. Promote it into custom_qa_pairs (highest priority
  // + few-shot) ahead of the candidate's own pairs, unless they already pinned an
  // answer to the same question.
  const baseQA = normalizeCustomQA(row.custom_qa_pairs);
  const customQA = withSelectedHardQuestion(baseQA, row.career_context_drafts);

  const candidate: CandidateBrain = {
    full_name: row.full_name,
    target_role: row.target_role,
    secondary_target_roles: secondaryTargetRoles,
    leadership_philosophy: row.leadership_philosophy,
    key_wins: row.key_wins,
    departure_reasons: row.departure_reasons,
    biggest_challenge: row.biggest_challenge,
    ideal_environment: row.ideal_environment,
    manager_needs: row.manager_needs,
    honest_weaknesses: row.honest_weaknesses,
    wish_questions: row.wish_questions,
    additional_context: row.additional_context,
    custom_qa_pairs: customQA,
    redirect_topics: Array.isArray(row.redirect_topics) ? row.redirect_topics : [],
  };

  const resumeMarkdown =
    doc && typeof doc.canonical_markdown === 'string' && doc.canonical_markdown.trim().length > 0
      ? (doc.canonical_markdown as string)
      : null;

  const careerContextMarkdown =
    typeof row.context_package_md === 'string' && row.context_package_md.trim().length > 0
      ? row.context_package_md
      : null;

  return {
    candidateProfileId: row.id,
    ownerClerkUserId: row.clerk_user_id,
    isPublished: row.is_published,
    aiEnabled: row.ai_enabled,
    candidate,
    resumeMarkdown,
    careerContextMarkdown,
  };
}

/**
 * Prepends the selected career-context angle's hard-question Q/A to the custom QA
 * pairs so it inherits highest-priority + few-shot treatment. No-op when there is
 * no selected angle, or when the candidate already has a pair for that question.
 */
function withSelectedHardQuestion(pairs: CustomQAPair[], rawDrafts: unknown): CustomQAPair[] {
  const drafts = rawDrafts as CareerContextDrafts | null;
  const selected = drafts?.selected ? drafts.angles?.[drafts.selected] : null;
  const hq = selected?.hard_question;
  if (!hq || !hq.question?.trim() || !hq.answer?.trim()) return pairs;

  const exists = pairs.some(
    (p) => p.question.trim().toLowerCase() === hq.question.trim().toLowerCase(),
  );
  if (exists) return pairs;

  return [{ question: hq.question.trim(), answer: hq.answer.trim() }, ...pairs];
}

/** Defensively coerce JSONB custom_qa_pairs into a typed, validated array. */
function normalizeCustomQA(raw: unknown): CustomQAPair[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is CustomQAPair =>
      !!p &&
      typeof (p as CustomQAPair).question === 'string' &&
      typeof (p as CustomQAPair).answer === 'string',
  );
}
````


#### `lib/ai/canonical-resume.ts`

Builds/serves the canonical resume markdown that becomes <career_information>.

````ts
import { z } from 'zod';

// The canonical, structured representation of a résumé. Single source of truth
// reused by the parser (lib/ai/parse-resume.ts), the .docx/.pdf renderers
// (lib/resume/*), and the profile-field derivation (lib/ai/derive-profile.ts).
//
// Keep this flat and constraint-light: it doubles as the tool input_schema sent
// to Claude, and we re-validate the model's output with the Zod schema below.

export const ContactSchema = z.object({
  full_name: z.string(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  location: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  website: z.string().nullish(),
});

export const ExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  highlights: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullish(),
  field: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
});

export const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().nullish(),
  date: z.string().nullish(),
});

export const CanonicalResumeSchema = z.object({
  contact: ContactSchema,
  headline: z.string().nullish(),
  summary: z.string().nullish(),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(z.string()).default([]),
  certifications: z.array(CertificationSchema).default([]),
});

export type CanonicalResume = z.infer<typeof CanonicalResumeSchema>;

// JSON Schema handed to Claude as the `submit_resume` tool's input_schema.
// Mirrors the Zod shape above; the Zod schema re-validates the returned input.
export const CANONICAL_RESUME_JSON_SCHEMA = {
  type: 'object',
  properties: {
    contact: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Candidate full name' },
        email: { type: 'string' },
        phone: { type: 'string' },
        location: { type: 'string', description: 'City, State / Country' },
        linkedin_url: { type: 'string' },
        website: { type: 'string' },
      },
      required: ['full_name'],
    },
    headline: { type: 'string', description: 'One-line professional headline' },
    summary: { type: 'string', description: 'Professional summary paragraph' },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          location: { type: 'string' },
          start_date: { type: 'string', description: 'e.g. "Jan 2021"' },
          end_date: { type: 'string', description: 'e.g. "Present"' },
          highlights: {
            type: 'array',
            items: { type: 'string' },
            description: 'Accomplishment bullets, ideally quantified',
          },
        },
        required: ['company', 'title'],
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          institution: { type: 'string' },
          degree: { type: 'string' },
          field: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
        },
        required: ['institution'],
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          issuer: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  required: ['contact'],
} as const;

// Deterministic Markdown rendering of the canonical résumé. This is the editable
// source of truth shown to the candidate; editing + saving it re-generates the
// .docx/.pdf in Phase 1.
export function canonicalResumeToMarkdown(resume: CanonicalResume): string {
  const lines: string[] = [];
  const c = resume.contact;

  lines.push(`# ${c.full_name}`);
  if (resume.headline) lines.push(`\n_${resume.headline}_`);

  const contactBits = [c.email, c.phone, c.location, c.linkedin_url, c.website].filter(Boolean);
  if (contactBits.length) lines.push(`\n${contactBits.join(' · ')}`);

  if (resume.summary) {
    lines.push('\n## Summary', '', resume.summary);
  }

  if (resume.experience.length) {
    lines.push('\n## Experience');
    for (const e of resume.experience) {
      const dates = [e.start_date, e.end_date].filter(Boolean).join(' – ');
      const heading = [e.title, e.company].filter(Boolean).join(', ');
      lines.push(`\n### ${heading}`);
      const meta = [e.location, dates].filter(Boolean).join(' · ');
      if (meta) lines.push(`_${meta}_`);
      for (const h of e.highlights) lines.push(`- ${h}`);
    }
  }

  if (resume.education.length) {
    lines.push('\n## Education');
    for (const ed of resume.education) {
      const degree = [ed.degree, ed.field].filter(Boolean).join(', ');
      const dates = [ed.start_date, ed.end_date].filter(Boolean).join(' – ');
      lines.push(`\n### ${ed.institution}`);
      const meta = [degree, dates].filter(Boolean).join(' · ');
      if (meta) lines.push(`_${meta}_`);
    }
  }

  if (resume.skills.length) {
    lines.push('\n## Skills', '', resume.skills.join(', '));
  }

  if (resume.certifications.length) {
    lines.push('\n## Certifications');
    for (const cert of resume.certifications) {
      const meta = [cert.issuer, cert.date].filter(Boolean).join(' · ');
      lines.push(`- ${cert.name}${meta ? ` (${meta})` : ''}`);
    }
  }

  return lines.join('\n').trim() + '\n';
}
````


#### `lib/ai/log-chat.ts`

Session creation (ensureChatSession) and per-exchange logging into chat_sessions / chat_messages.

````ts
import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// Chat logging runs through the service-role client: recruiters are anonymous
// (no Clerk JWT), so RLS-scoped clients cannot write the session/message rows.
// Every helper here is best-effort -- a logging failure must never break the
// chat response the recruiter is waiting on.
//
// Because failures are swallowed, a broken config (e.g. an unset
// SUPABASE_SERVICE_ROLE_KEY) would otherwise produce zero transcripts with no
// signal at all. reportRecordingFailure() makes that loud and greppable: a
// consistent tag on every failure, and a one-time, high-signal warning when the
// root cause is missing admin env. Grep production logs for TRANSCRIPT_RECORDING.

const RECORDING_TAG = 'TRANSCRIPT_RECORDING';
let warnedMissingEnv = false;

function reportRecordingFailure(stage: string, id: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${RECORDING_TAG}] ${stage} failed for ${id}:`, error);
  if (message.includes('admin env vars not set') && !warnedMissingEnv) {
    warnedMissingEnv = true;
    console.error(
      `[${RECORDING_TAG}] CRITICAL: SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is ` +
        'not set. Chats still answer, but NO transcripts are being recorded. Set the env var ' +
        'to restore recording, delivery, and the AI-improvement gap loop.',
    );
  }
}

interface SessionViewer {
  viewerClerkUserId?: string | null;
  employerAccountId?: string | null;
  employerCompanyName?: string | null;
  /** Optional recruiter self-introduction captured before the first message. */
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  isSandbox?: boolean;
}

/**
 * Returns the existing sessionId, or creates a new chat_sessions row on the
 * first message of a conversation. Returns null if creation fails (the caller
 * then skips message logging but still returns the answer).
 */
export async function ensureChatSession(
  candidateProfileId: string,
  sessionId: string | undefined,
  viewer: SessionViewer = {},
): Promise<string | null> {
  if (sessionId) return sessionId;

  try {
    const { data, error } = await (adminClient.from('chat_sessions') as any)
      .insert({
        candidate_profile_id: candidateProfileId,
        viewer_clerk_user_id: viewer.viewerClerkUserId ?? null,
        employer_account_id: viewer.employerAccountId ?? null,
        employer_company_name: viewer.employerCompanyName ?? null,
        recruiter_name: viewer.recruiterName ?? null,
        recruiter_email: viewer.recruiterEmail ?? null,
        is_sandbox: viewer.isSandbox ?? false,
      })
      .select('id')
      .single();

    if (error || !data) {
      reportRecordingFailure('ensureChatSession insert', candidateProfileId, error);
      return null;
    }
    return data.id as string;
  } catch (e) {
    reportRecordingFailure('ensureChatSession', candidateProfileId, e);
    return null;
  }
}

/**
 * Logs the user question and the assistant answer for a session. The model and
 * validation tracking (Phase B) is meaningful only on the assistant turn; the
 * user turn carries the same columns at their defaults.
 *
 * Both rows MUST have identical keys. PostgREST derives the column list for a
 * bulk insert from the row shape and rejects the whole batch with a 400 when the
 * objects' keys differ -- so the user row explicitly carries the tracking
 * columns too, rather than omitting them. (This mismatch is what silently
 * dropped every transcript message before.)
 */
export async function logChatExchange(params: {
  sessionId: string;
  question: string;
  answer: string;
  modelUsed?: string;
  wasComplex?: boolean;
  wasValidated?: boolean;
}): Promise<void> {
  try {
    const { error } = await (adminClient.from('chat_messages') as any).insert([
      {
        chat_session_id: params.sessionId,
        role: 'user',
        content: params.question,
        model_used: null,
        was_complex: false,
        was_validated: false,
      },
      {
        chat_session_id: params.sessionId,
        role: 'assistant',
        content: params.answer,
        model_used: params.modelUsed ?? null,
        was_complex: params.wasComplex ?? false,
        was_validated: params.wasValidated ?? false,
      },
    ]);
    // supabase-js returns errors as a value (no throw), so an unchecked insert
    // failed silently before. Surface it through the same observability path.
    if (error) reportRecordingFailure('logChatExchange insert', params.sessionId, error);
  } catch (e) {
    reportRecordingFailure('logChatExchange', params.sessionId, e);
  }
}
````


---

## 5. Fine-tuning, context accumulation, and learning over time

There is no model fine-tuning; every learning mechanism curates data that the prompt builder injects. The loops, in the order a candidate encounters them:

| Loop | Entry point | Storage | Reaches the prompt via |
|---|---|---|---|
| Intake interview | `IntakeInterview` dialog, `/api/intake/*` | `intake_answers` + readiness columns | assembled into brain context fields |
| Custom Q&A editing | AI Studio, `app/(candidate)/dashboard/ai/actions.ts` | `candidate_profiles.custom_qa_pairs` (JSONB) | `<custom_answers priority="highest">` + few-shot exemplars |
| Transcript gap loop | auto, on every transcript delivery | `transcript_gaps` (+ `suggested_answer`) | one-click adopt into `custom_qa_pairs` (`adoptGapAnswer`) |
| Sandbox self-test | `SandboxPanel`, `/api/sandbox/analyze` | `sandbox_sessions` | verdicts deep-link to "strengthen field" edits |
| External hardening | `HardenPanel`, `/api/transcript/harden` | `brain_hardening_sessions` (results only) | recommended actions become QA pairs / field edits |
| Career-context augment | `/api/career-context/augment` | `context_package_md` (re-synthesized) | the document layer of the prompt, distilled not appended |
| Fresh start (forget everything) | Settings, `app/(candidate)/dashboard/settings/actions.ts` | wipes all of the above | resets the brain to a blank slate |

Deliberate decision (CLAUDE.md, Career Context Document): new context enters the brain **distilled, not appended**, "deepen the synthesis loop" over stacking raw context layers. Deleting a transcript never removes training; `custom_qa_pairs` live independently on `candidate_profiles`.

#### `app/(candidate)/dashboard/ai/actions.ts`

AI Studio server actions: custom QA CRUD, redirect topics, ai_enabled toggle, adoptGapAnswer (one-click gap-to-QA), gap dismissal.

````ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { assertCandidateAiAccess, EntitlementError } from '@/lib/auth/entitlements';
import type { CareerContextDrafts, CustomQAPair } from '@/lib/types';

const BrainInput = z.object({
  leadership_philosophy: z.string().max(5000).optional(),
  key_wins: z.string().max(5000).optional(),
  departure_reasons: z.string().max(5000).optional(),
  biggest_challenge: z.string().max(5000).optional(),
  ideal_environment: z.string().max(5000).optional(),
  manager_needs: z.string().max(5000).optional(),
  honest_weaknesses: z.string().max(5000).optional(),
  wish_questions: z.string().max(5000).optional(),
  custom_qa_pairs: z
    .array(
      z.object({
        question: z.string().min(1).max(500),
        answer: z.string().min(1).max(3000),
      }),
    )
    .max(50),
  redirect_topics: z.array(z.string().min(1).max(100)).max(30),
  ai_enabled: z.boolean(),
});

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export async function updateCandidateBrain(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const parsed = BrainInput.parse(input);

    const { error } = await supabase
      .from('candidate_profiles')
      .update({
        leadership_philosophy: clean(parsed.leadership_philosophy),
        key_wins: clean(parsed.key_wins),
        departure_reasons: clean(parsed.departure_reasons),
        biggest_challenge: clean(parsed.biggest_challenge),
        ideal_environment: clean(parsed.ideal_environment),
        manager_needs: clean(parsed.manager_needs),
        honest_weaknesses: clean(parsed.honest_weaknesses),
        wish_questions: clean(parsed.wish_questions),
        custom_qa_pairs: parsed.custom_qa_pairs,
        redirect_topics: parsed.redirect_topics,
        ai_enabled: parsed.ai_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId);

    if (error) {
      console.error('updateCandidateBrain: failed', userId, error);
      return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    }

    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const SelectAngleInput = z.object({ angle: z.enum(['A', 'B']) });

// Promotes one generated narrative angle to the candidate's active career-context
// document. Records the selection on career_context_drafts and copies the chosen
// angle's markdown into context_package_md -- the single slot the brain reads and
// the assets page downloads. Switching angles later is just another call here; no
// regeneration needed.
export async function selectCareerContextAngle(input: unknown) {
  try {
    const { supabase, userId, user } = await getUserContext('candidate');
    assertCandidateAiAccess(user);
    const { angle } = SelectAngleInput.parse(input);

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('career_context_drafts')
      .eq('clerk_user_id', userId)
      .single();

    const drafts = (profile as { career_context_drafts: CareerContextDrafts | null } | null)
      ?.career_context_drafts;
    const chosen = drafts?.angles?.[angle];
    if (!drafts || !chosen) {
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'No generated angle to select' } };
    }

    const updated: CareerContextDrafts = { ...drafts, selected: angle };
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('candidate_profiles')
      .update({
        career_context_drafts: updated,
        context_package_md: chosen.markdown,
        context_package_updated_at: now,
        updated_at: now,
      })
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    revalidatePath('/dashboard/assets');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof EntitlementError) return { ok: false as const, error: { code: e.code } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const SourceIdInput = z.object({ sourceId: z.string().uuid() });

export async function deleteCareerSource(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sourceId } = SourceIdInput.parse(input);

    // RLS scopes the delete to the candidate's own sources.
    const { error } = await supabase.from('career_sources').delete().eq('id', sourceId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const AdoptGapInput = z.object({ gapId: z.string().uuid() });

/**
 * One-click learning: approves a gap's drafted answer into custom_qa_pairs
 * (highest-priority layer of the brain) and marks the gap addressed. The draft
 * was generated grounded only in the brain's own data; the candidate's click is
 * the human approval step.
 */
export async function adoptGapAnswer(input: unknown) {
  try {
    const { supabase, userId, user } = await getUserContext('candidate');
    assertCandidateAiAccess(user);
    const { gapId } = AdoptGapInput.parse(input);

    // RLS scopes both reads to the candidate's own rows.
    const { data: gap } = await supabase
      .from('transcript_gaps')
      .select('id, question_asked, suggested_answer, is_addressed')
      .eq('id', gapId)
      .maybeSingle();
    const gapRow = gap as {
      id: string;
      question_asked: string;
      suggested_answer: string | null;
      is_addressed: boolean;
    } | null;
    if (!gapRow || !gapRow.suggested_answer?.trim()) {
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'No drafted answer to adopt' } };
    }

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('custom_qa_pairs')
      .eq('clerk_user_id', userId)
      .single();
    if (!profile) return { ok: false as const, error: { code: 'NOT_FOUND' } };

    const rawPairs = (profile as { custom_qa_pairs: unknown }).custom_qa_pairs;
    const pairs: CustomQAPair[] = Array.isArray(rawPairs)
      ? (rawPairs as CustomQAPair[]).filter(
          (p) => p && typeof p.question === 'string' && typeof p.answer === 'string',
        )
      : [];

    const question = gapRow.question_asked.trim();
    const answer = gapRow.suggested_answer.trim();
    const exists = pairs.some((p) => p.question.trim().toLowerCase() === question.toLowerCase());
    if (!exists) {
      if (pairs.length >= 50) {
        return {
          ok: false as const,
          error: { code: 'INVALID_INPUT', message: 'Custom answers are full (50). Remove one first.' },
        };
      }
      pairs.push({ question, answer });
      const { error: updateError } = await supabase
        .from('candidate_profiles')
        .update({ custom_qa_pairs: pairs, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', userId);
      if (updateError) {
        return { ok: false as const, error: { code: 'INTERNAL', message: updateError.message } };
      }
    }

    await supabase.from('transcript_gaps').update({ is_addressed: true }).eq('id', gapId);

    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof EntitlementError) return { ok: false as const, error: { code: e.code } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const GapIdInput = z.object({ gapId: z.string().uuid() });

export async function markGapAddressed(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { gapId } = GapIdInput.parse(input);

    // RLS scopes the update to the candidate's own transcript gaps.
    const { error } = await supabase
      .from('transcript_gaps')
      .update({ is_addressed: true })
      .eq('id', gapId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

const SessionIdInput = z.object({ sessionId: z.string().uuid() });

export async function deleteHardeningSession(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sessionId } = SessionIdInput.parse(input);

    // RLS scopes the delete to the candidate's own hardening sessions.
    const { error } = await supabase
      .from('brain_hardening_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

export async function clearHardeningHistory() {
  try {
    const { supabase, userId } = await getUserContext('candidate');

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();
    if (!profile) return { ok: false as const, error: { code: 'NOT_FOUND' } };

    // RLS scopes this too; the explicit filter keeps it indexed and clear.
    const { error } = await supabase
      .from('brain_hardening_sessions')
      .delete()
      .eq('candidate_profile_id', (profile as { id: string }).id);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
````


#### `lib/ai/analyze-transcript.ts`

Post-delivery transcript analysis: finds deflections/weak answers/new topics, drafts suggested answers.

````ts
import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import { BRAIN_CATEGORIES } from './intake';
import type { CandidateBrain, ChatTurn, TranscriptGapItem } from '@/lib/types';

const SYSTEM_PROMPT = `You analyze a recruiter's conversation with a candidate's career AI to find where the brain fell short, so the candidate can strengthen it.

Compare the transcript to the candidate's verified career data and identify gaps:
- "deflection": the AI declined or could not answer because the data was not there.
- "weak": the AI answered vaguely, or the recruiter had to follow up to get specifics.
- "new_topic": the recruiter raised a topic the brain does not cover at all.

For each gap, write a specific, ready-to-show expansion prompt grounded in what the brain already has -- never generic. Map each to exactly one brain category: ${BRAIN_CATEGORIES.join(', ')}. Assign a priority (high = the recruiter clearly needed it and didn't get it). Return at most 5 gaps, highest priority first. If the AI handled everything well, return an empty array. Submit via the submit_gaps tool.

When the career data ALREADY contains the substance for a strong answer (typical for "weak" gaps, where the AI answered thinly despite good underlying data), also draft suggestedAnswer: a polished, first-person answer to the recruiter's question, 2 to 4 sentences, grounded ONLY in the career data. Never invent a fact, number, or credential; never use em dashes, use commas or periods instead. The candidate approves it with one click, so it must be safe to publish verbatim. When the data genuinely lacks the substance (most "deflection" and "new_topic" gaps), omit suggestedAnswer entirely, the candidate has to write that one.`;

const GAPS_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionAsked: { type: 'string' },
          chatbotAnswer: { type: 'string' },
          gapType: { type: 'string', enum: ['deflection', 'weak', 'new_topic'] },
          suggestedPrompt: { type: 'string' },
          suggestedAnswer: {
            type: 'string',
            description:
              'Ready-to-approve first-person answer, ONLY when the career data already contains the substance. Omit otherwise.',
          },
          category: { type: 'string', enum: [...BRAIN_CATEGORIES] },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['questionAsked', 'chatbotAnswer', 'gapType', 'suggestedPrompt', 'category', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['gaps'],
  additionalProperties: false,
};

function careerData(c: CandidateBrain, resumeMarkdown: string | null): string {
  const blob = [
    resumeMarkdown,
    c.key_wins,
    c.departure_reasons,
    c.biggest_challenge,
    c.leadership_philosophy,
    c.ideal_environment,
    c.manager_needs,
    c.honest_weaknesses,
    c.wish_questions,
    c.additional_context,
    ...c.custom_qa_pairs.map((p) => `${p.question}\n${p.answer}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  return blob || 'No career data has been provided yet.';
}

/**
 * Analyzes a finished recruiter transcript against the brain and returns the
 * gaps worth surfacing to the candidate. Returns [] on any failure (best-effort,
 * called fire-and-forget from transcript delivery).
 */
export async function analyzeTranscriptGaps(params: {
  candidate: CandidateBrain;
  resumeMarkdown: string | null;
  messages: ChatTurn[];
}): Promise<TranscriptGapItem[]> {
  const transcript = params.messages
    .map((m) => `${m.role === 'user' ? 'Recruiter' : 'AI'}: ${m.content}`)
    .join('\n');

  try {
    const response = await anthropic.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: 'submit_gaps',
          description: 'Submit the gaps found in the transcript.',
          input_schema: GAPS_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_gaps' },
      messages: [
        {
          role: 'user',
          content: `CANDIDATE CAREER DATA:\n${careerData(params.candidate, params.resumeMarkdown)}\n\nTRANSCRIPT:\n${transcript}`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') return [];
    const raw = block.input as { gaps?: TranscriptGapItem[] };
    return (raw.gaps ?? []).slice(0, 5);
  } catch (e) {
    console.error('analyzeTranscriptGaps: failed', e);
    return [];
  }
}
````


#### `lib/ai/analyze-sandbox.ts`

Grades sandbox answers: strong / adequate / weak / hallucinated verdicts + field pointers.

````ts
import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import type { CandidateBrain, SandboxAnalysis, SandboxVerdict } from '@/lib/types';

const SYSTEM_PROMPT = `You are an elite recruiting coach. A candidate has a personal career AI that answers recruiters on their behalf. Your job is to evaluate how that AI answered one hard recruiter question, judged ONLY against the candidate's verified career data, and tell the candidate exactly what to fix.

Evaluate the answer against this rubric:
- Did it use specific, documented facts, or vague generalizations?
- Did it stay grounded in the career data, or drift toward invented detail?
- Was the length appropriate -- not too short, not a wall of text?
- Did it sound like a real person, or a generic AI?
- If the question was adversarial or had a false premise, did it stay calm and correct the premise, or capitulate?
- If the answer stated a number, metric, or credential, is that claim present in the career data?

Then assign a verdict:
- "strong" -- grounded, specific, and handled the question well.
- "adequate" -- acceptable but would be stronger with more context.
- "weak" -- vague, deflected unnecessarily, or missed the point.
- "hallucinated" -- contains a claim (number, credential, fact) NOT present in the career data. This is the most serious verdict.

Rules for your output:
- The diagnosis must be specific and reference what the answer actually did. Never write "this could be improved."
- The prescription must say exactly what to add and where.
- brainFieldTarget must be the single field most worth strengthening: one of leadership_philosophy, key_wins, departure_reasons, biggest_challenge, ideal_environment, manager_needs, honest_weaknesses, wish_questions, or custom_qa. Use null only if nothing needs work.
- The expansionPrompt is a concrete question that prompts the candidate to write the missing context, grounded in what is already there.
Submit your evaluation via the submit_analysis tool.`;

const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['strong', 'adequate', 'weak', 'hallucinated'],
      description: 'The overall verdict for this answer.',
    },
    diagnosis: {
      type: 'string',
      description: 'Plain-language, specific finding: what the answer did well or poorly and why. Never generic.',
    },
    prescription: {
      type: 'string',
      description: 'Exactly what to add and where to make the answer stronger.',
    },
    brainFieldTarget: {
      type: 'string',
      description:
        'The single brain field most worth strengthening: leadership_philosophy, key_wins, departure_reasons, biggest_challenge, ideal_environment, manager_needs, honest_weaknesses, wish_questions, or custom_qa. Omit if nothing needs work.',
    },
    expansionPrompt: {
      type: 'string',
      description: 'A concrete prompt that gets the candidate started writing the missing context.',
    },
  },
  required: ['verdict', 'diagnosis', 'prescription', 'expansionPrompt'],
  additionalProperties: false,
};

/**
 * Evaluates one sandbox answer against the candidate's verified brain using
 * Sonnet with a forced tool call (mirrors lib/ai/parse-resume.ts), so the model
 * must return structured output. Returns the validated coaching analysis.
 */
export async function analyzeSandboxAnswer(params: {
  candidate: CandidateBrain;
  resumeMarkdown: string | null;
  question: string;
  answer: string;
  category: string;
}): Promise<SandboxAnalysis> {
  const careerData = assembleCareerData(params.candidate, params.resumeMarkdown);

  const userContent = `RECRUITER QUESTION (category: ${params.category}):
${params.question}

THE CANDIDATE'S AI ANSWERED:
${params.answer}

THE CANDIDATE'S VERIFIED CAREER DATA (the only facts the AI is allowed to use):
${careerData}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'submit_analysis',
        description: 'Submit the structured evaluation of the answer.',
        input_schema: ANALYSIS_JSON_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_analysis' },
    messages: [{ role: 'user', content: userContent }],
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Sandbox analysis did not return structured output');
  }

  const raw = toolUse.input as {
    verdict: SandboxVerdict;
    diagnosis: string;
    prescription: string;
    brainFieldTarget?: string | null;
    expansionPrompt: string;
  };

  return {
    verdict: raw.verdict,
    diagnosis: raw.diagnosis,
    prescription: raw.prescription,
    brainFieldTarget: raw.brainFieldTarget?.trim() ? raw.brainFieldTarget.trim() : null,
    expansionPrompt: raw.expansionPrompt,
  };
}

/** Assembles every factual field of the brain into one reference blob. */
function assembleCareerData(c: CandidateBrain, resumeMarkdown: string | null): string {
  const blob = [
    resumeMarkdown,
    c.key_wins,
    c.departure_reasons,
    c.biggest_challenge,
    c.leadership_philosophy,
    c.ideal_environment,
    c.manager_needs,
    c.honest_weaknesses,
    c.wish_questions,
    c.additional_context,
    ...c.custom_qa_pairs.map((p) => `${p.question}\n${p.answer}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  return blob || 'No career data has been provided yet.';
}
````


#### `lib/ai/sandbox-questions.ts`

The 20-question sandbox library the candidate tests the brain against.

````ts
import type { SandboxQuestion } from '@/lib/types';

// The 20 hardest recruiter questions, grouped by category. Drawn from real
// recruiter behavior in screening calls; phrased generically with light
// placeholders so they apply to any candidate. Each maps to the brain field(s)
// it stress-tests, so a weak answer can point straight at the field to fix.
export const SANDBOX_QUESTIONS: SandboxQuestion[] = [
  // ── Gaps and departures ────────────────────────────────────────────────────
  {
    id: 'gap-1',
    category: 'gap_departure',
    question: 'Walk me through the gap between your last two roles.',
    whyItMatters: 'Employment gaps get flagged in the first minute of most screens.',
    brainFields: ['departure_reasons'],
  },
  {
    id: 'gap-2',
    category: 'gap_departure',
    question: 'Why did you leave your most recent role?',
    whyItMatters: 'The single most common opening question, your answer sets the tone.',
    brainFields: ['departure_reasons'],
  },
  {
    id: 'gap-3',
    category: 'gap_departure',
    question: 'What actually happened at your last company?',
    whyItMatters: 'Probes for a layoff, conflict, or anything you might be smoothing over.',
    brainFields: ['departure_reasons', 'biggest_challenge'],
  },
  {
    id: 'gap-4',
    category: 'gap_departure',
    question: 'I see a few short stints in the last few years. What was going on?',
    whyItMatters: 'Pattern questions need one calm, consistent narrative.',
    brainFields: ['departure_reasons'],
  },

  // ── Commitment and tenure ──────────────────────────────────────────────────
  {
    id: 'tenure-1',
    category: 'commitment_tenure',
    question: 'Your average tenure is under two years. What guarantees you will stay?',
    whyItMatters: 'Hiring is expensive; recruiters screen hard for flight risk.',
    brainFields: ['departure_reasons', 'ideal_environment'],
  },
  {
    id: 'tenure-2',
    category: 'commitment_tenure',
    question: 'You look overqualified for this role. Why do you want it?',
    whyItMatters: 'Overqualification reads as "will leave when something better appears."',
    brainFields: ['ideal_environment', 'wish_questions'],
  },
  {
    id: 'tenure-3',
    category: 'commitment_tenure',
    question: 'Where do you see yourself in five years?',
    whyItMatters: 'Tests whether this role fits your real trajectory.',
    brainFields: ['wish_questions', 'ideal_environment'],
  },

  // ── Metric and achievement verification ───────────────────────────────────
  {
    id: 'metric-1',
    category: 'metric_verification',
    question: 'Walk me through exactly how you calculated that cost-savings figure.',
    whyItMatters: 'Recruiters pressure-test big numbers; vague math kills credibility.',
    brainFields: ['key_wins'],
  },
  {
    id: 'metric-2',
    category: 'metric_verification',
    question: 'How did you measure the improvement you mention?',
    whyItMatters: 'A claimed result you cannot explain looks invented.',
    brainFields: ['key_wins'],
  },
  {
    id: 'metric-3',
    category: 'metric_verification',
    question: 'That team size seems large for that role. Can you clarify your actual scope?',
    whyItMatters: 'Scope inflation is a classic background-check failure point.',
    brainFields: ['key_wins'],
  },

  // ── Leadership and management ──────────────────────────────────────────────
  {
    id: 'lead-1',
    category: 'leadership',
    question: 'Describe how you handle an underperforming team member. Give me a real example.',
    whyItMatters: 'Generic leadership platitudes fail; they want a concrete story.',
    brainFields: ['leadership_philosophy', 'biggest_challenge'],
  },
  {
    id: 'lead-2',
    category: 'leadership',
    question: 'Tell me about a time you disagreed with your manager. What did you do?',
    whyItMatters: 'Reveals how you handle conflict and authority.',
    brainFields: ['leadership_philosophy', 'manager_needs'],
  },
  {
    id: 'lead-3',
    category: 'leadership',
    question: 'What would your last direct report say is your biggest weakness as a leader?',
    whyItMatters: 'Self-awareness under a pointed framing is hard to fake.',
    brainFields: ['honest_weaknesses', 'leadership_philosophy'],
  },

  // ── Adversarial premise ────────────────────────────────────────────────────
  {
    id: 'adv-1',
    category: 'adversarial',
    question: 'Given your background, why should I trust your commitment to this role?',
    whyItMatters: 'A loaded premise; the AI must stay calm and pivot to evidence.',
    brainFields: ['wish_questions', 'departure_reasons'],
  },
  {
    id: 'adv-2',
    category: 'adversarial',
    question: 'Your resume shows accomplishments but no degree. How do you respond to that?',
    whyItMatters: 'Credential gaps need a confident, non-defensive answer.',
    brainFields: ['key_wins'],
  },
  {
    id: 'adv-3',
    category: 'adversarial',
    question: 'Candidates with your profile usually struggle in this kind of role. How are you different?',
    whyItMatters: 'A false-premise trap; capitulating to it is a losing move.',
    brainFields: ['key_wins', 'ideal_environment'],
  },

  // ── Weakness and failure ───────────────────────────────────────────────────
  {
    id: 'weak-1',
    category: 'weakness_failure',
    question: 'What are you genuinely not good at? Be honest.',
    whyItMatters: 'A humblebrag is obvious; a real answer builds trust.',
    brainFields: ['honest_weaknesses'],
  },
  {
    id: 'weak-2',
    category: 'weakness_failure',
    question: 'Tell me about your biggest professional failure and what you learned.',
    whyItMatters: 'Failure questions test ownership and growth.',
    brainFields: ['biggest_challenge', 'honest_weaknesses'],
  },
  {
    id: 'weak-3',
    category: 'weakness_failure',
    question: 'What would your references say are your weaknesses?',
    whyItMatters: 'Third-party framing makes a vague answer obvious.',
    brainFields: ['honest_weaknesses'],
  },
  {
    id: 'weak-4',
    category: 'weakness_failure',
    question: 'What is the hardest problem you have solved, and how did you approach it?',
    whyItMatters: 'Depth question; thin answers reveal a thin brain.',
    brainFields: ['biggest_challenge', 'key_wins'],
  },
];
````


#### `lib/ai/harden-transcript.ts`

External transcript hardening analysis (coverage verdicts + recommended actions; transcript never persisted).

````ts
import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import { BRAIN_CATEGORIES } from './intake';
import type { CandidateBrain, BrainHardeningResult } from '@/lib/types';

const FIELD_TARGETS = [...BRAIN_CATEGORIES, 'custom_qa'];

const SYSTEM_PROMPT = `You harden a candidate's career AI against questions that ACTUALLY came up in a real conversation. The candidate pasted a transcript from an external source -- a recruiter screening call, a practice session with another AI, a LinkedIn thread, or interview-debrief notes. Your job is to find where their career AI would fall short on these exact questions and produce a prioritized plan to fix it.

Steps:
1. Extract the substantive questions the candidate was asked (or clearly needs to answer). Ignore pleasantries and scheduling. Count them as questionsFound.
2. For each, judge how well the candidate's verified career data already covers it:
   - "strong": the brain has a specific, grounded answer.
   - "adequate": answerable but thin.
   - "weak": the brain only has a vague or partial answer.
   - "missing": the brain has nothing for this.
3. Put every "weak" and "missing" question into gapsIdentified. For each, write a specific, ready-to-use expansion prompt grounded in what the brain already has -- never generic -- and map it to exactly one target: ${FIELD_TARGETS.join(', ')}.
4. List the questions handled "strong" or "adequate" as short labels in strongCoverageConfirmed.
5. Produce a hardeningPlan: 3-5 actions ranked by impact (priority 1 = do first), each a plain-language instruction plus its brainFieldTarget and expansionPrompt.

Assign each gap a priority: high = a recruiter clearly needed this and the brain can't deliver; low = nice-to-have. If the brain already covers everything well, return empty gapsIdentified and hardeningPlan. Submit via the submit_hardening tool.`;

const HARDENING_SCHEMA = {
  type: 'object',
  properties: {
    questionsFound: { type: 'integer' },
    gapsIdentified: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionFromTranscript: { type: 'string' },
          brainCoverageVerdict: { type: 'string', enum: ['strong', 'adequate', 'weak', 'missing'] },
          expansionPrompt: { type: 'string' },
          brainFieldTarget: { type: 'string', enum: FIELD_TARGETS },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['questionFromTranscript', 'brainCoverageVerdict', 'expansionPrompt', 'brainFieldTarget', 'priority'],
        additionalProperties: false,
      },
    },
    strongCoverageConfirmed: { type: 'array', items: { type: 'string' } },
    hardeningPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'integer' },
          action: { type: 'string' },
          brainFieldTarget: { type: 'string', enum: FIELD_TARGETS },
          expansionPrompt: { type: 'string' },
        },
        required: ['priority', 'action', 'brainFieldTarget', 'expansionPrompt'],
        additionalProperties: false,
      },
    },
  },
  required: ['questionsFound', 'gapsIdentified', 'strongCoverageConfirmed', 'hardeningPlan'],
  additionalProperties: false,
};

function careerData(c: CandidateBrain, resumeMarkdown: string | null): string {
  const blob = [
    resumeMarkdown,
    c.key_wins,
    c.departure_reasons,
    c.biggest_challenge,
    c.leadership_philosophy,
    c.ideal_environment,
    c.manager_needs,
    c.honest_weaknesses,
    c.wish_questions,
    c.additional_context,
    ...c.custom_qa_pairs.map((p) => `${p.question}\n${p.answer}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  return blob || 'No career data has been provided yet.';
}

/**
 * Analyzes an external transcript against the brain and returns a prioritized
 * hardening plan. Throws on failure (the route turns that into a 500) -- unlike
 * the fire-and-forget post-session analyzer, this one is user-initiated and the
 * candidate is waiting on the result.
 */
export async function hardenTranscriptAnalysis(params: {
  candidate: CandidateBrain;
  resumeMarkdown: string | null;
  transcriptText: string;
  sourceContext?: string | null;
}): Promise<BrainHardeningResult> {
  const context = params.sourceContext?.trim()
    ? `SOURCE CONTEXT: ${params.sourceContext.trim()}\n\n`
    : '';

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'submit_hardening',
        description: 'Submit the hardening analysis for this transcript.',
        input_schema: HARDENING_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_hardening' },
    messages: [
      {
        role: 'user',
        content: `CANDIDATE CAREER DATA:\n${careerData(params.candidate, params.resumeMarkdown)}\n\n${context}TRANSCRIPT:\n${params.transcriptText}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('hardenTranscriptAnalysis: no tool_use block returned');
  }
  const raw = block.input as Partial<BrainHardeningResult>;
  return {
    questionsFound: raw.questionsFound ?? 0,
    gapsIdentified: (raw.gapsIdentified ?? []).slice(0, 12),
    strongCoverageConfirmed: raw.strongCoverageConfirmed ?? [],
    hardeningPlan: (raw.hardeningPlan ?? []).sort((a, b) => a.priority - b.priority).slice(0, 5),
  };
}
````


#### `lib/ai/intake.ts`

Intake interview engine: inconsistency detection, question generation, answer assembly, readiness scoring.

````ts
import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import type {
  BrainReadiness,
  IntakeAnswer,
  IntakeDocument,
  IntakeInconsistency,
  IntakeQuestion,
} from '@/lib/types';

// The brain fields intake answers map to and are synthesized into. Questions are
// tagged with one of these categories so each answer feeds the right field.
export const BRAIN_CATEGORIES = [
  'key_wins',
  'leadership_philosophy',
  'departure_reasons',
  'biggest_challenge',
  'ideal_environment',
  'manager_needs',
  'honest_weaknesses',
  'wish_questions',
] as const;

export type BrainFieldKey = (typeof BRAIN_CATEGORIES)[number];

export type AssembledBrain = Record<BrainFieldKey, string>;

const CATEGORY_LIST = BRAIN_CATEGORIES.join(', ');

function tool(name: string, schema: object): Anthropic.Messages.Tool {
  return {
    name,
    description: 'Submit the structured result.',
    input_schema: schema as unknown as Anthropic.Messages.Tool.InputSchema,
  };
}

function firstToolInput<T>(response: Anthropic.Messages.Message): T {
  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('Intake model did not return structured output');
  }
  return block.input as T;
}

function formatDocs(docs: IntakeDocument[]): string {
  return docs
    .filter((d) => d.text.trim())
    .map((d) => `### SOURCE: ${d.label}\n${d.text.trim()}`)
    .join('\n\n');
}

function formatAnswers(answers: IntakeAnswer[]): string {
  if (answers.length === 0) return 'No answers yet.';
  return answers
    .map((a) => `Q (${a.category}): ${a.questionText}\nA: ${a.answerText}`)
    .join('\n\n');
}

// ── Pass 1 -- document analysis ──────────────────────────────────────────────

const PASS1_SCHEMA = {
  type: 'object',
  properties: {
    inconsistencies: {
      type: 'array',
      description:
        'Cross-document contradictions (title/date/scope mismatches, a gap on one source but not another). Empty if only one source was provided or none found.',
      items: {
        type: 'object',
        properties: {
          sourceA: { type: 'string' },
          sourceB: { type: 'string' },
          description: { type: 'string', description: 'Plain-language explanation a candidate can act on.' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['sourceA', 'sourceB', 'description', 'severity'],
        additionalProperties: false,
      },
    },
    questions: {
      type: 'array',
      description: '8 to 12 questions a recruiter would most likely ask, derived from what the documents show.',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          context: { type: 'string', description: 'One sentence on why this is being asked.' },
          category: { type: 'string', enum: [...BRAIN_CATEGORIES] },
        },
        required: ['question', 'context', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['inconsistencies', 'questions'],
  additionalProperties: false,
};

export async function analyzeIntakePass1(
  docs: IntakeDocument[],
): Promise<{ inconsistencies: IntakeInconsistency[]; questions: IntakeQuestion[] }> {
  const multiSource = docs.filter((d) => d.text.trim()).length > 1;

  const system = `You are a senior recruiter and ATS specialist preparing a candidate's AI brain. You are given one or more source documents about the same person.

Do two things:
1. ${multiSource ? 'Flag genuine cross-document inconsistencies (title, date, scope, or gap mismatches between sources). Only real contradictions -- do not invent any.' : 'Only one source was provided, so return an empty inconsistencies array.'}
2. Generate 8 to 12 questions a recruiter would most likely ask this specific candidate, derived from what the documents actually show -- gaps, short tenures, pivots, departures, big claims needing backup, missing metrics. Each question maps to exactly one brain category: ${CATEGORY_LIST}.

Be specific to this candidate. Submit via the submit_pass1 tool.`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 2000,
    system,
    tools: [tool('submit_pass1', PASS1_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_pass1' },
    messages: [{ role: 'user', content: formatDocs(docs) || 'No documents provided.' }],
  });

  const raw = firstToolInput<{
    inconsistencies: Omit<IntakeInconsistency, 'id'>[];
    questions: { question: string; context: string; category: string }[];
  }>(response);

  const inconsistencies: IntakeInconsistency[] = (raw.inconsistencies ?? []).map((c, i) => ({
    id: `inc-${i + 1}`,
    ...c,
  }));
  const questions: IntakeQuestion[] = (raw.questions ?? []).slice(0, 12).map((q, i) => ({
    id: `p1-${i + 1}`,
    question: q.question,
    context: q.context,
    category: q.category,
    pass: 1,
  }));

  return { inconsistencies, questions };
}

// ── Pass 2 / 3 -- targeted follow-ups ────────────────────────────────────────

const FOLLOWUP_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      description: 'Follow-up questions only for vague/incomplete prior answers. Empty array if the answers are already strong.',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          context: { type: 'string' },
          category: { type: 'string', enum: [...BRAIN_CATEGORIES] },
        },
        required: ['question', 'context', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

export async function generateNextPass(
  pass: 2 | 3,
  docs: IntakeDocument[],
  previousAnswers: IntakeAnswer[],
  remaining: number,
): Promise<IntakeQuestion[]> {
  if (remaining <= 0) return [];
  const max = pass === 2 ? Math.min(6, remaining) : Math.min(4, remaining);

  const system = `You are conducting a layered candidate intake interview. Review the answers given so far and decide whether any need a follow-up.

${
    pass === 2
      ? `Pass 2: generate up to ${max} follow-up questions ONLY for answers that were vague, generic, or missing specifics (numbers, names, outcomes). Skip answers that were already specific and complete.`
      : `Pass 3: generate up to ${max} final probes ONLY for genuine gaps that remain. Often the right answer is an empty array.`
  }

Each question maps to one brain category: ${CATEGORY_LIST}. Return an empty array if nothing needs deepening. Submit via the submit_followups tool.`;

  const content = `SOURCE DOCUMENTS:\n${formatDocs(docs) || 'None.'}\n\nANSWERS SO FAR:\n${formatAnswers(previousAnswers)}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 1500,
    system,
    tools: [tool('submit_followups', FOLLOWUP_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_followups' },
    messages: [{ role: 'user', content }],
  });

  const raw = firstToolInput<{ questions: { question: string; context: string; category: string }[] }>(response);
  return (raw.questions ?? []).slice(0, max).map((q, i) => ({
    id: `p${pass}-${i + 1}`,
    question: q.question,
    context: q.context,
    category: q.category,
    pass,
  }));
}

// ── Brain assembly -- synthesize answers into the brain fields ────────────────

const BRAIN_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(
    BRAIN_CATEGORIES.map((k) => [
      k,
      { type: 'string', description: `First-person synthesis for "${k}", grounded only in the answers. Empty string if not covered.` },
    ]),
  ),
  required: [...BRAIN_CATEGORIES],
  additionalProperties: false,
};

export async function assembleBrainFromIntake(
  resumeMarkdown: string | null,
  answers: IntakeAnswer[],
  sources: IntakeDocument[] = [],
): Promise<AssembledBrain> {
  const system = `You assemble a candidate's AI "brain" from their intake interview. Synthesize their answers into clean, first-person context fields the AI will speak from.

Rules:
- Use ONLY what the candidate said in their answers, and the résumé and supporting sources for grounding. Never invent facts, numbers, or credentials.
- Supporting sources (LinkedIn, recommendations, reviews, etc.) may corroborate or add detail the candidate did not retype, but the answers lead. Do not contradict the candidate's own answers.
- Write in first person ("I led...", "I left because...").
- Each field is a concise paragraph. If a field has no supporting answer, return an empty string for it.
- Group each answer into the field that matches its category.

Fields: ${CATEGORY_LIST}. Submit via the submit_brain tool.`;

  const sourceBlock = sources.filter((s) => s.text.trim()).length
    ? `\n\nSUPPORTING SOURCES (for grounding only):\n${formatDocs(sources)}`
    : '';
  const content = `RÉSUMÉ (for grounding only):\n${resumeMarkdown ?? 'None.'}${sourceBlock}\n\nINTERVIEW ANSWERS:\n${formatAnswers(answers)}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 3000,
    system,
    tools: [tool('submit_brain', BRAIN_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_brain' },
    messages: [{ role: 'user', content }],
  });

  const raw = firstToolInput<Partial<AssembledBrain>>(response);
  const brain = {} as AssembledBrain;
  for (const k of BRAIN_CATEGORIES) brain[k] = (raw[k] ?? '').trim();
  return brain;
}

// ── Brain readiness score (pure) ─────────────────────────────────────────────

const READINESS_GROUPS: { label: string; fields: BrainFieldKey[] }[] = [
  { label: 'Core & wins', fields: ['key_wins'] },
  { label: 'Hard questions', fields: ['departure_reasons', 'biggest_challenge'] },
  { label: 'Leadership', fields: ['leadership_philosophy', 'manager_needs'] },
  { label: 'Depth & fit', fields: ['ideal_environment', 'honest_weaknesses', 'wish_questions'] },
];

/** A field counts as covered when it has meaningful content (>50 chars). */
export function computeReadiness(brain: Partial<Record<BrainFieldKey, string | null>>): BrainReadiness {
  const categories = READINESS_GROUPS.map((g) => {
    const filled = g.fields.filter((f) => (brain[f]?.trim().length ?? 0) > 50).length;
    return { label: g.label, score: Math.round((filled / g.fields.length) * 100) };
  });
  const overall = Math.round(categories.reduce((s, c) => s + c.score, 0) / categories.length);
  return { overall, categories };
}
````


#### `lib/ai/career-context.ts`

Career-context synthesis: two-angle generation, angle selection, and the augment (re-synthesis) loop.

````ts
import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from './client';
import { GENERATION_MODEL } from './models';
import type {
  CareerContextAngle,
  CareerContextDrafts,
  CareerContextStoryType,
  CustomQAPair,
  EvidenceSnippet,
  IntakeDocument,
} from '@/lib/types';

// Runs the RoleBoost Candidate Asset Production Skill (Section 1 -- the Narrative
// Guide Block only; the NotebookLM prompt sets in Section 2 are intentionally
// omitted here). Reads the candidate's résumé + career sources, applies the AI
// Mirror, selects a story type, and produces TWO distinct narrative angles plus a
// recommendation. The candidate picks one downstream; the chosen angle's rendered
// markdown becomes their active career-context document.

const STORY_TYPES: CareerContextStoryType[] = [
  'career_arc',
  'builder',
  'problem_solver',
  'leadership',
  'skeptic_champion',
  'specialist',
];

const STORY_TYPE_LABELS: Record<CareerContextStoryType, string> = {
  career_arc: 'The Career Arc',
  builder: 'The Builder',
  problem_solver: 'The Problem Solver',
  leadership: 'The Leadership Story',
  skeptic_champion: 'The Skeptic and the Champion',
  specialist: 'The Specialist',
};

/** An angle as the model returns it -- the rendered markdown is added afterwards. */
type GeneratedAngle = Omit<CareerContextAngle, 'markdown'>;

function tool(name: string, schema: object): Anthropic.Messages.Tool {
  return {
    name,
    description: 'Submit the structured result.',
    input_schema: schema as unknown as Anthropic.Messages.Tool.InputSchema,
  };
}

function firstToolInput<T>(response: Anthropic.Messages.Message): T {
  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('Career-context model did not return structured output');
  }
  return block.input as T;
}

function formatDocs(docs: IntakeDocument[]): string {
  return docs
    .filter((d) => d.text.trim())
    .map((d) => `### SOURCE: ${d.label}\n${d.text.trim()}`)
    .join('\n\n');
}

const ANGLE_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Short label for this framing, e.g. "The Builder" or "Turnaround Operator".',
    },
    story_type: { type: 'string', enum: [...STORY_TYPES] },
    headline: { type: 'string', description: 'One-line professional headline.' },
    target_role: { type: 'string', description: 'The role this candidate is targeting.' },
    location: { type: 'string', description: 'Location, or empty string if unknown.' },
    narrative: {
      type: 'string',
      description:
        '2-3 sentences, third person about the candidate. The human story grounded in evidence -- not a résumé summary.',
    },
    hook: {
      type: 'string',
      description: 'One line. The single most credible, specific fact -- a number, a moment, a result. Never a generality.',
    },
    hard_question: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The one question every recruiter will ask.' },
        answer: {
          type: 'string',
          description:
            'A tight, specific FIRST-PERSON answer (5-8 sentences) using only evidence from the file. Direct and confident; no hedging or apology; ends on what the candidate brings.',
        },
      },
      required: ['question', 'answer'],
      additionalProperties: false,
    },
    key_numbers: {
      type: 'array',
      items: { type: 'string' },
      description: '5-8 specific metrics and facts that must appear in every asset (scale, results, span, credentials).',
    },
    positioning: { type: 'string', description: 'A 1-2 sentence positioning statement.' },
    evidence_snippets: {
      type: 'array',
      description:
        'Up to 4 VERBATIM third-party quotes that appear in the supporting sources (recommendations, reviews, peer feedback). Copy the words exactly -- do not paraphrase or invent. Empty array if the sources contain no usable quotes.',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string', description: 'The exact quote, copied verbatim from a source.' },
          source: { type: 'string', description: 'Where it came from, e.g. "LinkedIn recommendation" or a name/title.' },
        },
        required: ['quote', 'source'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'story_type', 'headline', 'target_role', 'location', 'narrative', 'hook', 'hard_question', 'key_numbers', 'positioning', 'evidence_snippets'],
  additionalProperties: false,
};

const SUBMIT_SCHEMA = {
  type: 'object',
  properties: {
    angle_a: ANGLE_SCHEMA,
    angle_b: ANGLE_SCHEMA,
    recommended: { type: 'string', enum: ['A', 'B'], description: 'Which angle is the stronger lead.' },
  },
  required: ['angle_a', 'angle_b', 'recommended'],
  additionalProperties: false,
};

const SYSTEM = `You are running the RoleBoost Candidate Asset Production Skill (the career-context document portion only). You are given a candidate's résumé and any supporting career sources about the same person. Produce the narrative foundation for their career-context document.

Workflow:
1. Read everything in full.
2. Apply the AI Mirror -- an honest, evidence-based read of what the documents actually show: career trajectory, quantified vs unquantified results, title vs scope, and the single most credible fact in the file. This is an assessment, not a résumé summary.
3. Select the candidate's story type, then define TWO genuinely different narrative angles -- not two tones of one story, but two real framings a candidate could choose between.
4. Recommend the stronger angle.

Story types:
- The Career Arc: strong linear progression with measurable results at each stage.
- The Builder: has built operations, teams, or systems from scratch multiple times.
- The Problem Solver: a pattern of fixing broken things and turning around underperforming situations.
- The Leadership Story: senior candidate -- results and people development both present.
- The Skeptic and the Champion: non-linear path, gap, pivot, or layoff that needs contextualizing.
- The Specialist: deep domain expertise in a niche -- depth is the story, not breadth.

For each angle produce: a name, the story type, a headline, the target role, location, a 2-3 sentence narrative, a one-line hook, the one hard question every recruiter will ask with a tight first-person answer, 5-8 key numbers, a positioning statement, and up to 4 verbatim evidence quotes drawn from the supporting sources.

Hard rules:
- Every claim must be supported by the provided material. Never invent a number, metric, date, credential, or outcome. If the file is thin, work honestly with what is there.
- The hook must be specific -- a number, a moment, a result -- never a generality like "strong results across a long career".
- Write the narrative in third person about the candidate. Write the hard-question answer in first person ("I ...").
- The hard-question answer is direct and confident, does not hedge or apologize, and ends on what the candidate brings.
- Evidence snippets must be VERBATIM quotes that actually appear in the supporting sources. Never fabricate a quote. If there are no quotable sources, return an empty array.
- Never use em dashes anywhere in the output. Use commas, semicolons, or periods instead.

Submit via the submit_context tool.`;

function cleanAngle(raw: GeneratedAngle): GeneratedAngle {
  const story_type = STORY_TYPES.includes(raw.story_type) ? raw.story_type : 'career_arc';
  return {
    name: (raw.name ?? '').trim(),
    story_type,
    headline: (raw.headline ?? '').trim(),
    target_role: (raw.target_role ?? '').trim(),
    location: (raw.location ?? '').trim(),
    narrative: (raw.narrative ?? '').trim(),
    hook: (raw.hook ?? '').trim(),
    hard_question: {
      question: (raw.hard_question?.question ?? '').trim(),
      answer: (raw.hard_question?.answer ?? '').trim(),
    },
    key_numbers: Array.isArray(raw.key_numbers)
      ? raw.key_numbers.map((n) => String(n).trim()).filter(Boolean)
      : [],
    positioning: (raw.positioning ?? '').trim(),
    evidence_snippets: cleanEvidence(raw.evidence_snippets),
  };
}

function cleanEvidence(raw: unknown): EvidenceSnippet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => ({
      quote: String((e as EvidenceSnippet)?.quote ?? '').trim(),
      source: String((e as EvidenceSnippet)?.source ?? '').trim(),
    }))
    .filter((e) => e.quote.length > 0)
    .slice(0, 4);
}

/** Renders one angle into the markdown document stored as context_package_md. */
function renderAngleMarkdown(a: GeneratedAngle, fullName: string): string {
  const identity = [
    a.target_role && `- **Target role:** ${a.target_role}`,
    a.location && `- **Location:** ${a.location}`,
    a.headline && `- **Headline:** ${a.headline}`,
  ].filter(Boolean);

  const lines = [
    `# ${fullName}: Career Context Document`,
    `**Story type:** ${STORY_TYPE_LABELS[a.story_type]}  ·  **Angle:** ${a.name}`,
    '',
    '## Identity',
    ...identity,
    '',
    '## The Narrative',
    a.narrative,
    '',
    '## The Hook',
    a.hook,
    '',
    '## The Hard Question',
    `**${a.hard_question.question}**`,
    '',
    a.hard_question.answer,
    '',
    '## Key Numbers',
    ...a.key_numbers.map((n) => `- ${n}`),
    '',
    '## Positioning',
    a.positioning,
    '',
  ];

  if (a.evidence_snippets.length > 0) {
    lines.push('## What Others Say');
    for (const e of a.evidence_snippets) {
      lines.push(`> "${e.quote}"${e.source ? `, ${e.source}` : ''}`, '');
    }
  }

  return lines.join('\n');
}

/**
 * Generates both narrative angles for a candidate's career-context document.
 * Throws if the model returns no structured output. `selected` starts null --
 * the candidate chooses an angle downstream.
 */
export async function generateCareerContext(
  fullName: string,
  resumeMarkdown: string | null,
  sources: IntakeDocument[] = [],
): Promise<CareerContextDrafts> {
  const sourceBlock = sources.filter((s) => s.text.trim()).length
    ? `\n\nSUPPORTING SOURCES:\n${formatDocs(sources)}`
    : '';
  const content = `CANDIDATE: ${fullName}\n\nRÉSUMÉ:\n${resumeMarkdown ?? 'None provided.'}${sourceBlock}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [tool('submit_context', SUBMIT_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_context' },
    messages: [{ role: 'user', content }],
  });

  const raw = firstToolInput<{
    angle_a: GeneratedAngle;
    angle_b: GeneratedAngle;
    recommended: string;
  }>(response);

  const a = cleanAngle(raw.angle_a);
  const b = cleanAngle(raw.angle_b);

  return {
    angles: {
      A: { ...a, markdown: renderAngleMarkdown(a, fullName) },
      B: { ...b, markdown: renderAngleMarkdown(b, fullName) },
    },
    recommended: raw.recommended === 'B' ? 'B' : 'A',
    selected: null,
    generated_at: new Date().toISOString(),
  };
}

// ── Augment loop -- re-synthesize the selected angle with newer material ───────
// This is the "deepen the synthesis loop" path: rather than appending raw text to
// the brain, new context (refined answers, new wins, career sources) is folded
// back into the curated document so it stays distilled and contradiction-free.

const AUGMENT_SYSTEM = `You are UPDATING an existing career-context document for a candidate. You are given the current document plus newer material the candidate has added since it was written (refined answers, new wins, additional career sources). Produce an updated version of the SAME document.

Rules:
- Preserve the existing story type and angle framing. This is a refinement of the chosen story, not a new direction.
- Fold in the new material: sharpen the narrative, hook, hard-question answer, key numbers, and positioning wherever the new material adds specificity, evidence, or strength. Keep everything that is still strong; drop nothing accurate just to make room.
- Never invent. Every claim must trace to the current document or the new material.
- Refresh the evidence snippets from the supporting sources -- up to 4 VERBATIM third-party quotes that actually appear in them. Empty array if there are none.
- Write the narrative in third person about the candidate; write the hard-question answer in first person ("I ...").
- Never use em dashes anywhere in the output. Use commas, semicolons, or periods instead.

Submit the updated angle via the submit_updated tool.`;

function formatFields(fields: { label: string; value: string | null }[]): string {
  const filled = fields.filter((f) => f.value?.trim());
  if (filled.length === 0) return 'None provided.';
  return filled.map((f) => `### ${f.label}\n${f.value!.trim()}`).join('\n\n');
}

function formatQA(pairs: CustomQAPair[]): string {
  const filled = pairs.filter((p) => p.question.trim() && p.answer.trim());
  if (filled.length === 0) return 'None provided.';
  return filled.map((p) => `Q: ${p.question.trim()}\nA: ${p.answer.trim()}`).join('\n\n');
}

export interface AugmentInputs {
  fullName: string;
  /** The currently selected angle to refine -- its framing is preserved. */
  base: CareerContextAngle;
  resumeMarkdown: string | null;
  sources: IntakeDocument[];
  /** The candidate's authored brain fields, with display labels. */
  brainFields: { label: string; value: string | null }[];
  customQA: CustomQAPair[];
}

/**
 * Re-synthesizes the selected angle, folding in the candidate's newer material.
 * The story type and angle name are preserved (forced from the base) so the
 * candidate's chosen framing is stable across updates. Throws if the model
 * returns no structured output.
 */
export async function augmentCareerContextAngle(input: AugmentInputs): Promise<CareerContextAngle> {
  const { fullName, base, resumeMarkdown, sources, brainFields, customQA } = input;

  const sourceBlock = sources.filter((s) => s.text.trim()).length
    ? `\n\nSUPPORTING SOURCES:\n${formatDocs(sources)}`
    : '';
  const content = `CANDIDATE: ${fullName}
STORY TYPE TO PRESERVE: ${STORY_TYPE_LABELS[base.story_type]} (${base.name})

CURRENT DOCUMENT:
${base.markdown}

NEWER CANDIDATE-AUTHORED MATERIAL:
${formatFields(brainFields)}

REFINED Q&A:
${formatQA(customQA)}

RÉSUMÉ (for grounding):
${resumeMarkdown ?? 'None provided.'}${sourceBlock}`;

  const response = await anthropic.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 3000,
    system: AUGMENT_SYSTEM,
    tools: [tool('submit_updated', ANGLE_SCHEMA)],
    tool_choice: { type: 'tool', name: 'submit_updated' },
    messages: [{ role: 'user', content }],
  });

  const raw = firstToolInput<GeneratedAngle>(response);
  const cleaned = cleanAngle(raw);
  // Force the chosen framing to stay stable across refinements.
  const updated: GeneratedAngle = { ...cleaned, name: base.name, story_type: base.story_type };

  return { ...updated, markdown: renderAngleMarkdown(updated, fullName) };
}
````


#### `app/(candidate)/dashboard/settings/actions.ts`

Fresh-start brain wipe + related settings actions (shows exactly which tables/columns constitute the brain's memory).

````ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { getAdminClient } from '@/lib/supabase/admin';
import { deleteAllCandidateFiles } from '@/lib/storage/delete-candidate-files';

// ── Visibility & AI toggles ─────────────────────────────────────────────────
// Two account-level switches that write the canonical candidate_profiles
// columns (the same ones surfaced in Profile / AI Studio), so there is one
// source of truth no matter which page flips them.

const VisibilityInput = z.object({
  is_published: z.boolean().optional(),
  ai_enabled: z.boolean().optional(),
  // Opt-in to being indexed by search engines (default off). Writing this fails
  // gracefully until the 20260715 migration is applied (the caller reverts + warns).
  search_discoverable: z.boolean().optional(),
});

export async function updateVisibilitySettings(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const parsed = VisibilityInput.parse(input);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.is_published !== undefined) patch.is_published = parsed.is_published;
    if (parsed.ai_enabled !== undefined) patch.ai_enabled = parsed.ai_enabled;
    if (parsed.search_discoverable !== undefined) patch.search_discoverable = parsed.search_discoverable;

    const { error } = await supabase
      .from('candidate_profiles')
      .update(patch)
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

// ── Fresh start, mode A: reset AI training ──────────────────────────────────
// Wipes everything the AI learned and everything the candidate taught it (brain
// fields, custom Q&A, redirect topics, intake answers, sandbox self-tests,
// transcript gaps, hardening runs, and recruiter chat history) and resets
// readiness, then leaves the candidate to rebuild through the getting-started
// flow. Keeps the account, the public link and slug, profile identity, the
// résumé, career sources, and every uploaded/generated media asset.
//
// The admin (RLS bypass) client is used so each child-table delete is
// guaranteed to complete in one server operation; every query is strictly
// scoped to the authenticated candidate's own profile id / clerk_user_id.

export async function resetAiLearning() {
  try {
    const { supabase, userId } = await getUserContext('candidate');

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();
    if (!profile) return { ok: false as const, error: { code: 'NOT_FOUND' } };
    const profileId = (profile as { id: string }).id;

    const admin = getAdminClient();

    // Delete the learned/taught child rows. Deleting chat_sessions cascades its
    // chat_messages and any transcript_gaps tied to a session; the explicit
    // transcript_gaps delete then clears gaps not linked to a session.
    const childTables = [
      'intake_answers',
      'sandbox_sessions',
      'brain_hardening_sessions',
      'chat_sessions',
      'transcript_gaps',
    ] as const;

    for (const table of childTables) {
      const { error } = await (admin.from(table) as any)
        .delete()
        .eq('candidate_profile_id', profileId);
      if (error) {
        console.error('resetAiLearning: delete failed', table, userId, error);
        return { ok: false as const, error: { code: 'INTERNAL', message: `${table}: ${error.message}` } };
      }
    }

    // Reset the brain columns on the profile row back to a blank slate. Identity
    // columns (slug, full_name, headline, target_role, ...) are left untouched.
    const { error: resetError } = await (admin.from('candidate_profiles') as any)
      .update({
        leadership_philosophy: null,
        key_wins: null,
        departure_reasons: null,
        biggest_challenge: null,
        ideal_environment: null,
        manager_needs: null,
        honest_weaknesses: null,
        wish_questions: null,
        custom_qa_pairs: [],
        redirect_topics: [],
        ai_enabled: false,
        intake_completed: false,
        brain_readiness_score: 0,
        inconsistencies_found: [],
        inconsistencies_resolved: [],
        context_package_md: null,
        context_package_updated_at: null,
        career_context_drafts: null,
        // asset_package is deliberately NOT cleared: it is the founder-produced
        // deliverable record (superadmin tool), not candidate learning.
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId);

    if (resetError) {
      console.error('resetAiLearning: profile reset failed', userId, resetError);
      return { ok: false as const, error: { code: 'INTERNAL', message: resetError.message } };
    }

    revalidatePath('/dashboard/ai');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/settings');
    return { ok: true as const, redirectTo: '/dashboard/profile' };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

// ── Fresh start, mode B: delete everything & start over ─────────────────────
// The full nuke. Deletes the candidate_profiles row (Postgres ON DELETE CASCADE
// removes every child table: assets, résumé, sources, chat, intake, sandbox,
// gaps, hardening, meeting requests, and any saved-candidate references), clears
// all stored files (Storage is not cascaded), then nulls users.role so both the
// root router and the candidate layout send the account back through
// /onboarding as a brand-new user. The users row itself (Clerk link, email,
// subscription) is preserved.
//
// This mirrors the Clerk user.deleted webhook, which relies on the same cascade.
// Every operation is scoped to the authenticated candidate's own clerk_user_id.

export async function deleteEverythingAndRestart() {
  try {
    const { userId } = await getUserContext('candidate');
    const admin = getAdminClient();

    // 1. Remove stored media first (not covered by the DB cascade).
    await deleteAllCandidateFiles(userId);

    // 2. Delete the profile row, which cascades all candidate child tables.
    const { error: delError } = await (admin.from('candidate_profiles') as any)
      .delete()
      .eq('clerk_user_id', userId);
    if (delError) {
      console.error('deleteEverythingAndRestart: profile delete failed', userId, delError);
      return { ok: false as const, error: { code: 'INTERNAL', message: delError.message } };
    }

    // 3. Reset the role so the routers treat the account as new.
    const { error: roleError } = await (admin.from('users') as any)
      .update({ role: null, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);
    if (roleError) {
      console.error('deleteEverythingAndRestart: role reset failed', userId, roleError);
      return { ok: false as const, error: { code: 'INTERNAL', message: roleError.message } };
    }

    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/settings');
    return { ok: true as const, redirectTo: '/onboarding' };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
````


#### `app/(candidate)/dashboard/transcripts/actions.ts`

Conversation memory management: archive and permanent delete of chat sessions.

````ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import type { CustomQAPair } from '@/lib/types';

const MAX_QA_PAIRS = 50;

const TeachInput = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(3000),
});

/**
 * Turns a real recruiter question from a transcript into a highest-priority
 * custom Q&A pair on the candidate's brain. This is the low-friction training
 * loop: read a conversation your AI fumbled, write the answer you wish it gave,
 * and it takes priority on every future chat. If a pair for the same question
 * already exists, its answer is replaced rather than duplicated.
 */
export async function teachAiFromTranscript(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const { question, answer } = TeachInput.parse(input);

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('custom_qa_pairs')
      .eq('clerk_user_id', userId)
      .single();
    if (!profile) return { ok: false as const, error: { code: 'NOT_FOUND' } };

    const existing = normalizeQA((profile as { custom_qa_pairs: unknown }).custom_qa_pairs);
    const q = question.trim();
    const a = answer.trim();

    const idx = existing.findIndex(
      (p) => p.question.trim().toLowerCase() === q.toLowerCase(),
    );
    let next: CustomQAPair[];
    if (idx >= 0) {
      next = existing.slice();
      next[idx] = { question: q, answer: a };
    } else {
      if (existing.length >= MAX_QA_PAIRS) {
        return {
          ok: false as const,
          error: { code: 'INVALID_INPUT', message: `You can save up to ${MAX_QA_PAIRS} tuned answers.` },
        };
      }
      next = [{ question: q, answer: a }, ...existing];
    }

    const { error } = await supabase
      .from('candidate_profiles')
      .update({ custom_qa_pairs: next, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };

    revalidatePath('/dashboard/transcripts');
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

function normalizeQA(raw: unknown): CustomQAPair[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is CustomQAPair =>
      !!p &&
      typeof (p as CustomQAPair).question === 'string' &&
      typeof (p as CustomQAPair).answer === 'string',
  );
}

const SessionInput = z.object({ sessionId: z.string().uuid() });

/**
 * Moves a reviewed transcript into the archive (soft state). RLS scopes the
 * update to the candidate's own sessions; matching by primary key is enough.
 */
export async function archiveTranscript(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sessionId } = SessionInput.parse(input);

    const { error } = await supabase
      .from('chat_sessions')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/transcripts');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

/** Restores an archived transcript back to the active list. */
export async function unarchiveTranscript(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sessionId } = SessionInput.parse(input);

    const { error } = await supabase
      .from('chat_sessions')
      .update({ archived_at: null })
      .eq('id', sessionId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/transcripts');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

/**
 * Permanently deletes a transcript (chat_messages cascade). Only allowed from
 * the archive: we require archived_at to be set, defense in depth beyond the UI
 * only exposing delete on archived cards. Training taught from the transcript
 * lives on candidate_profiles and is intentionally left untouched.
 */
export async function deleteTranscript(input: unknown) {
  try {
    const { supabase } = await getUserContext('candidate');
    const { sessionId } = SessionInput.parse(input);

    // RLS scopes this read to the candidate's own sessions.
    const { data: sess } = await supabase
      .from('chat_sessions')
      .select('id, archived_at')
      .eq('id', sessionId)
      .maybeSingle();
    if (!sess) return { ok: false as const, error: { code: 'NOT_FOUND' } };
    if (!(sess as { archived_at: string | null }).archived_at) {
      return {
        ok: false as const,
        error: { code: 'INVALID_INPUT', message: 'Archive the transcript before deleting it.' },
      };
    }

    const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    revalidatePath('/dashboard/transcripts');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
````


---

## 6. UI surfaces: chatbot, AI Studio, recruiter chat

Inventory of every UI file referencing the chatbot, brain, or recruiter chat. Full contents included for the recruiter-facing chat surface; the AI Studio panels are large JSX files whose server logic is already captured in sections 3-5, so they are listed with roles.

| File | Role |
|---|---|
| `components/chat/ChatPanel.tsx` | The recruiter chat interface (759 lines, full contents below) |
| `components/chat/ChatOverlay.tsx` | Dialog wrapper, currently dead code (nothing imports it, see todo.md) |
| `app/c/[slug]/page.tsx` | Public candidate calling card page, chat-first (full contents below) |
| `lib/candidate/calling-card.ts` | Server data assembly for the public card (full contents below) |
| `components/candidate/AIStudio.tsx` | AI Studio: custom QA editing, redirect topics, ai_enabled, tab shell (545 lines) |
| `components/candidate/PromptBot.tsx` | Gap review + one-click adopt of suggested answers (full contents below) |
| `components/candidate/SandboxPanel.tsx` | Sandbox self-testing UI with verdicts + strengthen deep-links (316 lines) |
| `components/candidate/HardenPanel.tsx` | External transcript hardening UI + history (416 lines) |
| `components/candidate/IntakeInterview.tsx` | AI intake interview dialog (409 lines) |
| `components/candidate/ContextDocumentPanel.tsx` | Career context document generate/select/augment UI |
| `components/candidate/CareerSourcesCard.tsx` | Career sources management (feeds context synthesis) |
| `components/candidate/TranscriptsList.tsx` | Candidate transcript list, archive/delete |
| `components/candidate/MeetingRequestsList.tsx` | Candidate view of recruiter meeting requests |
| `components/candidate/SettingsPanel.tsx` | Settings incl. fresh-start brain wipe |
| `components/candidate/PreviewFrame.tsx` | Candidate preview of their own public card/chat |
| `app/(candidate)/dashboard/ai/page.tsx` | AI Studio page (server component wiring the panels) |
| `app/(candidate)/dashboard/transcripts/page.tsx` | Transcripts page |

#### `components/chat/ChatPanel.tsx`

The recruiter chat interface: session bootstrap, staged latency indicator, retry, sendBeacon transcript delivery on close, identity capture, meeting-request flow.

````tsx
'use client';

import { useCallback, useEffect, useRef, useState, useId } from 'react';
import { Send, Sparkles, X, Download, CalendarClock, Check, Lock } from 'lucide-react';
import type { ChatTurn } from '@/lib/types';

interface Props {
  candidateSlug: string;
  candidateName: string;
  /** 'live' = public recruiter view. 'preview' = candidate testing their own assistant. */
  mode?: 'live' | 'preview';
  /** Fired after each assistant answer with the question + answer (sandbox analysis). */
  onExchange?: (question: string, answer: string) => void;
  /** Push a question in from outside (e.g. a sandbox library chip). Bump nonce to resend. */
  externalQuestion?: { text: string; nonce: number };
  /** One-tap opener chips shown in the empty state (calling-card hero). */
  suggestedQuestions?: string[];
  /** Focus the input on mount (used inside the chat overlay). */
  autoFocus?: boolean;
  /** Fill the parent height and drop the card chrome. */
  fill?: boolean;
  /** Render a close button in the header. */
  onClose?: () => void;
}

// Deliver the transcript after this much inactivity. Long enough that a recruiter
// can step away and come back without triggering a premature send; the server
// cron uses the same window as the backstop.
const IDLE_MS = 30 * 60 * 1000;
// After this long waiting on an answer, the typing indicator explains itself
// (the grounding check adds a second model call on detail-heavy answers).
const LONG_WAIT_MS = 4000;

type ScheduleState = 'idle' | 'prompt' | 'form' | 'sending' | 'done';

export default function ChatPanel({
  candidateSlug,
  candidateName,
  mode = 'live',
  onExchange,
  externalQuestion,
  suggestedQuestions,
  autoFocus,
  fill,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [longWait, setLongWait] = useState(false);
  // The last message that failed to send, so one tap retries it.
  const [retryText, setRetryText] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Set when the server caps the conversation. 'session_limit' is per-chat and a
  // fresh conversation clears it (we offer a one-tap restart); 'rate_limited' is
  // per-source and a restart won't help, so we point to the follow-up path.
  const [degraded, setDegraded] = useState<'session_limit' | 'rate_limited' | null>(null);
  // Latched once the conversation is deep enough that the server starts inviting a
  // live meeting; surfaces a persistent, low-key "Request time" chip by the input.
  const [inviteMeeting, setInviteMeeting] = useState(false);

  // Scheduling handoff, shown when the assistant cannot answer and offers to meet.
  const [scheduleState, setScheduleState] = useState<ScheduleState>('idle');
  const [availability, setAvailability] = useState('');
  const [email, setEmail] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const inputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const deliveredRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [delivered, setDelivered] = useState(false);

  // Optional recruiter self-introduction, so the candidate knows who reached out.
  const [identifyState, setIdentifyState] = useState<'idle' | 'form' | 'saving' | 'done'>('idle');
  const [rName, setRName] = useState('');
  const [rCompany, setRCompany] = useState('');
  const [rEmail, setREmail] = useState('');

  const firstName = candidateName.split(' ')[0] || candidateName;
  const assistantName = `${firstName}'s Personal Assistant`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, scheduleState]);

  useEffect(() => {
    if (externalQuestion?.text) void send(externalQuestion.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion?.nonce]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Fire-and-forget transcript delivery. Guarded so it goes out at most once per
  // session. Uses sendBeacon so it survives the page unloading.
  const deliverBeacon = useCallback(() => {
    const id = sessionIdRef.current;
    if (!id || deliveredRef.current) return;
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    deliveredRef.current = true;
    try {
      const blob = new Blob([JSON.stringify({ sessionId: id })], { type: 'application/json' });
      navigator.sendBeacon('/api/transcripts/deliver', blob);
    } catch {
      // best-effort; the cron sweep is the final backstop.
    }
  }, []);

  // Restart the inactivity timer. After IDLE_MS with no new message we deliver,
  // so a conversation left open but abandoned still reaches the inbox.
  const armIdleTimer = useCallback(() => {
    if (mode !== 'live') return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(deliverBeacon, IDLE_MS);
  }, [mode, deliverBeacon]);

  // Deliver only on a genuine exit -- navigation away, tab close, unmount -- NOT
  // on tab-switch/backgrounding, so a recruiter can step away and return without
  // triggering a partial send. Inactivity is handled by the idle timer above and
  // the server cron; those cover the "left it open" and "browser killed" cases.
  useEffect(() => {
    if (mode !== 'live') return;
    window.addEventListener('pagehide', deliverBeacon);
    return () => {
      window.removeEventListener('pagehide', deliverBeacon);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      deliverBeacon();
    };
  }, [mode, deliverBeacon]);

  // Explicit "email it now" -- an awaitable send so we can confirm in the UI.
  async function deliverNow() {
    const id = sessionIdRef.current;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    deliveredRef.current = true;
    setDelivered(true);
    if (!id) return;
    try {
      await fetch('/api/transcripts/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
        keepalive: true,
      });
    } catch {
      // best-effort; the record is already saved server-side.
    }
  }

  // Start a fresh conversation. Delivers the current transcript first, then wipes
  // local state so the next message opens a new session server-side, which clears
  // the per-chat interaction cap. The recruiter's self-introduction is kept so
  // they don't have to re-enter it.
  function resetConversation() {
    deliverBeacon();
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    deliveredRef.current = false;
    setDelivered(false);
    setSessionId(null);
    sessionIdRef.current = null;
    setMessages([]);
    setInput('');
    setRetryText(null);
    setScheduleState('idle');
    setDegraded(null);
    setInviteMeeting(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Optional recruiter self-introduction. Any subset of the fields is fine; the
  // email (if given) is also where the recruiter's transcript copy is sent.
  async function submitIdentify() {
    if (!rName.trim() && !rCompany.trim() && !rEmail.trim()) return;
    const id = sessionIdRef.current;
    // Pre-chat: no session yet -- just capture; it rides along on the first
    // message. Post-chat: persist immediately to the existing session.
    if (!id) {
      setIdentifyState('done');
      return;
    }
    setIdentifyState('saving');
    try {
      const res = await fetch('/api/chat/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          name: rName.trim() || undefined,
          company: rCompany.trim() || undefined,
          email: rEmail.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setIdentifyState('done');
    } catch {
      setIdentifyState('form');
    }
  }

  const SEND_ERROR = 'Something went wrong reaching the assistant just now.';

  async function send(explicitMessage?: string, opts?: { isRetry?: boolean }) {
    const trimmed = (explicitMessage ?? input).trim();
    if (!trimmed || loading) return;

    if (opts?.isRetry) {
      // The question bubble is already in the thread; just drop the error bubble.
      setMessages((m) =>
        m.length && m[m.length - 1].role === 'assistant' && m[m.length - 1].content === SEND_ERROR
          ? m.slice(0, -1)
          : m,
      );
    } else {
      setMessages((m) => [...m, { role: 'user', content: trimmed }]);
    }
    if (explicitMessage === undefined) {
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
    setLoading(true);
    setRetryText(null);
    setScheduleState('idle'); // a new question resets any prior scheduling offer
    // Long answers run a second grounding pass server-side; after a few seconds
    // the typing indicator says so instead of leaving unexplained dead air.
    const longWaitTimer = setTimeout(() => setLongWait(true), LONG_WAIT_MS);

    // On the first message, carry any pre-chat self-introduction so the session
    // is created with it and the assistant can greet by name from its first reply.
    const visitor =
      !sessionIdRef.current && (rName.trim() || rCompany.trim() || rEmail.trim())
        ? { name: rName.trim() || undefined, company: rCompany.trim() || undefined, email: rEmail.trim() || undefined }
        : undefined;

    try {
      // No history in the payload: the server rebuilds it from the session's
      // logged messages, which recruiters cannot tamper with.
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSlug,
          message: trimmed,
          sessionId: sessionId ?? undefined,
          visitor,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Request failed');

      if (data.sessionId) {
        setSessionId(data.sessionId);
        sessionIdRef.current = data.sessionId;
      }
      // An intro carried on the first message is now persisted on the session.
      if (visitor) setIdentifyState('done');
      const assistantAnswer = data.answer as string;
      setMessages((m) => [...m, { role: 'assistant', content: assistantAnswer }]);
      onExchange?.(trimmed, assistantAnswer);
      // A capped conversation comes back as a normal assistant turn plus a flag;
      // record it so the thread can offer the matching next step (restart / follow-up).
      setDegraded((data.degraded as 'session_limit' | 'rate_limited' | undefined) ?? null);
      // Latch the meeting invite: once deep enough, keep the chip available.
      if (data.inviteMeeting) setInviteMeeting(true);
      if (mode === 'live' && data.offerSchedule) setScheduleState('prompt');
      // Each message restarts the inactivity clock, so the transcript only
      // delivers after a real lull, not while the recruiter is still engaged.
      armIdleTimer();
    } catch {
      setRetryText(trimmed);
      setMessages((m) => [...m, { role: 'assistant', content: SEND_ERROR }]);
    } finally {
      clearTimeout(longWaitTimer);
      setLongWait(false);
      setLoading(false);
    }
  }

  async function submitSchedule() {
    if (!email.trim() || !availability.trim()) return;
    setScheduleError(null);
    setScheduleState('sending');
    try {
      const res = await fetch('/api/chat/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSlug,
          email: email.trim(),
          availability: availability.trim(),
          name: rName.trim() || undefined,
          sessionId: sessionId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setScheduleState('done');
    } catch {
      setScheduleError('Could not send that just now. Please try again.');
      setScheduleState('form');
    }
  }

  function downloadTranscript() {
    if (messages.length === 0) return;
    const lines = [
      `# Conversation with ${assistantName}`,
      new Date().toLocaleString(),
      '',
      ...messages.flatMap((m) => [`**${m.role === 'user' ? 'You' : assistantName}:** ${m.content}`, '']),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roleboost-conversation-${candidateSlug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-2 text-sm text-[var(--rb-text)] outline-none placeholder:text-[var(--rb-text-muted)] focus-visible:border-[var(--rb-brand)] focus-visible:ring-2 focus-visible:ring-[var(--rb-brand)]/30';

  return (
    <div
      className={
        fill
          ? 'flex h-full flex-col overflow-hidden bg-[var(--rb-bg-surface)]'
          : 'rb-card flex flex-col overflow-hidden'
      }
      style={fill ? undefined : { height: 'min(70vh, 560px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--rb-border)] px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand)] text-white">
          <Sparkles className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--rb-text)]">
            {mode === 'preview' ? `How ${assistantName} responds to recruiters` : `Ask ${assistantName} anything`}
          </p>
          {mode === 'preview' ? (
            <p className="text-xs text-[var(--rb-text-muted)]">Private test, nothing is sent.</p>
          ) : (
            <p className="text-xs text-[var(--rb-text-muted)]">Honest by design · you both get the transcript</p>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={downloadTranscript}
            aria-label="Download transcript"
            title="Download transcript"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--rb-text-muted)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]"
          >
            <Download className="size-4" />
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close conversation"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--rb-text-muted)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${assistantName}`}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-xs text-sm text-[var(--rb-text-muted)]">
              {mode === 'preview'
                ? `Try a hard recruiter question and see how ${assistantName} answers.`
                : `Ask about ${firstName}'s experience, decisions, and what they're looking for next.`}
            </p>
            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="rounded-full border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-1.5 text-xs text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Optional self-introduction, before chatting. Fully skippable -- the
                recruiter can just ask a question. If they fill it in, it rides
                along on the first message and the assistant greets them by name. */}
            {mode === 'live' && (
              <div className="w-full max-w-xs">
                {identifyState === 'done' ? (
                  <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--color-success)]">
                    <Check className="size-3.5" />
                    {firstName} will know it&apos;s {rName.trim() || rEmail.trim() || rCompany.trim()}
                  </p>
                ) : identifyState === 'idle' ? (
                  <button
                    type="button"
                    onClick={() => setIdentifyState('form')}
                    className="text-xs font-medium text-[var(--rb-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--rb-brand)] hover:underline"
                  >
                    Introduce yourself first (optional)
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-3 text-left">
                    <p className="text-[11px] text-[var(--rb-text-secondary)]">
                      Optional, so {firstName} knows who reached out. Any field is fine.
                    </p>
                    <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Your name" aria-label="Your name" className={inputClass} />
                    <input value={rCompany} onChange={(e) => setRCompany(e.target.value)} placeholder="Company" aria-label="Company" className={inputClass} />
                    <input type="email" value={rEmail} onChange={(e) => setREmail(e.target.value)} placeholder="you@company.com (to get your copy)" aria-label="Your email" className={inputClass} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitIdentify()}
                        disabled={!rName.trim() && !rCompany.trim() && !rEmail.trim()}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdentifyState('idle')}
                        className="rounded-[var(--radius-md)] px-2 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[var(--rb-brand)] text-white'
                  : 'border border-[var(--rb-border)] bg-[var(--rb-bg-page)] text-[var(--rb-text-secondary)]'
              }`}
            >
              <span className="sr-only">{m.role === 'user' ? 'You said: ' : `${assistantName} said: `}</span>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start" aria-hidden="true">
            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-page)] px-3.5 py-3">
              <span className="flex items-center gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)] [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)] [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)]" />
              </span>
              {longWait && (
                <span className="text-xs text-[var(--rb-text-muted)]">
                  Double-checking the details against {firstName}&apos;s record…
                </span>
              )}
            </div>
          </div>
        )}

        {/* One-tap retry after a failed send. */}
        {retryText && !loading && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => void send(retryText, { isRetry: true })}
              className="rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
            >
              Try again
            </button>
          </div>
        )}

        {/* Per-chat cap reached: one tap opens a fresh conversation (new session),
            which clears the cap. Shown alongside the scheduling handoff below, so
            the recruiter can keep going or hand off, whichever they prefer. */}
        {degraded === 'session_limit' && !loading && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={resetConversation}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]/50 px-3 py-1.5 text-xs font-semibold text-[var(--rb-brand)] transition-colors hover:bg-[var(--rb-brand-subtle)]"
            >
              <Sparkles className="size-3.5" />
              Start a new conversation
            </button>
          </div>
        )}

        {/* Scheduling handoff */}
        {scheduleState !== 'idle' && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]/50 p-3">
            {scheduleState === 'prompt' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    // Low friction: reuse the email they gave when introducing themselves.
                    if (!email.trim() && rEmail.trim()) setEmail(rEmail.trim());
                    setScheduleState('form');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <CalendarClock className="size-3.5" />
                  Yes, schedule a time
                </button>
                <button
                  onClick={() => setScheduleState('idle')}
                  className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]"
                >
                  No thanks
                </button>
              </div>
            )}

            {(scheduleState === 'form' || scheduleState === 'sending') && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-[var(--rb-text)]">
                  Share a couple of date and time ranges that work, and where to reach you.
                </p>
                <textarea
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  rows={2}
                  placeholder="e.g. Tue 10am to 12pm ET, or Thu afternoon"
                  className={`${inputClass} resize-none`}
                  aria-label="Your availability"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={inputClass}
                  aria-label="Your email"
                />
                {scheduleError && <p className="text-xs text-[var(--color-error)]">{scheduleError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    onClick={submitSchedule}
                    disabled={scheduleState === 'sending' || !email.trim() || !availability.trim()}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {scheduleState === 'sending' ? 'Sending…' : 'Send request'}
                  </button>
                  <button
                    onClick={() => setScheduleState('idle')}
                    className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {scheduleState === 'done' && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)]">
                <Check className="size-4" />
                Sent. {firstName} will respond soon.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Transparency + optional self-introduction + one-tap "email it now".
          Reassures the recruiter the conversation is on the record (honest by
          design), lets them optionally say who they are so the candidate can
          follow up, and lets them close the loop, all without forcing anything. */}
      {mode === 'live' && messages.length > 0 && (
        <div className="border-t border-[var(--rb-border)]">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--rb-text-muted)]">
              <Lock className="size-3" strokeWidth={2} />
              Saved for {firstName}, you&apos;ll both get a copy by email.
            </span>
            <div className="flex shrink-0 items-center gap-3">
              {identifyState === 'done' ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-success)]">
                  <Check className="size-3.5" />
                  Introduced
                </span>
              ) : (
                identifyState === 'idle' && (
                  <button
                    type="button"
                    onClick={() => setIdentifyState('form')}
                    className="text-[11px] font-medium text-[var(--rb-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--rb-brand)] hover:underline"
                  >
                    Introduce yourself
                  </button>
                )
              )}
              {delivered ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-success)]">
                  <Check className="size-3.5" />
                  Sent
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void deliverNow()}
                  className="text-[11px] font-medium text-[var(--rb-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--rb-brand)] hover:underline"
                >
                  Email it now
                </button>
              )}
            </div>
          </div>

          {(identifyState === 'form' || identifyState === 'saving') && (
            <div className="flex flex-col gap-2 border-t border-[var(--rb-border)] bg-[var(--rb-brand-subtle)]/30 p-3">
              <p className="text-[11px] text-[var(--rb-text-secondary)]">
                Optional, so {firstName} knows who reached out and can follow up. Any field is fine.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={rName}
                  onChange={(e) => setRName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Your name"
                  className={inputClass}
                />
                <input
                  value={rCompany}
                  onChange={(e) => setRCompany(e.target.value)}
                  placeholder="Company"
                  aria-label="Company"
                  className={inputClass}
                />
              </div>
              <input
                type="email"
                value={rEmail}
                onChange={(e) => setREmail(e.target.value)}
                placeholder="you@company.com (to get your copy)"
                aria-label="Your email"
                className={inputClass}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submitIdentify()}
                  disabled={identifyState === 'saving' || (!rName.trim() && !rCompany.trim() && !rEmail.trim())}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {identifyState === 'saving' ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIdentifyState('idle')}
                  className="rounded-[var(--radius-md)] px-2 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Persistent, low-key meeting invite. Appears once the conversation is
          deep enough (server-signaled) and the assistant has begun inviting a
          live talk in its own words. Never interruptive; hidden while the
          schedule form is already open. One tap opens that form, prefilled. */}
      {mode === 'live' && inviteMeeting && scheduleState === 'idle' && (
        <div className="border-t border-[var(--rb-border)] px-3 py-2">
          <button
            type="button"
            onClick={() => {
              if (!email.trim() && rEmail.trim()) setEmail(rEmail.trim());
              setScheduleState('form');
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]/50 px-3 py-1.5 text-xs font-semibold text-[var(--rb-brand)] transition-colors hover:bg-[var(--rb-brand-subtle)]"
          >
            <CalendarClock className="size-3.5" />
            Request time with {firstName}
          </button>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-[var(--rb-border)] p-3"
      >
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            Ask {assistantName} a question
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-grow with the content, capped by max-h below.
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 128)}px`;
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Ask ${firstName} anything about their career`}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-2.5 text-sm text-[var(--rb-text)] outline-none placeholder:text-[var(--rb-text-muted)] focus-visible:border-[var(--rb-brand)] focus-visible:ring-2 focus-visible:ring-[var(--rb-brand)]/30"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--rb-brand)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4" strokeWidth={2} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--rb-text-muted)]">
          Powered by RoleBoost. {assistantName} represents {firstName}&apos;s career history and may
          not reflect every detail.
        </p>
      </form>
    </div>
  );
}
````


#### `app/c/[slug]/page.tsx`

The public calling-card page hosting the chat.

````tsx
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { adminClient } from '@/lib/supabase/admin';
import { signCallingCardAssets } from '@/lib/candidate/calling-card';
import CallingCard from '@/components/modal/CallingCard';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from('candidate_profiles')
    .select('full_name, headline, target_role')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!data) return { title: 'Profile not found', robots: { index: false, follow: false } };

  const title = `${data.full_name} on RoleBoost`;
  const description =
    data.headline ??
    (data.target_role ? `${data.target_role} on RoleBoost` : 'Career profile on RoleBoost');

  // Calling cards are noindex by default so a candidate's career data does not
  // surface in search. A candidate can opt in via Settings (search_discoverable),
  // which flips this page to indexable. Read the preference defensively through the
  // service-role client: the column is added by the 20260715 migration, so a
  // not-yet-migrated DB simply degrades to the private-by-default noindex.
  let discoverable = false;
  try {
    const { data: pref } = await (adminClient.from('candidate_profiles') as any)
      .select('search_discoverable')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    discoverable = Boolean(pref?.search_discoverable);
  } catch {
    discoverable = false;
  }

  return {
    // `absolute` avoids the "| RoleBoost" title template (the name already reads well).
    title: { absolute: title },
    description,
    // Indexable only when the candidate opted in. Otherwise the page stays fully
    // shareable by link but is kept OUT of search. It remains crawlable (not
    // disallowed in robots.ts) so whichever directive applies is actually seen.
    robots: discoverable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CandidateProfilePage({ params }: Props) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch the public profile, anon client, RLS allows is_published = true
  const { data: profileData } = await supabase
    .from('candidate_profiles')
    .select('id, clerk_user_id, full_name, headline, target_role, location, linkedin_url, summary_bullets, ai_enabled')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!profileData) notFound();

  // Sign the active assets (private buckets) for the header avatar + gallery.
  const { avatarUrl, assets } = await signCallingCardAssets(profileData.id);

  // Record the profile view reliably. A bare un-awaited insert during render is
  // dropped on serverless (the function returns before it completes), so defer it
  // with after() -- it runs after the response is sent and is guaranteed to
  // execute. Skip the owner's own views so the stat reflects recruiter interest,
  // not the candidate testing their own link (mirrors sandbox chats).
  const { userId: viewerId } = await auth();
  if (viewerId !== profileData.clerk_user_id) {
    after(async () => {
      const { error } = await (adminClient.from('profile_views') as any).insert({
        candidate_profile_id: profileData.id,
        viewer_clerk_user_id: viewerId ?? null,
      });
      if (error) console.error('profile_views insert failed', profileData.id, error);
    });
  }

  return (
    <div className="min-h-screen bg-[var(--rb-bg-page)]">
      {/* No marketing header here: this is the recruiter-facing calling card, kept
          focused on the conversation and the candidate. RoleBoost is credited
          subtly inside the chat panel ("Powered by RoleBoost AI"). */}
      <CallingCard
        slug={slug}
        fullName={profileData.full_name}
        headline={profileData.headline}
        targetRole={profileData.target_role}
        location={profileData.location}
        linkedinUrl={profileData.linkedin_url}
        summaryBullets={profileData.summary_bullets ?? []}
        aiEnabled={profileData.ai_enabled ?? false}
        avatarUrl={avatarUrl}
        assets={assets as any}
      />
    </div>
  );
}
````


#### `lib/candidate/calling-card.ts`

Server-side data assembly for the public calling card.

````ts
import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// The asset buckets are private, so calling-card assets are served via short-
// lived signed URLs generated with the service-role client. Callers must have
// already authorized access to this profile (public publish check, or ownership).

export type CallingCardAssetType =
  | 'audio'
  | 'debate_audio'
  | 'video'
  | 'deck'
  | 'infographic'
  | 'resume';

export interface CallingCardAsset {
  asset_type: CallingCardAssetType;
  file_name: string;
  signed_url: string;
}

export interface SignedCallingCardAssets {
  /** The avatar is pulled out of the gallery and rendered in the profile header. */
  avatarUrl: string | null;
  assets: CallingCardAsset[];
}

/**
 * Signs the active assets for a candidate profile for the calling card, shared by
 * the public `/c/[slug]` page and the owner preview. The avatar is returned
 * separately so the header can render it; every other asset flows into the
 * gallery. Assets that can't be signed (e.g. a bucket that doesn't exist yet) are
 * skipped rather than failing the whole card.
 */
export async function signCallingCardAssets(
  profileId: string,
): Promise<SignedCallingCardAssets> {
  const { data: assetData } = await (adminClient.from('candidate_assets') as any)
    .select('asset_type, file_name, storage_bucket, storage_path')
    .eq('candidate_profile_id', profileId)
    .eq('is_active', true);

  const assets: CallingCardAsset[] = [];
  let avatarUrl: string | null = null;

  for (const asset of assetData ?? []) {
    try {
      const { data: signedData } = await (adminClient.storage
        .from(asset.storage_bucket) as any)
        .createSignedUrl(asset.storage_path, 3600);
      if (!signedData?.signedUrl) continue;
      if (asset.asset_type === 'avatar') {
        avatarUrl = signedData.signedUrl;
      } else {
        assets.push({
          asset_type: asset.asset_type,
          file_name: asset.file_name,
          signed_url: signedData.signedUrl,
        });
      }
    } catch {
      // Skip assets we can't sign, bucket may not exist yet.
    }
  }

  return { avatarUrl, assets };
}
````


#### `components/candidate/PromptBot.tsx`

The learning-loop UI: surfaces transcript gaps and adopts suggested answers into custom QA pairs.

````tsx
'use client';

import { useState, useTransition } from 'react';
import { Inbox, ArrowRight, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { markGapAddressed, adoptGapAnswer } from '@/app/(candidate)/dashboard/ai/actions';
import type { TranscriptGap } from '@/lib/types';

interface Props {
  gaps: TranscriptGap[];
  /** Scroll to + focus the matching brain field in the Build section. */
  focusBrainField: (key: string) => void;
}

const FIELD_LABELS: Record<string, string> = {
  leadership_philosophy: 'leadership philosophy',
  key_wins: 'key wins',
  departure_reasons: 'departure reasons',
  biggest_challenge: 'biggest challenge',
  ideal_environment: 'ideal environment',
  manager_needs: 'what you need from a manager',
  honest_weaknesses: 'honest weaknesses',
  wish_questions: 'questions you wish recruiters asked',
  custom_qa: 'custom answers',
};

/**
 * The prompt bot: surfaces gaps found in real recruiter conversations. Gaps
 * that come with a drafted answer (grounded in the brain's own data) get a
 * one-click "Add to my AI" approve path; the rest deep-link to the brain field
 * that needs the candidate's own words.
 */
export default function PromptBot({ gaps, focusBrainField }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [adopted, setAdopted] = useState<Set<string>>(new Set());
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = gaps.filter((g) => !dismissed.has(g.id));
  if (visible.length === 0) return null;

  function markDone(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(() => {
      void markGapAddressed({ gapId: id });
    });
  }

  function adopt(id: string) {
    setErrorId(null);
    setAdoptingId(id);
    startTransition(async () => {
      const result = await adoptGapAnswer({ gapId: id });
      setAdoptingId(null);
      if (result.ok) {
        setAdopted((prev) => new Set(prev).add(id));
      } else {
        setErrorId(id);
      }
    });
  }

  return (
    <section className="rb-card p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
        <Inbox className="size-4 text-[var(--rb-brand)]" />
        What recruiters asked
      </h2>
      <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
        Your AI came up short on these in real conversations. Approve a drafted answer or strengthen
        the field, and the next one lands better.
      </p>

      <ul className="flex flex-col gap-2.5">
        {visible.map((g) => {
          const isAdopted = adopted.has(g.id);
          const draft = g.suggested_answer?.trim() || null;
          return (
            <li key={g.id} className="rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3">
              {g.pattern_count >= 3 && (
                <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--color-warning)]">
                  <AlertTriangle className="size-3.5" />
                  Asked {g.pattern_count}×, recurring
                </span>
              )}
              <p className="text-sm text-[var(--rb-text-secondary)]">{g.suggested_prompt}</p>

              {draft && !isAdopted && (
                <div className="mt-2.5 rounded-[var(--radius-md)] border border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]/40 p-2.5">
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--rb-text-brand)]">
                    <Sparkles className="size-3" />
                    Drafted from what your AI already knows
                  </p>
                  <p className="text-xs italic text-[var(--rb-text-secondary)]">
                    &ldquo;{draft}&rdquo;
                  </p>
                </div>
              )}

              {isAdopted ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)]">
                  <Check className="size-3.5" />
                  Added to your custom answers. Your AI uses it from the next conversation.
                </p>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {draft && (
                    <button
                      onClick={() => adopt(g.id)}
                      disabled={adoptingId === g.id}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Sparkles className="size-3.5" />
                      {adoptingId === g.id ? 'Adding…' : 'Add to my AI'}
                    </button>
                  )}
                  {FIELD_LABELS[g.category] && (
                    <button
                      onClick={() => focusBrainField(g.category)}
                      className={
                        draft
                          ? 'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-3 py-1.5 text-xs font-semibold text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]'
                          : 'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90'
                      }
                    >
                      Strengthen {FIELD_LABELS[g.category]}
                      <ArrowRight className="size-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => markDone(g.id)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--rb-text-muted)] transition-colors hover:text-[var(--rb-text-secondary)]"
                  >
                    <Check className="size-3.5" />
                    Mark done
                  </button>
                  {errorId === g.id && (
                    <span className="text-xs text-[var(--color-error)]">
                      Could not add it just now. Please try again.
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
````


---

## 7. Access control: Clerk middleware, entitlements, RLS inventory

### 7.1 Clerk middleware (public vs authenticated routes)

#### `middleware.ts`

Which chat/AI routes are public (recruiters are anonymous) vs Clerk-protected.

````ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/terms',
  // Recruiter-facing marketing page, linked from the landing nav.
  '/recruiters',
  // The Boosts marketing page and every persona example page (/boosts/[slug]).
  '/boosts(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/c/(.*)',
  // SEO / crawler + metadata asset routes. Their .txt/.xml/no-extension paths are
  // not covered by the matcher's static-file exclusion, so without this a
  // signed-out crawler request would be redirected to sign-in and never see them.
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/twitter-image',
  '/icons/(.*)',
  '/api/webhooks/(.*)',
  // Recruiters chat with a candidate's AI without signing in. The route reads
  // auth() itself to optionally identify a logged-in owner/employer.
  '/api/chat(.*)',
  // Transcript delivery is triggered by the chat surface on close (anonymous).
  '/api/transcripts(.*)',
  // Cron sweep (transcript safety net); self-authenticates via CRON_SECRET.
  '/api/cron/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const url = req.nextUrl;

  if (userId && (url.pathname.startsWith('/sign-in') || url.pathname.startsWith('/sign-up'))) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files. The extension list MUST include media
    // (audio/video) as well as images/fonts/docs, otherwise Clerk runs on those
    // requests and auth-protects them: a signed-out fetch of /boosts/*.mp3 then
    // gets an HTML 404 instead of the file, and the <audio> element fails to play.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|avif|png|gif|svg|ico|ttf|woff2?|csv|docx?|xlsx?|pdf|zip|webmanifest|mp3|m4a|aac|wav|ogg|oga|opus|flac|mp4|m4v|mov|webm)).*)',
    '/(api|trpc)(.*)',
  ],
};
````

### 7.2 The entitlement seam

#### `lib/auth/entitlements.ts`

All candidate AI access flows through assertCandidateAiAccess; BILLING_ENFORCED=false during rollout, flips to the real subscription/trial check with no caller changes.

````ts
import 'server-only';
import type { SubscriptionStatus } from '@/lib/types';

// Entitlement seam for the candidate AI Studio.
//
// The product direction is that AI Studio (chatbot + context generation) becomes
// a paid candidate component with a free trial -- a departure from the original
// "candidates always free" decision. The billing/trial system (candidate Paddle
// products, trial clock, gating the public chat) is a separate workstream.
//
// This file is the single place that decides candidate AI access. Until billing
// ships, BILLING_ENFORCED is false and access is open to all candidates during
// rollout. When subscriptions/trials land, flip the flag and the real check below
// takes over -- no caller changes needed.

export class EntitlementError extends Error {
  constructor(public code: 'PAYMENT_REQUIRED' = 'PAYMENT_REQUIRED') {
    super(code);
  }
}

interface AccessUser {
  is_admin: boolean;
  subscription_status: SubscriptionStatus;
}

// Typed as boolean (not the literal `false`) so the real check below is not
// flagged as unreachable while the flag is off. Flip to true in the billing PR.
const BILLING_ENFORCED: boolean = false;

/** Whether a candidate may use AI Studio + context generation + the live chatbot. */
export function candidateHasAiAccess(user: AccessUser): boolean {
  if (!BILLING_ENFORCED) return true;
  if (user.is_admin) return true;
  return user.subscription_status === 'active';
}

/** Throws EntitlementError('PAYMENT_REQUIRED') when the candidate lacks access. */
export function assertCandidateAiAccess(user: AccessUser): void {
  if (!candidateHasAiAccess(user)) throw new EntitlementError();
}
````

### 7.3 RLS policy inventory (chat/AI tables)

Policies live in the migrations already included in section 2; this is the map. Isolation keys off `requesting_user_id()` (`auth.jwt() ->> 'sub'`, defined in the initial schema).

| Table | Policy | Migration | Effect |
|---|---|---|---|
| `candidate_profiles` | `candidate_profiles_owner` / `candidate_profiles_public_read` | `20260620000000_initial_schema.sql` | owner full access; public read for card display |
| `candidate_profiles` (columns) | `REVOKE SELECT FROM anon` + explicit safe-column `GRANT` | `20260626000000_ai_brain.sql` | brain columns (custom_qa_pairs, context fields, context_package_md, asset_package, all later additions) unreadable by anon |
| `resume_documents` | `resume_documents_owner` | `20260622100000_resume_pipeline.sql` | owner only |
| `chat_sessions` | `chat_sessions_candidate_read`, `chat_sessions_employer_read`, `chat_sessions_insert` | `20260626000000_ai_brain.sql` | candidate reads own sessions; employer viewer reads theirs; insert policy (todo.md flags dropping the anon INSERT policy, writes should go service-role only) |
| `chat_messages` | `chat_messages_session_access` | `20260626000000_ai_brain.sql` | access derived from session access |
| `sandbox_sessions` | `sandbox_sessions_owner` | `20260628000000_sandbox_sessions.sql` | owner only |
| `intake_answers` | `intake_answers_owner` | `20260629000000_intake.sql` | owner only |
| `transcript_gaps` | `transcript_gaps_owner` | `20260630000000_transcript_gaps.sql` | owner only |
| `brain_hardening_sessions` | `hardening_sessions_owner` | `20260701000000_brain_hardening.sql` | owner only |
| `career_sources` | `career_sources_owner` | `20260702000000_career_sources.sql` | owner only |
| `meeting_requests` | `meeting_requests_owner` | `20260707000000_meeting_requests.sql` | candidate owner reads/actions; inserts are service-role (recruiter is anonymous) |
| `rate_limits` | `REVOKE ALL FROM anon, authenticated` (no policies) | `20260709000000_rate_limits.sql` | service-role only, including `check_rate_limit()` |

Trust-boundary rules enforced in code rather than RLS (see `app/api/chat/route.ts` and CLAUDE.md): conversation history is rebuilt server-side from `chat_messages`, never accepted from the client; a client-supplied `sessionId` is verified against the candidate's profile before any read/write; role is always looked up from Supabase `users.role`, never from Clerk metadata or client claims.

---

## 8. Spec documents and architecture docs

### 8.1 Build specs (`docs/architecture/specs/`)

#### `docs/architecture/specs/README.md`

Index of the spec documents and their status.

````md
# Historical Build Specs

These are the **point-in-time design documents** the features were built from. They
capture original intent, rationale, and the data-model/API shapes proposed at the
time.

> ⚠️ They are **not kept in sync with the code.** For how the system works *today*,
> use the numbered docs in the parent [`docs/architecture/`](../README.md) folder
> and the code itself. Read these for *why* a thing exists and the thinking behind
> it, not for current truth.

| File | Original scope |
|---|---|
| `ROLEBOOST_AI_BRAIN_SPEC.md` | The AI-brain + calling-card product reframe; intake, transcript loop, sandbox, hardening specs |
| `ELITE_SYSTEM_PROMPT_BUILD_SPEC.md` | The layered system-prompt builder design |
| `CANDIDATE_TOOLS_BUILD.md` | Candidate dashboard tooling build spec |
| `DASHBOARD_POLISH_BUILD.md` | Dashboard polish/UX build spec |
| `SUPERADMIN_DASHBOARD.md` | Superadmin dashboard spec (planned) |
| `career-sources.md` | Career-sources ingestion spec |

Product/vision docs (`PRD.md`, `VISION.md`) and operational content
(`CANDIDATE_ASSET_PRODUCTION_SKILL.md`, `prompts/`) intentionally remain in
`docs/`, and marketing material (`MARKET-RESEARCH.md`, `MARKETING_SITE_BUILD.md`,
the plain-English overview) lives in [`docs/marketing/`](../../marketing/README.md),
none of it is architecture.
````


#### `docs/architecture/specs/ROLEBOOST_AI_BRAIN_SPEC.md`

The original full AI-brain build spec (phases A-E: minimum viable brain, elite chat route, sandbox, intake, transcript loops).

````md
# RoleBoost -- AI Brain and Calling Card
## Product Vision and Scope Update
**Version:** 1.1
**Date:** June 2026
**Author:** Rob Ramos
**Purpose:** Update vision.md, PRD.md, and CLAUDE.md to reflect the evolved product flagship -- the candidate AI brain and mobile calling card -- and the growth loop that powers it.

---

## Instructions for Claude Code

This document defines a significant product evolution that must be reflected across three repository files. Read this entire document before making any changes. Then update each file in the order listed at the end of this document.

Do not rewrite the files from scratch. Use str_replace to update specific sections only. Preserve all existing content that is not explicitly replaced. Increment version numbers on all modified files.

No em dashes anywhere in any output. Use commas, semicolons, or periods instead.

---

## What Changed and Why

### The Old Framing

The previous product framing positioned RoleBoost as a career asset platform -- audio overviews, infographics, slide decks, ATS resumes -- supported by a personal AI chatbot. The asset suite was the flagship. The chatbot was a feature.

### The New Framing

The candidate AI brain is the flagship. The asset suite is value-added. Everything else -- the audio, the infographic, the resume, the intake interview, the calling card -- exists to feed the brain or deliver it to recruiters.

This reframe is not cosmetic. It changes what the product is, how it is described, how it is sold, and what gets built first.

### Why This Framing Is Correct

Research conducted June 2026 confirmed:

The candidate-owned AI chatbot category does not exist as a commercial product. Two individual developers (Joshua Curry with ChatJC, Vishal Patil with VAi) built DIY versions for themselves. No platform offers this to non-technical candidates. The category is empty.

Every existing candidate tool -- Jobscan, Teal, Rezi, Kickresume -- optimizes a document and walks away. They stop at the resume. None of them represent the candidate in a live conversation with a recruiter. None of them get smarter over time. None of them produce a transcript. None of them close the loop between what a recruiter asked and what the candidate needs to improve.

Employer-side AI (Paradox/Olivia acquired by Workday for $1 billion, Eightfold, HiredScore) is entirely focused on processing candidates faster for employers. None of it serves the candidate.

The market gap is not a gap in resume tools. It is a gap in candidate representation. RoleBoost fills it.

---

## The Flagship -- The Candidate AI Brain

### What It Is

A personal AI trained on each candidate's verified career data that represents them to recruiters 24/7, answers hard questions accurately, delivers a full transcript to both sides after every conversation, and gets smarter with every interaction.

### What Makes It Different From Every Other Tool

Every AI resume tool optimizes a document without knowing the person behind it. They produce plausible-sounding content -- including invented metrics -- because they have no access to the candidate's real story. A chatbot built on a resume scrape is a FAQ bot. It can answer "where did you work" but not "why did you leave" or "walk me through that gap."

RoleBoost's brain is built from three layers of verified context that no other tool collects:

**Layer 1 -- Document analysis.** The candidate uploads their resume, LinkedIn export, Indeed profile, or any combination. Claude Sonnet reads all uploaded documents simultaneously and does three things: extracts verified career facts, flags inconsistencies across documents (LinkedIn says VP, resume says Director; dates do not match; gap appears on one but not another), and identifies the 8 to 12 questions a recruiter would most likely ask based on what it found.

**Layer 2 -- AI intake interview.** The candidate is not handed a blank form. They are interviewed by an AI that already read their documents and knows what to ask. Questions are specific to that candidate's history, not generic. Candidate answers by typing or speaking. Voice input is transcribed and displayed for editing before submit. The intake runs 2 to 3 layers deep -- pass one asks the primary questions, pass two probes vague or incomplete answers, pass three fills remaining gaps. Maximum 20 questions across all passes. The candidate never sees pass boundaries -- they experience a conversation that gets progressively more specific.

**Layer 3 -- Recruiter conversation transcripts.** Every time a recruiter chats with the candidate's AI, the transcript is analyzed by Claude Sonnet after the session ends. Questions the chatbot deflected, follow-up questions that signaled incomplete first answers, and topics that came up without sufficient context are all identified and fed back to the candidate as expansion prompts. The brain grows from external interaction, not just internal reflection.

### The Growth Loop

```
Candidate builds brain via AI intake interview
        +
Recruiter conversations generate transcripts
        +
Transcript analysis identifies gaps and strong answers
        +
Prompt bot surfaces expansion questions from those gaps
        +
Candidate adds context via voice or text
        +
Brain gets deeper
        +
Chatbot performs better next conversation
        +
[loop repeats indefinitely]
```

This loop is the retention mechanism. The brain gets more valuable the longer the candidate stays on the platform. Switching cost is not the subscription fee -- it is the accumulated career intelligence that lives nowhere else.

### Hallucination Prevention

The brain is only as trustworthy as the context it is built from. Four layers prevent hallucination:

**Closed context system prompt.** The AI is explicitly told it can only answer from verified candidate context. If information is not in the context, it does not exist. It never guesses, estimates, or infers.

**Honest deflection.** When context is insufficient, the chatbot says so gracefully: "That specific detail is not something I have on hand -- [Candidate] would be better placed to answer that directly." This is a trust signal, not a failure state.

**Context completeness gate.** A brain readiness score shows the candidate where their context is thin before the link goes live. Critical areas (gaps, departure reasons, key wins) must be addressed before the profile is shareable.

**Candidate self-testing.** Every candidate tests their own chatbot in a sandbox before sharing the link. They ask the hard questions. They verify the answers are accurate. The link does not go in their LinkedIn profile until they have confirmed the brain is honest.

### Brain Compartmentalization

Each candidate's brain is completely isolated. One candidate's context cannot reach another candidate's chatbot. This is structural, not a rule:

Claude Haiku has no persistent memory between sessions. Each conversation starts fresh with only that candidate's system prompt loaded. The system prompt is built from exactly one candidate profile record. No aggregation, no cross-candidate context, no shared blocks. One profile in, one brain out.

The skill -- the AI's ability to read documents, spot inconsistencies, generate questions, build context, handle recruiter questions -- is the same process applied to every candidate. The output is completely unique to each one. Same skill. Isolated experience. Every time.

---

## The Calling Card -- Mobile-First Public Profile

### What It Is

A mobile-optimized public profile page at `roleboost.app/c/[slug]` that functions as a digital calling card. No login required. No friction. The chat interface is the first thing a recruiter sees.

The candidate drops this link everywhere: LinkedIn contact info, LinkedIn About section, resume header, email signature, Indeed profile bio, job application follow-up emails. One link. Every context.

### The Mobile Experience -- Three Layers

**Layer 1 -- The Card (above the fold on mobile)**
Everything a recruiter needs in under five seconds:
- Candidate name and avatar
- Headline (one line)
- Target role
- Chat input, open and ready, with placeholder text: "Ask [Name] anything about their career"
- One tap to start the conversation

Nothing else. No navigation. No tabs. No scrolling required to reach the chat.

**Layer 2 -- The Profile (scroll or tap "Learn more")**
- Audio overview with a prominent play button
- Key stats infographic -- three or four numbers that define the career
- Two to three sentence bio

**Layer 3 -- The Full Package (for recruiters going deep)**
- Full resume download
- Slide deck
- All remaining assets

Most recruiters never leave Layer 1. They chat, get a transcript, and move on. Layers 2 and 3 exist for recruiters who want more before a call.

### Chat Opens as Full-Screen Overlay on Mobile

Tapping the chat input expands to a full-screen chat interface. The card is the introduction. The overlay is the conversation. Closing the overlay returns the recruiter to the card. Clean separation.

### After the Conversation

When the recruiter closes the chat or after 30 minutes of inactivity, a transcript is generated and delivered by email to both sides immediately.

**The recruiter receives:** Full transcript, direct link to save the candidate, send feedback, or schedule a call.

**The candidate receives:** Full transcript, pattern insights from recent recruiter conversations, specific expansion prompts to strengthen the brain based on what was asked.

### PWA Support

The profile page is PWA-capable (Progressive Web App). Recruiters evaluating a candidate can add the profile to their phone home screen for one-tap access throughout the hiring process. No app store. No download. Just there.

### Native Share on Mobile

A visible share button triggers the native iOS or Android share sheet. One tap to send the profile link via text, email, Slack, Teams, or any other app. The link propagates through the hiring process -- recruiter shares with hiring manager, hiring manager shares with panel -- without the candidate doing anything.

---

## The Prompt Bot -- Brain Expansion Over Time

### What It Does

A lightweight AI coach that lives in the candidate dashboard and surfaces specific expansion questions when the brain has room to grow. Not generic. Not scheduled. Contextual and specific, based entirely on what is already in the brain.

### Trigger Events

**Gap identified from recruiter conversation.** "A recruiter recently asked about your budget responsibility at [Company]. Your AI did not have enough detail to answer confidently. Can you add that now?"

**Pattern detected across multiple conversations.** "This question has come up in 4 of your last 6 recruiter conversations. Your AI's current answer may not be landing. Want to strengthen it?"

**Thin area detected in existing context.** "Your AI knows what you achieved at [Company] but not how you approached the first 90 days. Recruiters at the director level ask about this. Here is a prompt to expand on it."

**Resume or profile update.** "You added a new role. Your AI needs context on why you made that move and what you accomplished. Here are two questions to get started."

**Time-based nudge (30 days inactive).** "You have been active for a month. Here are two areas where a little more detail would make your AI significantly stronger."

### What the Prompts Look Like

Always two to three specific questions. Never a blank box. Always grounded in what is already in the brain.

Good example: "You mentioned the third shift build at Brightship but did not describe how you handled the first 30 days once the team was hired. What did that onboarding period look like and what would you do differently?"

Bad example: "Tell us more about your leadership style." (Generic, not grounded in context -- never do this.)

### Brain Health Score

A visible readiness indicator in the candidate dashboard. Not gamification -- a genuine signal of how well-armed the chatbot is.

```
Your AI is ready for:
Core career questions          [====    ] 80%
Hard questions (gaps, pivots)  [===     ] 50%
Leadership and philosophy      [=====   ] 70%
Role-specific depth            [=       ] 20%

2 prompts ready to strengthen your weakest areas
```

Score is calculated from context completeness per category, not from a points system. Each category maps to the fields that feed it.

### Notification Delivery

**In-app:** Quiet indicator on the dashboard. "Your AI has 2 new expansion prompts ready." Not a red badge.

**Email:** Weekly digest only. "Here is what your AI learned from recruiter conversations this week, and here are two ways to make it stronger." One email. Skippable.

**Push (mobile):** High-priority gaps only. "A recruiter asked your AI something it could not answer. Tap to fill that gap now." Tied to real missed opportunities.

---

## The Fiverr Service -- Reframed

### Old Framing

"Career asset package." The thing being sold was the audio overview, the infographic, the slide deck, the resume.

### New Framing

"We build your AI brain for you." The thing being sold is a live chatbot that represents the candidate accurately to any recruiter who clicks their link. The assets come with it. But they are not the product.

### What the Elite Package Actually Delivers

Rob conducts the intake interview -- reads the candidate's documents, runs the AI analysis, asks the personalized questions, captures the answers. The output is a fully built, tested, live AI brain plus the complete asset suite. The candidate leaves with a shareable link they can put in their LinkedIn profile that day.

This is the done-for-you version of what the self-serve platform automates. Same output. Different delivery. The Elite price point is now justified by something that actually cannot be replicated by a cheaper tool -- a verified, tested, recruiter-ready AI brain.

---

## The Asset Suite -- Value-Added Role

The audio overview, debate audio, video, infographic, and slide deck remain part of the product. Their role shifts:

**ATS resume:** What gets the candidate past the filter so a recruiter finds the link in the first place.

**Audio overview:** What a recruiter listens to before or after chatting with the AI. Provides the narrative arc.

**Infographic:** What makes the profile page worth sharing on LinkedIn. Visual proof of the career story.

**Resume Intelligence:** What arms the AI before the first recruiter question arrives. Identifies the hard questions coming and closes the gaps before a recruiter exposes them.

None of these are the flagship. They are all reasons the flagship works better.

---

## Updated Competitive Positioning

| Platform | What They Do | The Gap They Leave |
|---|---|---|
| Jobscan / Teal / Rezi | Optimize a document for ATS | Stop at the document. Candidate is on their own after. |
| LinkedIn | Passive text profile | No AI. No conversation. No transcript. |
| Resume writers | Human-written text | One-time output. Does not represent the candidate live. |
| ATS graders | Resume score and keywords | Coach the document, not the person. |
| Paradox / Olivia | Employer-owned AI screening | Works for the employer. Eliminates candidates. |
| Eightfold / HiredScore | Employer AI ranking | Scores candidates against employer criteria. No candidate control. |
| DIY chatbots (Curry, Patil) | Individual developers building their own | Requires technical ability. Not available to non-technical candidates. |

**RoleBoost is the only platform that gives non-technical candidates a personal AI that represents them accurately in live recruiter conversations, gets smarter from every interaction, and delivers a transcript to both sides.**

---

## Updated Moats

**Moat 1 -- The brain depth.** Context built from documents plus layered AI intake plus recruiter conversation transcripts. Nobody else collects all three. The brain after six months of recruiter conversations is something that cannot be replicated by a document tool.

**Moat 2 -- The growth loop.** The brain compounds with every recruiter interaction. Time on platform equals brain depth. A candidate who has been on RoleBoost for six months has a fundamentally more capable AI than one who joined yesterday. That gap widens over time.

**Moat 3 -- The transcript layer.** Every conversation generates data. That data feeds the brain. The brain feeds better conversations. Better conversations generate better data. This loop is impossible to replicate without the conversation history it depends on.

**Moat 4 -- The honest read.** Every other AI tool inflates. RoleBoost grounds. In a market where 91% of hiring managers have caught AI misrepresentation, the honest candidate is the differentiated one. That positioning is defensible as long as the platform enforces it.

---

## Files to Update in the Repository

Update the following files using str_replace. Do not rewrite from scratch. Preserve all content not explicitly replaced.

---

### File 1: `vision.md`

**Current version:** 3.2
**New version:** 4.0

**Replace the "The Solution" section** (currently at line 78) with the following:

```
## The Solution

The world's first candidate-owned AI representation platform.

The candidate AI brain is the flagship. Everything else -- the audio overview, the infographic, the ATS resume, the asset suite -- exists to feed the brain or deliver it to recruiters.

Job seekers upload their resume and any other career context they have. The platform reads all of it, flags inconsistencies across documents, and conducts a personalized AI intake interview -- not a generic form, but a conversation driven by what the AI actually found in their specific documents. Candidates answer by typing or speaking. Two to three layers of follow-up questions produce a brain deep enough to handle the questions recruiters actually ask.

That brain powers a personal career AI accessible via one shareable link. The link goes in their LinkedIn profile, their resume header, their email signature. A recruiter clicks it on their phone, sees a clean calling card, asks questions directly, and has a full transcript in their inbox before they finish their coffee.

No back and forth. No scheduling. No defensive screening calls. No three-day email chains. The recruiter gets the information they need. The candidate gets a transcript of exactly what was asked and what the AI said. Both sides move faster.

The brain grows with every interaction. Recruiter conversations generate transcripts that are analyzed for gaps. A prompt bot surfaces specific expansion questions based on what was asked. The candidate adds context. The brain gets smarter. The next recruiter gets a better answer.

One shareable link. A brain that grows. Your AI available around the clock.
```

**Replace the "How It Works -- The Candidate Experience" section** with the following:

```
## How It Works

### The Candidate Experience

1. **Upload** -- Resume, LinkedIn export, Indeed profile, or any combination. The more context provided, the deeper the brain.
2. **Cross-document analysis** -- Platform reads all uploaded documents simultaneously. Flags inconsistencies across documents. Identifies what recruiters will ask based on what it found.
3. **AI intake interview** -- The candidate is interviewed by an AI that already read their documents. Questions are specific to their history. 8 to 12 questions per pass, 2 to 3 passes deep, maximum 20 questions total. Candidate answers by typing or speaking (voice transcribed and editable before submit).
4. **Brain assembled** -- All verified context becomes the system prompt powering the personal career AI. The chatbot can only answer from verified context -- it never invents, guesses, or inflates.
5. **Candidate tests the brain** -- In a sandbox, the candidate asks their own AI the hard questions. Verifies accuracy. The link does not go live until the candidate confirms the brain is honest.
6. **One link goes live** -- `roleboost.app/c/[slug]` -- shareable anywhere. Mobile-optimized calling card with chat front and center. No login required for recruiters.
7. **Recruiters interact** -- Ask questions directly from the calling card on any device. Full transcript delivered to both sides after every session.
8. **Brain grows** -- Transcript analysis identifies gaps. Prompt bot surfaces expansion questions. Candidate adds context. Loop repeats.
```

**Replace the "Three Defensible Moats" section** with the following:

```
## Four Defensible Moats

1. **The brain depth** -- Context from documents plus layered AI intake plus recruiter conversation transcripts. Nobody else collects all three. The brain after six months of recruiter interactions cannot be replicated by a document tool.
2. **The growth loop** -- The brain compounds with every recruiter interaction. Time on platform equals brain depth. That gap widens over time and raises the switching cost without locking anyone in.
3. **The transcript layer** -- Every conversation generates data that feeds the next. Impossible to replicate without the conversation history it depends on.
4. **The honest read** -- Every other AI tool inflates. RoleBoost grounds. In a market where 91% of hiring managers have caught AI misrepresentation, the honest candidate is the differentiated one.
```

**Replace the Fiverr/Done-For-You table** with the following:

```
### Done-For-You Service (Fiverr / Direct)

The done-for-you service sells a live AI brain, not a document package.

| Package | Price | What's Included |
|---|---|---|
| Starter | $49 | ATS resume + profile setup + shareable link |
| Standard | $99 | ATS resume + audio overview + infographic + profile setup |
| Pro | $197 | Full asset suite + profile setup + basic chatbot context |
| Elite | $397 | Full asset suite + founder-conducted AI intake interview + fully built and tested brain + fine-tuning session + live chatbot ready to share |
```

**Add the following new section** after the Competitive Positioning table:

```
## The Calling Card

The public profile at `roleboost.app/c/[slug]` is designed as a mobile-first digital calling card. When a recruiter clicks the link from any context -- LinkedIn, a resume header, an email signature, an Indeed profile -- they land on a page that communicates three things in under five seconds: who this person is, what this page does, and an immediate invitation to start a conversation.

The chat input is open and ready above the fold on every device. No tabs to find. No buttons to click first. One thumb.

The calling card has three layers. Layer 1 is the card itself -- name, headline, target role, chat input. Layer 2 is the profile -- audio overview, key stats, brief bio. Layer 3 is the full package -- resume download, slide deck, all assets. Most recruiters never leave Layer 1.

The page is PWA-capable, meaning recruiters can add it to their phone home screen for one-tap access throughout the hiring process. A native share button lets recruiters send the link to hiring managers or panel members with one tap.

When the recruiter closes the chat, a transcript is generated and emailed to both sides immediately. The recruiter gets a record of the conversation with a direct link to save the candidate. The candidate gets a record of what was asked and specific prompts to strengthen the brain based on what the recruiter explored.
```

---

### File 2: `PRD.md`

**Current version:** 3.0
**New version:** 3.1

**Add the following as a new Section 8B** immediately after Section 8A (Resume Intelligence):

```
## Section 8B -- AI Intake Interview

### 8B.1 Overview

The AI intake interview replaces the generic context form. Instead of blank fields, the candidate is interviewed by an AI that has already read all their uploaded documents. Questions are generated specifically from what the AI found -- inconsistencies, gaps, thin areas, impressive claims that need backup. Candidates answer by typing or speaking.

This is the primary mechanism for building the candidate's AI brain. The quality of the intake determines the quality of the chatbot.

### 8B.2 Document Ingestion

Accepted upload types for brain building:
- Resume (PDF or DOCX) -- required minimum
- LinkedIn profile export (PDF or text)
- Indeed profile (text paste or PDF)
- Other job board profiles (text paste)

All uploaded documents are read simultaneously by Claude Sonnet. The analysis identifies:
- Verified career facts (roles, dates, companies, metrics, credentials)
- Inconsistencies across documents (title discrepancies, date mismatches, gaps that appear on one document but not another, metric differences)
- The 8 to 12 questions a recruiter would most likely ask based on what was found

### 8B.3 Inconsistency Report

Before the intake interview begins, the candidate sees a clear list of inconsistencies found across their uploaded documents. Each item is plainly stated:

"Your resume lists your title at [Company] as Director of Operations. Your LinkedIn profile lists it as VP of Operations. Recruiters and background check services will catch this. Which is accurate?"

This report alone is a differentiated feature. No other tool does cross-document consistency checking for candidates. It surfaces discrepancies the candidate may not know exist and gives them a chance to resolve them before a recruiter or background check service finds them.

### 8B.4 Intake Interview Flow

The interview runs in a conversational UI, one question at a time. The candidate does not see pass boundaries. They experience a single conversation that gets progressively more specific.

**Pass 1 (8 to 12 questions):** Primary questions based on document analysis. Covers employment gaps, career pivots, departure reasons, key wins requiring backup, degree gaps, short tenures, and anything else the document analysis flagged.

**Pass 2 (4 to 6 questions):** Follow-up questions targeting vague or incomplete Pass 1 answers. Only triggered for answers that were insufficient -- not for answers that were complete and specific. A short Claude Haiku evaluation pass scores each Pass 1 answer before Pass 2 questions are generated.

**Pass 3 (2 to 4 questions):** Final depth probes for areas still thin after Pass 2. Only triggered if genuine gaps remain. Often does not trigger at all if the candidate was thorough in Passes 1 and 2.

**Maximum total questions across all passes:** 20.

### 8B.5 Voice Input

Candidates can answer any question by speaking instead of typing.

- Browser-based audio recording via Web Audio API
- Transcription via OpenAI Whisper API
- Transcript displayed immediately for candidate review and editing
- Candidate submits the edited transcript, not the raw audio
- Raw audio is not stored after transcription

Cost estimate: approximately $0.003 per 90-second voice answer. Negligible at any realistic scale.

### 8B.6 Pass Evaluation Logic

Before generating Pass 2 questions, Claude Haiku evaluates each Pass 1 answer against four criteria:

1. Does it contain specific details or is it vague?
2. Does it use real numbers or generalizations?
3. Does it answer what was actually asked?
4. Does it raise new questions that need following up?

Answers scoring well on all four criteria do not generate Pass 2 follow-ups. Only insufficient answers trigger deeper probing. This keeps Pass 2 lean and targeted.

### 8B.7 Brain Assembly

After all passes are complete, the system assembles the candidate's brain -- a structured context document organized by topic that feeds the system prompt for the AI chatbot. The brain is stored in the candidate's profile and is editable at any time through the fine-tuning interface.

Brain structure per topic:
- What the documents showed
- What the candidate said in Pass 1
- What was clarified in Pass 2
- What was confirmed in Pass 3

This layered structure is visible to the candidate in the dashboard as their "brain depth" view.

### 8B.8 Context Completeness Gate

A brain readiness score is calculated from context completeness across four categories:

- Core career questions (roles, dates, basic history)
- Hard questions (gaps, pivots, departures, degree gaps)
- Leadership and philosophy
- Role-specific depth

The candidate sees this score and the specific areas that are thin before sharing their link. The chatbot can be shared at any completeness level -- but the candidate is clearly informed of what their AI can and cannot handle confidently.

### 8B.9 API Endpoint

`POST /api/intake/analyze`

**Request:**
```typescript
{
  candidateProfileId: string,
  uploadedDocumentIds: string[],
  pass: 1 | 2 | 3,
  previousAnswers?: IntakeAnswer[]
}
```

**Response:**
```typescript
{
  inconsistencies: Inconsistency[],
  questions: IntakeQuestion[],
  passComplete: boolean,
  nextPassRecommended: boolean
}

type Inconsistency = {
  id: string,
  sourceA: string,       // which document
  sourceB: string,       // which document
  description: string,   // plain language explanation
  severity: 'high' | 'medium' | 'low'
}

type IntakeQuestion = {
  id: string,
  question: string,
  context: string,       // why this question is being asked
  category: string,      // maps to brain section
  pass: number,
  followUpOf?: string    // ID of Pass 1 question this probes
}
```

### 8B.10 Data Model Additions

```sql
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS intake_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS intake_pass1_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_pass2_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_pass3_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brain_readiness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inconsistencies_found JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS inconsistencies_resolved JSONB DEFAULT '[]';

CREATE TABLE intake_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  answer_source TEXT NOT NULL CHECK (answer_source IN ('typed', 'voice')),
  pass_number INTEGER NOT NULL CHECK (pass_number IN (1, 2, 3)),
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE intake_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_answers_owner ON intake_answers
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
```

### 8B.11 Phase and Priority

**Phase 3** -- builds after the base chat endpoint is live and producing transcripts.

Build sequence within Phase 3:
1. Document upload and cross-document analysis (Sonnet)
2. Inconsistency report UI
3. Pass 1 question generation and conversational UI
4. Voice input and Whisper transcription
5. Pass evaluation logic and Pass 2 generation
6. Pass 3 conditional trigger
7. Brain assembly and readiness score
8. Integration with system prompt builder
```

**Add the following as a new Section 8C** immediately after Section 8B:

```
## Section 8C -- Transcript-to-Brain Loop

### 8C.1 Overview

Every recruiter chat session generates a transcript. That transcript is analyzed by Claude Sonnet after the session ends to identify gaps, insufficient answers, and new topics that need more context. The analysis feeds the prompt bot, which surfaces targeted expansion questions to the candidate.

This closes the growth loop. The brain grows not just from what the candidate provides but from what recruiters actually ask.

### 8C.2 Post-Session Analysis

Triggered after every chat session ends (modal close or 30-minute inactivity timeout), immediately after the transcript emails are sent.

Claude Sonnet receives the full transcript and the current brain context and returns a structured analysis:

```typescript
{
  deflections: TranscriptGap[],      // questions the chatbot could not answer
  weakAnswers: TranscriptGap[],      // answers that prompted follow-up questions
  newTopics: TranscriptGap[],        // topics raised without brain coverage
  strongAnswers: string[]            // question IDs the chatbot handled well
}

type TranscriptGap = {
  questionAsked: string,
  chatbotAnswer: string,
  gapType: 'deflection' | 'weak' | 'new_topic',
  suggestedPrompt: string,           // ready-to-display expansion prompt
  category: string,                  // which brain section this feeds
  priority: 'high' | 'medium' | 'low'
}
```

### 8C.3 Prompt Bot

Gaps from transcript analysis are added to the candidate's prompt queue. The prompt bot surfaces them in priority order through three channels:

**In-app:** Quiet indicator on the dashboard. Not intrusive.

**Email:** Weekly digest. One email. Lists what recruiters asked this week and two to three specific expansion prompts.

**Push (mobile):** High-priority gaps only. Tied to real missed recruiter opportunities.

Prompts are always specific and grounded in existing brain content. Generic prompts are never generated.

### 8C.4 Pattern Detection

When the same topic appears as a gap across three or more sessions, it is flagged as a pattern. Pattern gaps are surfaced with higher priority and include the frequency count:

"This question has come up in 4 of your last 6 recruiter conversations. Your AI's current answer may not be landing. Want to strengthen it?"

### 8C.5 Brain Health Score Update

After each transcript analysis, the brain health score is recalculated. Gaps reduce the score in their category. Expansion prompts answered increase it. The score reflects the current state of the brain, not a historical high.

### 8C.6 Data Model Additions

```sql
CREATE TABLE transcript_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  question_asked TEXT NOT NULL,
  chatbot_answer TEXT NOT NULL,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('deflection', 'weak', 'new_topic')),
  suggested_prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  is_addressed BOOLEAN NOT NULL DEFAULT FALSE,
  pattern_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transcript_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY transcript_gaps_owner ON transcript_gaps
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
```

### 8C.7 Phase and Priority

**Phase 3** -- builds after transcript delivery is live and producing data.

Build sequence within Phase 3:
1. Post-session Sonnet analysis call
2. Gap storage in transcript_gaps table
3. Prompt bot in-app indicator
4. Prompt bot email digest via Resend
5. Pattern detection (3+ session threshold)
6. Brain health score recalculation
7. Push notification for high-priority gaps (Phase 4)
```

---

### File 3: `CLAUDE.md`

**Current version:** current (no explicit version -- add version comment at top)

**Add the following entry to the "What Not to Build in MVP" section:**

```
- Multi-candidate context blending -- each brain is isolated to one candidate profile, never aggregated across candidates
- Auto-publish brain without candidate self-test -- candidate must verify accuracy before link goes live
```

**Add the following new section** at the end of the Claude API Usage section:

```
### Brain Compartmentalization Rule

Each chat session loads exactly one candidate's system prompt. The system prompt is built from exactly one candidate_profile record. No cross-candidate context. No aggregation. No shared blocks. This is enforced in code, not just by convention.

The candidate's brain is their verified career data only. The chatbot answers from that context or deflects honestly. It never guesses, estimates, or fills gaps with plausible-sounding content.

Hallucination prevention is enforced through four mechanisms:
1. Closed context system prompt -- AI told explicitly it can only answer from provided context
2. Honest deflection response -- graceful handling of gaps without invented answers
3. Context completeness gate -- thin brains flagged before link goes live
4. Candidate self-testing -- accuracy verified by candidate before sharing

### Voice Transcription

OpenAI Whisper API handles voice-to-text for intake interview answers.

- Browser records audio via Web Audio API
- Audio sent to `/api/transcribe` (server-side Whisper call)
- Transcript returned to UI for candidate review and editing
- Candidate submits edited transcript
- Raw audio is not stored after transcription
- Estimated cost: $0.003 per 90-second answer

Add to environment variables:
```bash
OPENAI_API_KEY=   # Whisper transcription only -- not used for chat or generation
```
```

---

## New Concepts Added in v1.1

Three new product concepts developed June 2026 are documented below. Each requires PRD additions. Instructions for Claude Code are at the end of this section.

---

## The Founder as First Guinea Pig

### Why This Matters

Rob Ramos is the first RoleBoost candidate. His profile is the live proof of concept, the platform demo, and the first documented recruiter interaction -- all in one.

The founder brings 20+ years of operations and logistics experience from floor to VP. That is the exact beachhead market. When a logistics recruiter or warehouse VP clicks Rob's RoleBoost link, they are not reading marketing copy -- they are experiencing the product firsthand from someone they recognize as credible in their domain.

### What This Unlocks Immediately

Rob's profile can go live before any other candidate is on the platform. The link goes in his LinkedIn bio, email signature, Fiverr profile, and resume header today. Every recruiter or hiring manager who clicks it and interacts with the AI is a real documented recruiter conversation -- the proof point the platform needs before any employer subscription conversation is possible.

This is also the fastest path to catching product friction. Every confusing question in the intake interview, every weak chatbot answer, every awkward deflection -- Rob experiences it personally before a paying candidate does. The founder's own profile is the quality gate.

### How to Build It

Rob goes through the intake interview as a candidate. No shortcuts. Full document upload (resume, LinkedIn export). Full cross-document analysis. Full 2 to 3 pass AI intake interview using voice input. Complete sandbox testing against the 20 hardest recruiter questions from 20 years of operations hiring experience. Brain does not go live until every hard question produces an answer Rob would be satisfied receiving from a strong candidate.

The target outcome: a live chatbot at `roleboost.app/c/rob-ramos` that any operations or logistics recruiter can interrogate and receive a full transcript from. That profile is the platform's first and most important asset.

---

## The Sandbox and AI-Powered Fine-Tuning Dashboard

### What It Is

A private testing environment inside the candidate dashboard where candidates stress-test their own AI before sharing the link -- and receive specific AI-powered coaching on exactly what to fix and where.

The sandbox is not a "test your chatbot" feature. It is the confidence mechanism that drives distribution. A candidate who has verified their AI handles the hardest recruiter questions accurately is a candidate who shares their link everywhere. Active sharing from confident candidates is how the platform gets recruiter interactions without spending on recruiter acquisition.

### The Sandbox Interface

A chat interface inside the candidate dashboard at `/dashboard/ai` that looks identical to what a recruiter sees on the public profile, with one difference: a clear label indicating this is a private test. No transcript sent. No session logged as a recruiter interaction. No employer notification.

The sandbox opens with a **suggested question library** -- not a blank input. A curated set of the 20 hardest recruiter questions organized by category, drawn from real recruiter behavior in operations and logistics hiring:

**Gap and departure questions:**
- "Walk me through the gap between [Company A] and [Company B]."
- "Why did you leave [most recent role]?"
- "What actually happened at [Company]?"
- "I see you have left three jobs in four years. Why should this be different?"

**Commitment and tenure questions:**
- "Your average tenure is under two years. What guarantees you will stay?"
- "You are overqualified for this role. Why do you want it?"
- "Where do you see yourself in five years?"

**Metric and achievement verification questions:**
- "Walk me through exactly how you calculated that cost savings figure."
- "How did you measure the 40% improvement you mentioned?"
- "That team size seems unusually large for that role. Can you clarify?"

**Leadership and management questions:**
- "Describe how you handle an underperforming team member. Give me a real example."
- "Tell me about a time you disagreed with your manager. What did you do?"
- "What would your last direct report say is your biggest weakness as a leader?"

**Adversarial premise questions:**
- "Given your background, why should I trust your commitment to an operations role?"
- "Your resume shows a lot of accomplishments but no degree. How do you respond to that?"
- "Candidates with your profile typically struggle with [X]. How are you different?"

**Weakness and failure questions:**
- "What are you genuinely not good at? Be honest."
- "Tell me about your biggest professional failure."
- "What would your references say about your weaknesses?"

The candidate selects a question from the library or types their own. The AI answers. Then the analysis runs.

### The AI Analysis Layer

After each sandbox answer, Claude Sonnet runs a fast evaluation against a specific rubric and returns a plain-language diagnosis:

**Evaluation criteria:**
- Did the answer use specific documented facts or vague generalizations?
- Did it stay grounded in the brain or drift toward invented detail?
- Was the response length appropriate -- too short, too long, or right?
- Did it sound like the candidate or like a generic AI?
- If the question was adversarial, did it handle the false premise correctly or capitulate?
- If the question involved a number or credential, was that claim grounded in the brain?

**Output format -- a diagnosis and a prescription:**

Not a score. A specific, actionable finding linked directly to the brain field that needs work.

Good example: "Your AI gave a vague answer to the departure question about [Company] because your departure reasons field only covers two roles and does not include this one. A recruiter asking this in the first 60 seconds of a screening call needs a specific, calm answer. Click here to add that context now."

Bad example: "Your answer could be improved." (Never do this -- not actionable.)

Each diagnosis includes:
- What the AI said (quoted)
- What was weak about it (specific, not generic)
- What brain field or custom QA pair needs more content
- A direct link to that field with the cursor placed in it
- A suggested expansion prompt to get started

### Pattern Recognition Across Sandbox Sessions

The analysis runs not just on individual questions but across all sandbox sessions to identify categories where the brain is consistently weak. If departure questions produce weak answers three times across different sandbox sessions, the brain health score drops in that category and the prompt bot surfaces it as a priority.

This pattern layer connects the sandbox directly to the transcript-to-brain loop -- both produce gap signals, both feed the same prompt bot queue, both update the same brain health score.

### PRD Addition -- Section 8D

**Add the following as Section 8D immediately after Section 8C in PRD.md:**

```
## Section 8D -- Sandbox and AI-Powered Fine-Tuning

### 8D.1 Overview

The sandbox is a private testing environment inside the candidate dashboard where candidates stress-test their AI against the hardest recruiter questions and receive specific AI-powered coaching on what to fix. It is the confidence mechanism that drives profile sharing.

### 8D.2 Sandbox Interface

**Location:** `/dashboard/ai` -- below the brain health score, above the transcript history.

**Components:**
- Chat interface identical to public modal chat (same endpoint, `sandbox: true` flag)
- Suggested question library -- 20 questions organized by 5 categories
- Free-form input for custom questions
- Analysis panel that appears after each AI response
- "Run full diagnostic" button that runs all 20 suggested questions in sequence and returns a complete brain health report

**Sandbox flag behavior:**
- `sandbox: true` on API call suppresses transcript delivery
- Session not logged to `chat_sessions` as a recruiter interaction
- No employer notification triggered
- Conversation history cleared on page reload

### 8D.3 Suggested Question Library

Stored as a static JSON file at `lib/ai/sandbox-questions.json`. Organized by category:

```typescript
type SandboxQuestion = {
  id: string,
  category: 'gap_departure' | 'commitment_tenure' | 'metric_verification' 
            | 'leadership' | 'adversarial' | 'weakness_failure',
  question: string,
  whyItMatters: string,    // shown to candidate before they run it
  brainFieldsTestedId: string[]  // which brain fields this question probes
}
```

### 8D.4 Post-Answer AI Analysis

After each sandbox answer, a Claude Sonnet evaluation call runs:

**API endpoint:** `POST /api/sandbox/analyze`

**Request:**
```typescript
{
  candidateProfileId: string,
  question: string,
  answer: string,
  questionCategory: string,
  brainSnapshot: string    // current system prompt -- what the AI had available
}
```

**Response:**
```typescript
{
  verdict: 'strong' | 'adequate' | 'weak' | 'hallucinated',
  diagnosis: string,          // plain language -- what was weak and why
  prescription: string,       // exactly what to add and where
  brainFieldTarget: string,   // which field to link to
  expansionPrompt: string,    // suggested text to get the candidate started
  patternSignal: boolean      // true if this is a recurring weakness category
}
```

**Verdict definitions:**
- `strong` -- answer was grounded, specific, and appropriately handled the question
- `adequate` -- answer was acceptable but could be stronger with more context
- `weak` -- answer was vague, deflected unnecessarily, or missed the point
- `hallucinated` -- answer contained a claim not present in the brain (triggers immediate alert)

### 8D.5 Full Diagnostic Mode

"Run full diagnostic" executes all 20 suggested questions in sequence against the candidate's AI and returns a complete brain health report organized by category. Each category gets a verdict (strong / adequate / weak) with the specific questions that produced each verdict.

The report is the most complete view of brain readiness available. It runs before the candidate shares their link for the first time and can be re-run after any significant brain update.

Estimated cost: 20 Haiku calls + 20 Sonnet analysis calls. Approximately $0.05 per full diagnostic run.

### 8D.6 Data Model Additions

```sql
CREATE TABLE sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_category TEXT NOT NULL,
  ai_answer TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('strong', 'adequate', 'weak', 'hallucinated')),
  diagnosis TEXT NOT NULL,
  prescription TEXT NOT NULL,
  brain_field_target TEXT,
  expansion_prompt TEXT,
  pattern_signal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sandbox_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sandbox_sessions_owner ON sandbox_sessions
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
```

### 8D.7 Phase and Priority

**Phase 3** -- builds alongside the chat endpoint and testing interface already specced in Section 3.3.

Build sequence within Phase 3:
1. Basic sandbox chat interface with `sandbox: true` flag
2. Suggested question library JSON and UI
3. Post-answer Sonnet analysis call and diagnosis display
4. Direct link from diagnosis to brain field
5. Full diagnostic mode
6. Pattern signal connection to prompt bot queue
7. Hallucinated verdict alert and immediate brain field CTA
```

---

## External Transcript Hardening

### What It Is

Candidates can upload or paste conversation transcripts from any source -- real recruiter calls they summarized, practice sessions with other AI tools, LinkedIn message threads, interview debrief notes, informational interview notes -- and the platform analyzes them to identify brain gaps and generate targeted expansion prompts.

This is the most powerful brain growth mechanism because it feeds verified external intelligence -- real questions from real hiring professionals -- directly into the improvement loop.

### Why It Is More Powerful Than Internal Sandbox Testing

The sandbox tests the brain against predicted questions. External transcript hardening tests it against questions that actually happened. A candidate who brings transcripts from 15 screening calls they had before discovering RoleBoost arrives with a fully mapped set of their real weaknesses. The brain hardens specifically against what real recruiters in their target market actually ask -- not what a question library predicts they will ask.

### Scenarios Where This Is Enormously Valuable

**Pre-platform job search history.** A candidate who has been searching for three months before finding RoleBoost has had 10 to 20 screening calls. They know which questions hurt them. They bring those transcripts. The brain immediately hardens against the specific gaps that real recruiters already found.

**Other AI practice tools.** Candidates using ChatGPT or Claude directly to practice interview answers paste those transcripts in. All prior practice becomes brain fuel rather than wasted effort.

**LinkedIn message threads.** A recruiter asked three qualifying questions in a DM before deciding whether to schedule. The candidate pastes the thread. The brain learns what that type of recruiter cares about.

**Interview debrief notes.** The candidate did not get the offer. They have notes from the debrief. The brain learns exactly what the hiring committee found insufficient and hardens specifically against those objections.

**Informational interview notes.** A coffee chat revealed gaps the candidate had not considered. Paste it in. Brain gets smarter.

### The Analysis Process

Claude Sonnet reads the uploaded transcript and does four things simultaneously:

**Step 1 -- Map questions to brain sections.** Every question asked in the transcript is identified and mapped to the brain section that should answer it. Not just hard questions -- all questions, including simple ones that might reveal thin coverage areas.

**Step 2 -- Gap analysis against current brain.** For each mapped question, evaluate whether the current brain has sufficient context to answer it well. Not how the candidate answered in that conversation -- how the AI would answer right now with the current brain. This reveals gaps the candidate may not have noticed.

**Step 3 -- Flag weak coverage areas.** Questions where the current brain would produce a weak or deflecting answer -- when a strong answer was available -- are flagged as high-priority gaps.

**Step 4 -- Generate expansion prompts.** For each identified gap, generate a specific expansion prompt that references the question that revealed it: "A recruiter asked about your budget authority at Brightship and your brain does not have enough detail to answer confidently. Walk through the scope of your financial responsibility in that role."

### Privacy Design

External transcripts contain the recruiter's questions and potentially their name, company, and communication style. The candidate owns their side of the conversation. The recruiter's side is reference material only.

Design rules:
- Uploaded transcripts are processed and discarded -- not stored as recruiter data
- Never used to identify or profile the recruiter
- Never surfaced in any employer-facing part of the platform
- Output is brain improvement recommendations only
- Disclosed clearly in the UI: "Transcripts you upload are used only to improve your AI brain. They are analyzed and discarded."

### PRD Addition -- Section 8E

**Add the following as Section 8E immediately after Section 8D in PRD.md:**

```
## Section 8E -- External Transcript Hardening

### 8E.1 Overview

Candidates upload or paste conversation transcripts from any source -- real recruiter screening calls, practice sessions with other AI tools, LinkedIn message threads, interview debrief notes -- and the platform analyzes them to identify brain gaps and generate targeted expansion prompts.

This is the growth loop powered by external intelligence rather than internal testing.

### 8E.2 Input Interface

**Location:** `/dashboard/ai` -- "Harden Your Brain" section, below sandbox.

**Two input methods:**

**Text paste field:** Any format. No structure required. The candidate copies and pastes whatever they have -- rough notes, a formal transcript, a message thread. The AI reads it as plain text and extracts the relevant questions and answers.

**File upload:** TXT or PDF. For candidates who have saved formal chat logs or typed up interview notes.

**Submit button:** "Analyze and find gaps"

### 8E.3 Analysis Process

**API endpoint:** `POST /api/transcript/harden`

**Request:**
```typescript
{
  candidateProfileId: string,
  transcriptText: string,
  transcriptSource: 'paste' | 'file',
  sourceContext?: string    // optional: "phone screening with [Company]", "ChatGPT practice"
}
```

**Response:**
```typescript
{
  questionsFound: number,
  gapsIdentified: TranscriptHardeningGap[],
  strongCoverageConfirmed: string[],  // questions brain handles well
  hardeningPlan: HardeningAction[]    // prioritized list of what to do
}

type TranscriptHardeningGap = {
  questionFromTranscript: string,
  brainCoverageVerdict: 'strong' | 'adequate' | 'weak' | 'missing',
  expansionPrompt: string,
  brainFieldTarget: string,
  priority: 'high' | 'medium' | 'low'
}

type HardeningAction = {
  priority: number,
  action: string,           // plain language instruction
  brainFieldTarget: string,
  expansionPrompt: string,
  linkToField: string       // direct URL to field in dashboard
}
```

### 8E.4 Output -- Hardening Plan

The output is a prioritized action list, not a report. Three to five actions ranked by impact, each with a direct link to the brain field and a suggested expansion prompt.

Example output:

```
Your brain analyzed against 12 questions from this conversation.

3 gaps identified:

[HIGH] Budget and P&L authority
A recruiter asked about your financial responsibility and your brain only has 
a general statement. Add the specific dollar figures and scope.
→ Add context to Key Wins

[MEDIUM] First 90 days approach  
Asked how you approach a new leadership role and your brain has no answer 
for this common question.
→ Add a custom answer

[LOW] Team composition and hiring philosophy
Your brain covers team size but not how you build and evaluate teams.
→ Expand Leadership Philosophy
```

### 8E.5 Privacy Enforcement

- Uploaded transcript text processed server-side and not stored after analysis
- Analysis output (gaps, prompts) stored in `brain_hardening_sessions` table
- No recruiter identifying information stored in any table
- Privacy disclosure shown in UI before first upload
- Candidate can clear their hardening history at any time

### 8E.6 Re-analysis After Brain Updates

After the candidate addresses the gaps from a hardening session, they can re-run the analysis on the same transcript to confirm the gaps are closed. The re-run compares the new brain state against the same questions. Each re-run confirms progress and surfaces any remaining gaps.

### 8E.7 Data Model Additions

```sql
CREATE TABLE brain_hardening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  transcript_source TEXT NOT NULL CHECK (transcript_source IN ('paste', 'file')),
  source_context TEXT,
  questions_found INTEGER NOT NULL DEFAULT 0,
  gaps_identified INTEGER NOT NULL DEFAULT 0,
  gaps_addressed INTEGER NOT NULL DEFAULT 0,
  hardening_plan JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reanalyzed_at TIMESTAMPTZ
);

ALTER TABLE brain_hardening_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY hardening_sessions_owner ON brain_hardening_sessions
  FOR ALL TO authenticated
  USING (
    candidate_profile_id IN (
      SELECT id FROM candidate_profiles WHERE clerk_user_id = requesting_user_id()
    )
  );
```

### 8E.8 Phase and Priority

**Phase 3** -- builds after transcript delivery and sandbox are live.

Build sequence within Phase 3:
1. Text paste and file upload UI
2. Sonnet analysis call and gap extraction
3. Hardening plan display with direct field links
4. Privacy disclosure and data handling
5. Re-analysis after brain updates
6. History view of past hardening sessions
```

---

## Updated Summary of Changes

| File | Version Change | Key Updates |
|---|---|---|
| vision.md | 3.2 to 4.0 | Flagship reframed as AI brain. Calling card section added. Growth loop added. Moats updated. Fiverr framing updated. |
| PRD.md | 3.0 to 3.2 | Section 8B (AI Intake Interview) added. Section 8C (Transcript-to-Brain Loop) added. Section 8D (Sandbox and AI Fine-Tuning) added. Section 8E (External Transcript Hardening) added. Data model additions for all four sections. |
| CLAUDE.md | no version to v1.0 | Brain compartmentalization rule added. Voice transcription spec added. Hallucination prevention documented. MVP exclusions updated. |

**Note on PRD versioning:** The original spec targeted PRD v3.1. With Sections 8D and 8E added, PRD target version is now 3.2.

---

*RoleBoost AI Brain and Calling Card Spec v1.1 -- roleboost.app -- Built by Rob Ramos -- June 2026*
````


#### `docs/architecture/specs/ELITE_SYSTEM_PROMPT_BUILD_SPEC.md`

The elite system-prompt + chat-route spec: prompt layer design, complexity routing, grounding validation.

````md
# RoleBoost -- Elite System Prompt Build Spec
## Upgrade `lib/ai/build-system-prompt.ts` and `app/api/chat/route.ts`
**Version:** 1.0
**Date:** June 2026
**Author:** Rob Ramos
**Purpose:** Replace the current flat system prompt template with a layered, XML-structured, expert-grade prompt architecture. Also upgrade the chat route with a complexity router and post-generation validation. No schema changes required. No new infrastructure. Same models, same costs.

---

## Instructions for Claude Code

Read this entire document before touching any file. Then execute the changes in the exact order listed. Use str_replace for every edit -- never rewrite a file from scratch. Run `npx tsc --noEmit` and `npm run lint` after all changes are complete.

No em dashes anywhere in any output.

---

## What Is Changing and Why

### Current state

`lib/ai/build-system-prompt.ts` produces a flat string that concatenates nine labeled fields after a two-line instruction. It works but has four structural weaknesses:

1. Instructions at the top get diluted by hundreds of tokens of resume text before the model reaches the end -- the last tokens before generation carry the most weight, so tone and rules should be near the bottom, not the top
2. No machine-parseable structure -- the model has to infer which lines are rules and which are data
3. No explicit knowledge boundary -- "never invent" is a vague hope without a clear "here is what you do not know" block
4. No reasoning guidance -- the model defaults to retrieval-style answers on questions that require synthesis across multiple career facts

### Target state

A layered, XML-tagged prompt that puts data near the top and rules near the bottom, with five new elements:

- An explicit knowledge boundary block
- A voice block built from the candidate's own words
- Constitutional principles (three values the AI reasons from, not a list of rules)
- Adversarial posture guidance
- 2 to 3 few-shot exemplars injected per candidate from their custom QA pairs

Plus: a complexity router in the chat route that escalates multi-part adversarial questions to Sonnet, and a lightweight post-generation validation pass for numeric and credential claims.

---

## Part 1 -- Upgrade `lib/ai/build-system-prompt.ts`

### Step 1 -- Replace the entire function body

Find this block in `lib/ai/build-system-prompt.ts`:

```typescript
export function buildCandidateSystemPrompt(candidate: CandidateProfile): string {
  return `
You are the career AI for ${candidate.full_name}. You represent them professionally to recruiters and hiring managers. You only answer questions using the career information provided below. If asked something outside this information, politely redirect to scheduling a direct conversation with the candidate.

Never invent, embellish, or extrapolate beyond what is provided. If you do not know the answer from the provided data, say so honestly and suggest the recruiter connect directly.

CAREER INFORMATION:
${candidate.resume_text}

CAREER CONTEXT:
Target Role: ${candidate.target_role}
Leadership Philosophy: ${candidate.leadership_philosophy}
Key Wins: ${candidate.key_wins}
Reasons for leaving each role: ${candidate.departure_reasons}
Biggest professional challenge: ${candidate.biggest_challenge}
Ideal team and work environment: ${candidate.ideal_environment}
What they need from a manager: ${candidate.manager_needs}
What they are not good at: ${candidate.honest_weaknesses}
Questions they wish recruiters would ask: ${candidate.wish_questions}

CUSTOM ANSWERS (candidate-refined):
${candidate.custom_qa_pairs}

PRIVACY SETTINGS:
Topics to redirect to direct conversation: ${candidate.redirect_topics}

Keep responses concise, warm, and grounded. No corporate speak. Let the career data speak for itself.
  `.trim();
}
```

Replace with:

```typescript
// lib/ai/build-system-prompt.ts
// v2.0.0 -- Layered XML prompt with knowledge boundary, voice matching,
//           constitutional principles, adversarial posture, and few-shot exemplars

import 'server-only';

export function buildCandidateSystemPrompt(candidate: CandidateProfile): string {

  // ── Helper: build the few-shot exemplar block ─────────────────────────────
  // Pull up to 3 custom QA pairs to use as worked examples.
  // These show the model the exact shape of a good answer in this candidate's voice.
  const exemplarBlock = buildExemplarBlock(candidate.custom_qa_pairs);

  // ── Helper: build the knowledge boundary block ────────────────────────────
  // Explicit list of what the AI knows and what it does not.
  // This is the single most effective hallucination-prevention mechanism.
  const boundaryBlock = buildKnowledgeBoundary(candidate);

  // ── Helper: derive voice descriptor from candidate's own writing ──────────
  // Used to lock tone to the candidate's actual register, not a generic voice.
  const voiceDescriptor = deriveVoiceDescriptor(candidate);

  return `
<role>
You are the personal career AI for ${candidate.full_name}. You speak in first person as ${candidate.full_name} -- "I", "my", "me" -- not "the candidate" or "they". You represent this person accurately and honestly to recruiters and hiring managers who are evaluating them for a role.

You are not a FAQ bot. You reason across the full picture of this career and give considered, human-sounding answers.
</role>

<career_information>
${candidate.resume_text ?? 'No resume text provided.'}
</career_information>

<context>
Target Role: ${candidate.target_role ?? 'Not specified'}
Leadership Philosophy: ${candidate.leadership_philosophy ?? 'Not provided'}
Key Wins: ${candidate.key_wins ?? 'Not provided'}
Reasons for Leaving Each Role: ${candidate.departure_reasons ?? 'Not provided'}
Biggest Professional Challenge: ${candidate.biggest_challenge ?? 'Not provided'}
Ideal Team and Work Environment: ${candidate.ideal_environment ?? 'Not provided'}
What I Need From a Manager: ${candidate.manager_needs ?? 'Not provided'}
What I Am Not Good At: ${candidate.honest_weaknesses ?? 'Not provided'}
Questions I Wish Recruiters Would Ask: ${candidate.wish_questions ?? 'Not provided'}
</context>

<custom_answers priority="highest">
These are answers I have personally refined. They take priority over everything else in this prompt. When a recruiter asks about any of these topics, use these answers first.

${formatCustomQA(candidate.custom_qa_pairs)}
</custom_answers>

${exemplarBlock}

${boundaryBlock}

<principles>
Three values I reason from in every answer:

1. Honesty first. I represent what is actually documented. I never inflate a number, invent a credential, or claim an outcome I cannot support from my career data. If I do not have a specific detail, I say so plainly.

2. Calm confidence. I am not defensive. I acknowledge real concerns honestly and redirect to evidence. I do not apologize for documented facts about my career. I do not accept false premises -- if a question assumes something untrue, I gently correct it before answering.

3. Human warmth. I sound like a thoughtful person, not a database. I use natural language, first person, and appropriate brevity. I do not speak in bullet points. I do not use corporate filler.
</principles>

<adversarial_posture>
Some recruiters will ask skeptical, challenging, or pressure-testing questions. The right response is always: acknowledge the concern genuinely, correct any false premise calmly, pivot to documented evidence, stay grounded.

Pattern for hard questions:
- Acknowledge: "That is a fair question."
- Correct if needed: "I want to clarify one thing -- [correct the premise if false]."
- Evidence: "What I can point to is [specific documented fact]."
- Bridge: "Happy to walk through the detail directly if that would help."

Never: capitulate to a false premise, invent supporting detail under pressure, become defensive or over-explain, apologize for documented career facts.

If a recruiter asks me to calculate or derive a specific figure that is not documented in my career data -- for example, an exact ROI methodology or a formula behind a metric -- I give the headline figure I do have and invite a direct conversation for the detail. I do not invent the math.
</adversarial_posture>

<redirect_topics>
These topics go to a direct conversation with ${candidate.full_name}, not to me:

${formatRedirectTopics(candidate.redirect_topics)}

When a redirected topic comes up: "That is something ${candidate.full_name} would be best placed to talk through directly. You can reach them via the Connect button on their profile."
</redirect_topics>

<voice>
${voiceDescriptor}

Respond in this register: concise, warm, grounded, first person. 2 to 4 sentences for straightforward questions. A short paragraph for questions that need reasoning. Never a wall of text. Never bullet points in a chat response. No corporate filler. Let the career data speak.
</voice>

<reasoning_instruction>
For questions that touch multiple parts of my career at once -- gaps plus pivots, short tenures plus commitment, specific metrics -- take a moment to locate the relevant facts across my career data before answering. Reason from the whole picture. Do not just retrieve the nearest matching field.

For numeric or credential claims: before stating any specific number, date, or credential, confirm it is present in my career information above. If it is not present, do not state it. Say I would need to confirm the detail directly.
</reasoning_instruction>
`.trim();
}

// ── Supporting helpers ──────────────────────────────────────────────────────

/**
 * Formats custom QA pairs as clean Q/A blocks.
 * Returns a placeholder string if no pairs exist.
 */
function formatCustomQA(pairs: CustomQAPair[] | null | undefined): string {
  if (!pairs || pairs.length === 0) {
    return 'No custom answers added yet.';
  }
  return pairs
    .map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`)
    .join('\n\n');
}

/**
 * Formats redirect topics as a simple list.
 * Returns a placeholder if none are set.
 */
function formatRedirectTopics(topics: string[] | null | undefined): string {
  if (!topics || topics.length === 0) {
    return 'No redirect topics set.';
  }
  return topics.map((t) => `- ${t}`).join('\n');
}

/**
 * Builds a few-shot exemplar block from the first 3 custom QA pairs.
 * These are worked examples that show the model the exact shape of a
 * good answer in this candidate's voice on a hard question.
 * Returns an empty string if no custom QA exists yet.
 */
function buildExemplarBlock(pairs: CustomQAPair[] | null | undefined): string {
  if (!pairs || pairs.length === 0) return '';

  const exemplars = pairs.slice(0, 3);

  const exampleXml = exemplars
    .map(
      (pair, i) => `
<example index="${i + 1}">
  <recruiter_question>${pair.question}</recruiter_question>
  <my_answer>${pair.answer}</my_answer>
</example>`
    )
    .join('\n');

  return `
<few_shot_examples>
Here are examples of how I answer hard questions in my own voice.
Use these as the model for tone, structure, and depth on similar questions.

${exampleXml}
</few_shot_examples>`.trim();
}

/**
 * Builds the explicit knowledge boundary block.
 * This is the most important hallucination-prevention mechanism.
 * It gives the model a clear, machine-parseable statement of what it
 * knows and what it does not -- and permission to say so.
 */
function buildKnowledgeBoundary(candidate: CandidateProfile): string {
  const knownSections: string[] = [];

  if (candidate.resume_text) knownSections.push('Full career history from resume');
  if (candidate.key_wins) knownSections.push('Key wins with documented context');
  if (candidate.departure_reasons) knownSections.push('Reasons for leaving each role');
  if (candidate.leadership_philosophy) knownSections.push('Leadership philosophy');
  if (candidate.biggest_challenge) knownSections.push('Biggest professional challenge');
  if (candidate.ideal_environment) knownSections.push('Ideal team and work environment');
  if (candidate.manager_needs) knownSections.push('What I need from a manager');
  if (candidate.honest_weaknesses) knownSections.push('Honest professional weaknesses');
  if (candidate.wish_questions) knownSections.push('Questions I wish recruiters asked');
  if (candidate.custom_qa_pairs && candidate.custom_qa_pairs.length > 0) {
    knownSections.push(`${candidate.custom_qa_pairs.length} personally refined answers`);
  }

  const knownList = knownSections.length > 0
    ? knownSections.map((s) => `- ${s}`).join('\n')
    : '- Resume and career context provided above';

  return `
<knowledge_boundary>
<known>
Everything in CAREER INFORMATION, CONTEXT, and CUSTOM ANSWERS above.
Specifically:
${knownList}
</known>

<not_known>
- Salary expectations or compensation requirements
- Contact information beyond what is on the resume
- References or reference contact details
- Any specific number, date, credential, or metric not present in the career data above
- Anything that happened after the resume was last updated
- Any detail the candidate has not chosen to share in their context
</not_known>

<when_not_known>
When asked about something outside my known data: say so plainly in first person and offer to connect directly.

Good deflection examples (match the candidate's tone):
- "That is not something I have in here -- worth asking me directly."
- "I do not have that specific detail on hand. Happy to dig into it if you reach out."
- "That one I would want to walk you through personally rather than have my AI approximate it."

Never say "I do not have that information in my provided data" -- that sounds like a system error, not a person.
</when_not_known>
</knowledge_boundary>`.trim();
}

/**
 * Derives a voice descriptor from the candidate's own writing.
 * Samples their leadership philosophy and biggest challenge fields
 * (the fields most likely to be written in their natural voice)
 * and generates a one-sentence tone instruction.
 *
 * This grounds voice in the candidate's actual register rather than
 * defaulting to a generic "friendly assistant" tone.
 */
function deriveVoiceDescriptor(candidate: CandidateProfile): string {
  // If the candidate has written enough context, derive tone from their words.
  // Otherwise fall back to a neutral warm default.
  const hasSufficientVoiceSamples =
    (candidate.leadership_philosophy?.length ?? 0) > 50 ||
    (candidate.biggest_challenge?.length ?? 0) > 50;

  if (!hasSufficientVoiceSamples) {
    return 'Speak in a warm, direct, first-person voice. Confident but not boastful. Honest and specific.';
  }

  // Sample up to 100 characters from the most voice-rich fields
  const sample1 = candidate.leadership_philosophy?.slice(0, 100) ?? '';
  const sample2 = candidate.biggest_challenge?.slice(0, 100) ?? '';

  return `Mirror the tone, vocabulary, and sentence rhythm of my own words. Sample of how I write:
"${sample1}${sample1 && sample2 ? '" / "' : ''}${sample2}"

Match that register in every response. If my writing is direct and plain, be direct and plain. If it is more reflective, be reflective. Do not impose a corporate or polished tone on top of my natural voice.`;
}
```

---

## Part 2 -- Upgrade `app/api/chat/route.ts`

This adds two capabilities on top of the existing handler:

1. A **complexity router** -- detects multi-part or adversarial questions and escalates them to Sonnet automatically
2. A **post-generation validation pass** -- checks numeric and credential claims against the brain before the answer reaches the recruiter

### Step 2 -- Add the complexity detector and validator

Find this block in `app/api/chat/route.ts`:

```typescript
export async function POST(request: Request) {
  const { candidateSlug, message, conversationHistory } = await request.json();

  // Load candidate data
  const candidate = await getCandidateBySlug(candidateSlug);
  const systemPrompt = buildCandidateSystemPrompt(candidate);

  // Call Claude Haiku -- cheap, fast, perfect for chat
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: message }
    ]
  });

  const answer = response.content[0].text;

  // Log the exchange
  await logChatExchange({
    candidateId: candidate.id,
    viewerClerkUserId: viewer?.clerk_user_id,
    employerAccountId: employer?.account_id,
    question: message,
    answer
  });

  return NextResponse.json({ answer });
}
```

Replace with:

```typescript
// app/api/chat/route.ts
// v2.0.0 -- Complexity router + post-generation validation

export async function POST(request: Request) {
  const { candidateSlug, message, conversationHistory } = await request.json();

  // Load candidate data
  const candidate = await getCandidateBySlug(candidateSlug);
  const systemPrompt = buildCandidateSystemPrompt(candidate);

  // ── Complexity router ──────────────────────────────────────────────────────
  // Simple heuristic check. If the question is adversarial, multi-part, or
  // challenges a specific number/credential, use Sonnet for better reasoning.
  // All other questions use Haiku (fast, cheap, handles straightforward queries).
  const isComplexQuestion = detectComplexQuestion(message);
  const model = isComplexQuestion
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001';

  // ── Generate answer ────────────────────────────────────────────────────────
  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: message }
    ]
  });

  let answer = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // ── Post-generation validation ─────────────────────────────────────────────
  // Only runs when the answer contains specific numbers, dollar figures,
  // percentages, or credential claims. Checks that those claims trace back
  // to the candidate's brain. If not grounded, replaces with a safe deflection.
  const isHighRiskAnswer = detectHighRiskContent(answer);
  if (isHighRiskAnswer) {
    answer = await validateAndSanitize(answer, candidate, systemPrompt);
  }

  // ── Log the exchange ───────────────────────────────────────────────────────
  await logChatExchange({
    candidateId: candidate.id,
    viewerClerkUserId: viewer?.clerk_user_id,
    employerAccountId: employer?.account_id,
    question: message,
    answer,
    modelUsed: model,
    wasComplex: isComplexQuestion,
    wasValidated: isHighRiskAnswer
  });

  return NextResponse.json({ answer });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detects whether a recruiter question is complex enough to warrant Sonnet.
 *
 * Triggers on:
 * - Multi-clause questions (and/but/given/considering)
 * - Skeptical or adversarial framing (why should I, convince me, prove,
 *   walk me through exactly, how did you calculate, that seems)
 * - Questions touching multiple career facts at once
 * - Contradiction-hunting ("but your resume says" / "I notice that")
 * - Gap or pivot synthesis questions
 *
 * This is a fast string heuristic -- no API call needed.
 * False positives (Haiku question routed to Sonnet) cost a few extra cents.
 * False negatives (Sonnet question handled by Haiku) cost answer quality.
 * Err toward Sonnet.
 */
function detectComplexQuestion(message: string): boolean {
  const lower = message.toLowerCase();

  const adversarialSignals = [
    'why should i',
    'convince me',
    'prove',
    'walk me through exactly',
    'how did you calculate',
    'how did you arrive',
    'that seems',
    'i find it hard to believe',
    'your resume shows',
    'i notice that',
    'i see that',
    'but you left',
    'short tenure',
    'job hopp',
    'why would this be different',
    'what actually happened',
    'be honest',
    'really why',
    'true reason',
  ];

  const synthesisSignals = [
    'given that',
    'considering',
    'taking into account',
    'with your background',
    'despite',
    'even though',
    'and also',
    'in addition to',
    'gap',
    'pivot',
    'switch',
    'change',
    'transition',
    'commitment',
  ];

  const hasAdversarialSignal = adversarialSignals.some((s) => lower.includes(s));
  const hasTwoOrMoreSynthesisSignals =
    synthesisSignals.filter((s) => lower.includes(s)).length >= 2;
  const hasMultipleClauses =
    (lower.match(/\band\b|\bbut\b|\bhowever\b|\balso\b/g) ?? []).length >= 2;

  return hasAdversarialSignal || hasTwoOrMoreSynthesisSignals || hasMultipleClauses;
}

/**
 * Detects whether a generated answer contains high-risk content --
 * specific numbers, dollar figures, percentages, or credential claims
 * that must trace back to the candidate's brain.
 *
 * Returns true when validation is warranted.
 * Fast regex check -- no API call.
 */
function detectHighRiskContent(answer: string): boolean {
  const highRiskPatterns = [
    /\$[\d,]+/,           // dollar figures
    /\d+%/,              // percentages
    /\d+[xX]\b/,         // multipliers (3x, 10X)
    /\d{4}/,             // four-digit numbers (years, large figures)
    /certified|certification|license|degree|pmp|six sigma|lean/i,
  ];
  return highRiskPatterns.some((pattern) => pattern.test(answer));
}

/**
 * Post-generation validation pass.
 *
 * Sends the answer and the candidate brain to Sonnet with a targeted prompt:
 * "Does every specific number, date, and credential in this answer appear
 * in the career data? Return JSON."
 *
 * If grounded: return the original answer unchanged.
 * If not grounded: return a safe, natural deflection.
 *
 * This is a lightweight, targeted call -- not a full re-generation.
 * Runs only when detectHighRiskContent returns true.
 */
async function validateAndSanitize(
  answer: string,
  candidate: CandidateProfile,
  systemPrompt: string
): Promise<string> {
  const validationPrompt = `
You are validating an AI-generated answer for accuracy.

CANDIDATE CAREER DATA:
${candidate.resume_text ?? ''}
${candidate.key_wins ?? ''}
${candidate.departure_reasons ?? ''}

GENERATED ANSWER TO CHECK:
"${answer}"

Task: Does every specific number, dollar figure, percentage, multiplier, year, certification, or credential mentioned in the answer appear explicitly in the career data above?

Return valid JSON only. No preamble. No markdown. Example format:
{"grounded": true, "unsupported_claims": []}
or
{"grounded": false, "unsupported_claims": ["$2.4M budget", "67% reduction"]}
`.trim();

  try {
    const validation = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: validationPrompt }]
    });

    const raw = validation.content[0].type === 'text'
      ? validation.content[0].text.trim()
      : '{"grounded": true, "unsupported_claims": []}';

    const result = JSON.parse(raw) as {
      grounded: boolean;
      unsupported_claims: string[];
    };

    if (result.grounded) {
      // Answer checks out -- return it unchanged
      return answer;
    }

    // Answer contains unsupported claims -- replace with a safe deflection
    // that sounds natural, not like a system error
    return `That detail is something I would want to confirm before giving you a specific figure -- I do not want to approximate something that matters. Worth asking me directly so I can give you the accurate number. You can reach me via the Connect button on my profile.`;

  } catch {
    // If validation fails for any reason, return the original answer.
    // Better to let a potentially imperfect answer through than to
    // break the chat experience entirely.
    return answer;
  }
}
```

---

## Part 3 -- Update `logChatExchange` to accept new fields

The `logChatExchange` call now passes two new fields: `modelUsed` and `wasValidated`. These should be stored in the `chat_messages` table for analytics (which model handled a given turn, whether it was validated).

### Step 3 -- Add migration for new chat_messages columns

Create a new migration file at `supabase/migrations/[timestamp]_add_chat_message_model_tracking.sql`:

```sql
-- Track which model handled each chat turn and whether validation ran
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS was_complex BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS was_validated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chat_messages.model_used IS
  'claude-haiku-4-5-20251001 or claude-sonnet-4-6 -- which model generated this response';
COMMENT ON COLUMN chat_messages.was_complex IS
  'true if the complexity router escalated this question to Sonnet';
COMMENT ON COLUMN chat_messages.was_validated IS
  'true if the post-generation validation pass ran on this response';
```

### Step 4 -- Update the logChatExchange type signature

Find the `logChatExchange` call signature (in `lib/ai/` or wherever it is defined) and add the three new optional fields:

```typescript
// Add to the logChatExchange params type
modelUsed?: string;
wasComplex?: boolean;
wasValidated?: boolean;
```

And in the Supabase insert:

```typescript
model_used: params.modelUsed ?? null,
was_complex: params.wasComplex ?? false,
was_validated: params.wasValidated ?? false,
```

---

## Part 4 -- Add the `CandidateProfile` type additions

The new `buildCandidateSystemPrompt` function uses `candidate.custom_qa_pairs` as a typed array, not a raw string. Confirm the type is correct.

In `lib/types/` (wherever `CandidateProfile` is defined), verify `custom_qa_pairs` is typed as:

```typescript
custom_qa_pairs: CustomQAPair[] | null;
```

And add the `CustomQAPair` type if it does not already exist:

```typescript
export type CustomQAPair = {
  question: string;
  answer: string;
};
```

If `custom_qa_pairs` is currently stored as raw JSONB and returned as `unknown` from Supabase, add a cast in the query that fetches the candidate profile:

```typescript
// In getCandidateBySlug or equivalent
const customQA = (rawCandidate.custom_qa_pairs as CustomQAPair[] | null) ?? null;
```

---

## Part 5 -- Update `CLAUDE.md` system prompt section

Replace the current system prompt construction example in CLAUDE.md (lines 137 to 169 -- the `buildCandidateSystemPrompt` code block) with the following description:

```markdown
### AI Chatbot Architecture

The candidate career AI is a Claude API call with a layered, XML-structured system prompt.
No fine-tuning, no embeddings, no vector database needed for MVP.

**Prompt structure (in order -- data near top, rules near bottom):**

1. `<role>` -- Identity assignment. First-person framing. Not a FAQ bot.
2. `<career_information>` -- Full resume text.
3. `<context>` -- Nine named context fields.
4. `<custom_answers priority="highest">` -- Candidate-refined QA pairs. Highest priority.
5. `<few_shot_examples>` -- 2 to 3 worked hard-question exemplars from custom QA.
6. `<knowledge_boundary>` -- Explicit known / not_known / when_not_known blocks.
7. `<principles>` -- Three constitutional values: honesty, calm confidence, human warmth.
8. `<adversarial_posture>` -- Pattern for handling skeptical or pressure-testing questions.
9. `<redirect_topics>` -- Topics that go to direct conversation, not the AI.
10. `<voice>` -- Tone instruction derived from the candidate's own writing.
11. `<reasoning_instruction>` -- Explicit guidance for synthesis and numeric grounding.

**Complexity router:**
- Simple factual questions: `claude-haiku-4-5-20251001` (fast, cheap)
- Multi-part, adversarial, or synthesis questions: `claude-sonnet-4-6` (better reasoning)
- Detection is a fast string heuristic -- no API call

**Post-generation validation:**
- Runs only when the answer contains numbers, dollar figures, percentages, or credential claims
- Fast Sonnet call checks that every claim traces to the career data
- If not grounded: replaces answer with a safe natural deflection
- If validation call fails for any reason: returns original answer (fail-safe)

**Updated cost estimate:**
- Simple turns (Haiku, no validation): ~$0.0008 per session (unchanged)
- Complex turns (Sonnet): ~$0.003 per turn -- estimate 2 to 3 complex turns per session
- Validation pass (Sonnet, 200 tokens, only on high-risk answers): ~$0.001 per validated turn
- Blended estimate for a 10-turn session with 2 complex + 1 validated: ~$0.01 per session
- 10,000 sessions per month: ~$100 -- still extremely cheap for the quality gain
```

---

## Testing Checklist

Before this goes live, run the following tests in the candidate AI testing sandbox (`/dashboard/ai`):

### Grounding tests (must pass -- these verify hallucination prevention)

- Ask a specific dollar figure that is NOT in the candidate's brain. Confirm the AI deflects naturally, does not invent a number.
- Ask about a certification or degree not in the resume. Confirm deflection.
- Ask a question about something that happened after the resume date. Confirm deflection.

### Adversarial tests (must pass -- these verify posture and reasoning)

- "Your resume shows you left every job in under two years. Why would this be different?" -- Confirm the AI checks the premise (is this actually true?), corrects if false, pivots to evidence, stays calm.
- "Walk me through exactly how you calculated that savings figure." -- If the methodology is not in the brain, confirm the AI gives the headline figure and invites a direct conversation rather than inventing the math.
- "Given your gap in [year] and the industry pivot, why should I trust your commitment to this role?" -- Confirm the AI synthesizes across both facts, reasons across the career trajectory, does not just retrieve one field.

### Voice tests (must pass -- these verify the candidate sounds like themselves)

- Ask three simple factual questions. Confirm responses are warm, first person, two to four sentences. No bullet points. No corporate filler.
- Read a response aloud. Does it sound like a person talking, or a database answering? It must sound like a person.

### Deflection tests (must pass -- these verify deflection sounds human)

- Ask a redirect topic. Confirm the response is warm and natural, not robotic.
- Confirm the deflection does not say "I do not have that information in my provided data."

### Complexity router tests (informational -- verify routing is working)

- Ask a simple question. Check server logs -- confirm `model_used` is `claude-haiku-4-5-20251001`.
- Ask an adversarial question. Check server logs -- confirm `model_used` is `claude-sonnet-4-6`.

---

## What Does Not Change

- The Supabase schema for `candidate_profiles` (no new columns required for this build)
- The `app/api/chat/route.ts` overall structure -- only the internals of the POST handler
- The chat UI -- zero frontend changes required
- The transcript delivery system -- no changes
- The fine-tuning interface -- custom QA pairs now get used as few-shot exemplars automatically
- Model names and API client configuration
- Resend email templates
- All auth, RLS, and error handling patterns

---

## Summary of Files Changed

| File | Change |
|---|---|
| `lib/ai/build-system-prompt.ts` | Full replacement of function body -- flat prompt to XML-layered prompt with all new elements |
| `app/api/chat/route.ts` | Complexity router + post-generation validation pass added inside POST handler |
| `supabase/migrations/[timestamp]_add_chat_message_model_tracking.sql` | New migration -- three columns added to chat_messages |
| `lib/types/` (CandidateProfile type file) | CustomQAPair type added, custom_qa_pairs typed as array |
| `CLAUDE.md` | AI Chatbot Architecture section updated to document new prompt structure and routing |

---

*RoleBoost Elite System Prompt Build Spec v1.0 -- roleboost.app -- Built by Rob Ramos -- June 2026*
````

### 8.2 Living architecture docs (`docs/architecture/`)

#### `docs/architecture/04-ai-brain.md`

How the brain is assembled and served (the living reference).

````md
# 04, The AI Brain

The candidate career AI is a **single Claude call with a layered, XML-structured
system prompt**. No fine-tuning, no embeddings, no vector DB. Each chat session
loads exactly one candidate's prompt, built from exactly one
`candidate_profiles` record, brains are structurally isolated, never aggregated.

## What feeds the brain (and what doesn't)

Assembled by `getCandidateBrainBySlug` (`lib/ai/get-candidate-brain.ts`), read
server-side via the service-role client:

1. **`candidate_profiles` brain columns**, the eight career-context fields,
   `custom_qa_pairs`, `redirect_topics`, identity, `ai_enabled`, `is_published`.
2. **`resume_documents.canonical_markdown`**, the résumé text, passed to the
   builder as a *separate argument*. There is **no `resume_text` column**.
3. **`context_package_md`**, the active [career context document](./05-career-context-document.md).
4. **The selected context-document angle's hard-question Q/A** is **promoted into
   `custom_qa_pairs`** (deduped against the candidate's own pairs) so it inherits
   highest-priority + few-shot treatment.

What does **not** reach the live prompt: `candidate_assets` (audio/video/etc. are
recruiter-facing media, not brain text) and `career_sources` raw text (those feed
the *intake interview* and *context-document generation*, not every chat turn).

`getCandidateBrainBySlug` returns `{ candidateProfileId, ownerClerkUserId,
isPublished, aiEnabled, candidate, resumeMarkdown, careerContextMarkdown }`. It
returns a profile even when unpublished/AI-off so the **owner can preview**; the
caller gates visibility.

## The layered system prompt

`lib/ai/build-system-prompt.ts` →
`buildCandidateSystemPrompt(candidate, resumeMarkdown, careerContextMarkdown)`.
Philosophy: **data near the top, rules near the bottom.** Order:

1. `<role>`, first-person identity ("I", "my"); not a FAQ bot.
2. `<career_context_document>`, *(when present)* the professionally synthesized
   narrative, placed first for primacy; the résumé below is the factual backstop.
   Omitted entirely when there is no document.
3. `<career_information>`, full résumé markdown.
4. `<context>`, the named career-context fields (target role, leadership
   philosophy, key wins, departures, challenge, environment, manager needs,
   weaknesses, wish-questions, additional context).
5. `<custom_answers priority="highest">`, candidate-refined QA pairs (plus the
   promoted hard question); used before anything else.
6. `<few_shot_examples>`, up to 3 worked exemplars drawn from the custom QA.
7. `<knowledge_boundary>`, explicit known / not-known / when-not-known. The
   strongest hallucination guard; it lists the document and résumé as "known" and
   names what is off-limits (salary, references, anything not in the data).
8. `<principles>`, honesty, calm confidence, human warmth.
9. `<adversarial_posture>`, how to handle skeptical / pressure-testing questions.
10. `<redirect_topics>`, topics routed to a direct human conversation.
11. `<voice>`, tone derived from the candidate's own writing samples.
12. `<reasoning_instruction>`, synthesis across the whole picture; numeric grounding.

## The chat call (`app/api/chat/route.ts`)

1. Zod-validate input (`candidateSlug`, `message`, `sessionId?`, up to 20 history
   turns).
2. `getCandidateBrainBySlug`; 404 if missing or `ai_enabled = false`.
3. **Visibility:** anonymous recruiters may only chat with published profiles; the
   owner (authenticated) may preview their own unpublished AI.
4. **Complexity router**, `detectComplexQuestion(message)`, a fast string
   heuristic (no API call): adversarial phrasing, multi-fact synthesis, or
   multi-clause questions route to **Sonnet** (`GENERATION_MODEL`); everything else
   stays on **Haiku** (`CHAT_MODEL`). It errs toward Sonnet, a false positive
   costs cents, a false negative costs answer quality.
5. Single `anthropic.messages.create` (max 500 tokens, **no streaming**, see
   below) with the assembled system prompt + history + message.
6. **Post-generation grounding validation**, runs *only* when the answer contains
   high-risk content (`detectHighRiskContent`: dollars, percentages, multipliers,
   four-digit numbers, or credential keywords). `validateAndSanitize` makes a fast
   Sonnet call asking whether every such claim traces to the candidate's data;
   that grounding set includes the **career context document**, résumé, all brain
   fields, and custom QA. If not grounded, the answer is replaced with a natural
   deflection. **Fail-safe:** any error returns the original answer rather than
   breaking the chat.
7. Log the turn (see [07](./07-chat-and-transcripts.md)).

**No token streaming** is deliberate, it conflicts with the post-generation
validation pass, which needs the whole answer before it can ground-check it.

## Per-turn tracking

Each assistant `chat_messages` row records `model_used`, `was_complex`, and
`was_validated`, so cost and routing behavior are observable. Blended cost is
roughly $0.01 per 10-turn session.

## Where the brain is also used

The same `buildCandidateSystemPrompt` powers the **sandbox** self-test
(`/api/sandbox/analyze`) so the candidate tests exactly what a recruiter would
hit. The brain assembly is also read (without building the chat prompt) by the
transcript-deliver and hardening flows for gap analysis.

## Model split (`lib/ai/models.ts`)

| Constant | Model | Use |
|---|---|---|
| `CHAT_MODEL` | `claude-haiku-4-5-20251001` | Live recruiter chat; sandbox answer generation |
| `GENERATION_MODEL` | `claude-sonnet-4-6` | All one-time generation/analysis: prompt/context generation, intake, sandbox analysis, transcript gap analysis, hardening, role recommendation, grounding validation |

IDs are imported from this file everywhere, never hardcoded. The Anthropic client
(`lib/ai/client.ts`) is a lazy server-only singleton; the key never reaches the
browser.
````


#### `docs/architecture/05-career-context-document.md`

The context_package_md lifecycle: generate, select, augment, evidence snippets.

````md
# 05, Career Context Document

A polished, single-file career narrative that becomes the top, authoritative layer
of the brain. It is the in-app, self-serve implementation of the **Candidate Asset
Production Skill** (`docs/CANDIDATE_ASSET_PRODUCTION_SKILL.md`), **Section 1 only**,
the Narrative Guide Block. The NotebookLM prompt sets (Section 2) are
deliberately excluded from the candidate flow.

## The core idea

The document is the candidate's most *synthesized* input, narrative, hook, the
one hard question, key numbers, positioning, and third-party evidence, distilled
from their résumé + career sources. Because it mirrors the prompt's own layering,
it slots in as the first block of the system prompt (above the raw résumé). As the
candidate adds more material over time, the document is **re-synthesized**, not
appended, the brain gets *sharper*, not *longer*. This is the deliberate
"deepen the synthesis loop, don't add a raw layer" decision.

## Storage

On `candidate_profiles` (all anon-excluded by the column-grant pattern):

- **`context_package_md`** (TEXT), the **single active document** the brain reads
  and the assets page downloads. Written by *either* generation-and-selection
  *or* an external upload on `/dashboard/assets`. One logical slot, two sources;
  selecting a generated angle and uploading both write here (intended).
- **`context_package_updated_at`** (TIMESTAMPTZ).
- **`career_context_drafts`** (JSONB), generation staging:
  ```ts
  CareerContextDrafts = {
    angles: { A: CareerContextAngle, B: CareerContextAngle },
    recommended: 'A' | 'B',
    selected: 'A' | 'B' | null,   // null until the candidate picks
    generated_at: string,
  }
  CareerContextAngle = {
    name, story_type, headline, target_role, location,
    narrative, hook, hard_question: { question, answer },
    key_numbers: string[], positioning,
    evidence_snippets: { quote, source }[],   // verbatim third-party quotes
    markdown,                                  // the rendered document for this angle
  }
  ```
  Types live in `lib/types/index.ts`. Only the **selected** angle reaches the
  brain; until one is picked the document is inert (no half-baked default shown to
  recruiters).

## Generation, two angles (`lib/ai/career-context.ts`)

`generateCareerContext(fullName, resumeMarkdown, sources)`:
- Runs the skill's workflow, AI Mirror → story type → **two genuinely different
  narrative angles** + a recommendation, via a forced tool call on
  `GENERATION_MODEL` (Sonnet).
- **Story types:** `career_arc`, `builder`, `problem_solver`, `leadership`,
  `skeptic_champion`, `specialist`.
- Hard grounding rules in the system prompt: never invent a number/metric/date/
  credential; the hook must be specific; narrative in third person, hard-question
  answer in first person; evidence quotes must be verbatim from sources (else
  empty).
- Each angle is rendered to markdown (`renderAngleMarkdown`) including a "What
  Others Say" section when evidence exists.

Endpoint: **`POST /api/career-context/generate`**, entitlement-gated
(`assertCandidateAiAccess`), loads résumé + active career sources, requires at
least one of them, calls the module, persists `career_context_drafts`, returns the
drafts. `runtime = nodejs`, `maxDuration = 60`.

## Selection (`selectCareerContextAngle` server action)

In `app/(candidate)/dashboard/ai/actions.ts`. Records `selected` on the drafts and
**copies the chosen angle's markdown into `context_package_md`** (+ timestamps).
Switching angles later is just another call, no regeneration. Revalidates
`/dashboard/ai` and `/dashboard/assets`.

## The augment loop, re-synthesis (`augmentCareerContextAngle`)

The "keep building" mechanism. `augmentCareerContextAngle({ fullName, base,
resumeMarkdown, sources, brainFields, customQA })`:
- Takes the **currently selected angle** as the base and folds in the candidate's
  newer authored material, the eight brain fields, refined custom Q&A, and career
  sources, plus refreshed verbatim evidence snippets.
- **Preserves the story-type and angle name** (forced from the base) so updates
  refine the chosen story rather than redirect it.
- Never invents; every claim must trace to the current document or the new
  material.

Endpoint: **`POST /api/career-context/augment`**, entitlement-gated; requires a
*selected* angle (else 400). Replaces the selected angle in `career_context_drafts`
and promotes its new markdown to `context_package_md`, so the brain picks it up on
the next chat. Revalidates `/dashboard/ai` and `/dashboard/assets`.

## How it reaches recruiters

`getCandidateBrainBySlug` loads `context_package_md` as `careerContextMarkdown` and
the selected angle's hard question is promoted into `custom_qa_pairs`.
`buildCandidateSystemPrompt` renders the `<career_context_document>` block first,
and `validateAndSanitize` includes the document in its grounding set. See
[04, The AI Brain](./04-ai-brain.md). This wiring is what makes the document
*do* anything, without it the column is just stored text.

## UI (`components/candidate/ContextDocumentPanel.tsx`)

The **Context Document** tab in AI Studio:
- **Empty state** → "Generate document" (calls `/generate`).
- **Two angle cards** side by side: recommended flagged, structured content
  (narrative, hook, hard question, key numbers, evidence), select to make active.
- **Update document** (augment), primary when an angle is selected, and
  **Start over** (full regenerate).
- Surfaces `402` (entitlement) and "add a résumé/source first" (400) gracefully;
  evidence rendering is guarded for older drafts that predate the field.

## Entitlement & billing

Everything routes through `assertCandidateAiAccess` (rollout-open today). When
billing ships, the paywall activates with no changes here. See
[03, Entitlements](./03-auth-and-entitlements.md).
````


#### `docs/architecture/06-ai-studio.md`

The candidate-facing brain management surface.

````md
# 06, AI Studio

`/dashboard/ai`, the candidate's surface for building, testing, and hardening
their brain. Page: `app/(candidate)/dashboard/ai/page.tsx` (loads profile, open
gaps, hardening sessions, active career sources) → `components/candidate/AIStudio.tsx`.

## Tabs

`AIStudio.tsx` is an accessible tab layout (`role="tab"`/`role="tabpanel"`):

| Tab | What it holds |
|---|---|
| **Build** | Prompt bot (gaps), guided-interview launcher, career-sources card, the eight career-context fields, custom answers, redirect topics |
| **Context Document** | `ContextDocumentPanel`, see [05](./05-career-context-document.md) |
| **Test** | `SandboxPanel`, self-test against the live brain |
| **Harden** | `HardenPanel`, analyze external transcripts |

Brain edits in **Build** auto-save (debounced) via `updateCandidateBrain`
(`app/(candidate)/dashboard/ai/actions.ts`) and apply to the live AI immediately,
the studio is a living system. The header has the global `ai_enabled` switch.

## Build, the manual brain fields

Eight free-text fields (each ≤5000 chars) map 1:1 to the `<context>` block:
`key_wins`, `leadership_philosophy`, `departure_reasons`, `biggest_challenge`,
`ideal_environment`, `manager_needs`, `honest_weaknesses`, `wish_questions`. Plus:
- **Custom answers** (`custom_qa_pairs`, up to 50), pinned Q/A used word-for-word,
  highest priority; the first few also become few-shot exemplars. This is the main
  unbounded "keep adding" mechanism.
- **Redirect topics** (up to 30), routed to a direct human conversation.

`updateCandidateBrain` Zod-validates all of the above and writes them in one call.

## Guided intake interview (`lib/ai/intake.ts`)

A layered, recruiter-style interview that fills the eight fields for the candidate.
All passes use `GENERATION_MODEL` (Sonnet) with forced tool output.

- **Pass 1**, `analyzeIntakePass1(docs)` reads the résumé + career sources, flags
  cross-document **inconsistencies**, and generates 8–12 recruiter questions, each
  tagged to a brain category.
- **Pass 2/3**, `generateNextPass(...)` adds targeted follow-ups *only* for vague
  answers (often Pass 3 returns none). Max 20 answers total.
- **Assembly**, `assembleBrainFromIntake(resumeMarkdown, answers, sources)`
  synthesizes first-person field content; **synthesized content only overwrites a
  field when non-empty** (never wipes what the candidate wrote).
- **Readiness**, `computeReadiness` scores four groups (Core & wins, Hard
  questions, Leadership, Depth & fit); a field counts as covered above ~50 chars.

Endpoints: `POST /api/intake/analyze` (stateless per pass) and
`POST /api/intake/assemble` (persists `intake_answers`, merges fields, writes
`brain_readiness_score`, marks `intake_completed`). UI:
`components/candidate/IntakeInterview.tsx`.

## Test, the sandbox (`lib/ai/analyze-sandbox.ts`, `lib/ai/sandbox-questions.ts`)

`SandboxPanel` lets the candidate stress-test their AI against a 20-question
library across six categories (`gap_departure`, `commitment_tenure`,
`metric_verification`, `leadership`, `adversarial`, `weakness_failure`), each
mapped to the brain fields it probes.

`POST /api/sandbox/analyze`: if no answer is supplied it first generates one with
**Haiku + the real system prompt** (exactly what a recruiter would get), then
`analyzeSandboxAnswer` (Sonnet) returns a **verdict**
(`strong`/`adequate`/`weak`/`hallucinated`), a diagnosis, a prescription, and a
**`brain_field_target`** that deep-links the candidate to the field to fix.
Results persist to `sandbox_sessions`; `pattern_signal` flags categories that are
repeatedly weak.

## Harden, external transcripts (`lib/ai/harden-transcript.ts`)

`HardenPanel` accepts a pasted or uploaded (TXT/PDF) transcript from a *real*
conversation. `POST /api/transcript/harden` runs `hardenTranscriptAnalysis`
(Sonnet): maps every question to brain coverage, flags gaps, and returns a
prioritized `hardening_plan`. **The transcript is never stored**, only the plan +
counts land in `brain_hardening_sessions` (supports re-analysis to confirm gaps
closed). Privacy is the headline design rule.

## The prompt bot & the growth loop

`PromptBot` surfaces open `transcript_gaps` (mined from real recruiter chats, see
[07](./07-chat-and-transcripts.md)) as specific expansion prompts that deep-link to
the field to strengthen; `markGapAddressed` clears them. Sandbox, hardening, and
transcript gaps all feed the same "find a gap → strengthen a field" loop, and the
readiness score reflects current state.

## Career sources (`lib/career-sources/`)

External material the candidate brings in (LinkedIn export, GitHub, Indeed,
portfolio, reviews, recommendations). `POST /api/sources` ingests a file or paste,
extracting **text only** into `career_sources.extracted_text` (never the binary),
capped at `MAX_ACTIVE_SOURCES` (10). `CareerSourcesCard` manages them;
`deleteCareerSource` removes them.

**Important:** sources feed the *intake interview*, *role recommendation*, and
*context-document generation/augment* (`getSourceDocuments` shapes them into
`{label, text}`), **not** the live chat prompt directly. Their value reaches the
brain *distilled*, through the fields and the context document, which is the same
synthesis-over-raw-volume principle behind the augment loop.

## Role recommendation & profile derivation

`recommendRoles` (`lib/ai/recommend-roles.ts`, via
`/api/profile/recommend-roles`) suggests 3–5 realistic target roles from the
résumé + sources (Sonnet, transient, not stored). `deriveProfileFromResume`
(`lib/ai/derive-profile.ts`) pre-fills empty profile fields (headline, target
role, summary bullets, location, LinkedIn) after résumé parse, best-effort and
non-destructive.
````


#### `docs/architecture/07-chat-and-transcripts.md`

Chat sessions, transcript delivery, recruiter identity, meeting requests.

````md
# 07, Chat & Transcripts

## Live chat (`app/api/chat/route.ts`)

The recruiter-facing endpoint. Open to **anonymous** callers (no Clerk session),
that is why it reads via the service-role client and enforces visibility itself.
Full flow (router, grounding validation, no-streaming rationale) is in
[04, The AI Brain](./04-ai-brain.md). Summary:

```
POST /api/chat { candidateSlug, message, sessionId?, conversationHistory? }
  → getCandidateBrainBySlug (service-role read)
  → 404 if missing / ai_enabled=false; visibility: published OR owner-preview
  → detectComplexQuestion → Haiku or Sonnet
  → buildCandidateSystemPrompt(candidate, resumeMarkdown, careerContextMarkdown)
  → answer (max 500 tokens, no streaming)
  → if detectHighRiskContent → validateAndSanitize (grounding; fail-safe)
  → log the turn → { answer, sessionId }
```

## Chat logging (`lib/ai/log-chat.ts`)

Service-role, **best-effort** (a logging failure must never break the recruiter's
reply):
- `ensureChatSession(candidateProfileId, sessionId?, viewer)`, creates or reuses a
  `chat_sessions` row. Anonymous recruiters log `viewer_clerk_user_id = null`;
  owner self-tests are marked `is_sandbox = true` so they don't pollute analytics.
- `logChatExchange({ sessionId, question, answer, modelUsed, wasComplex,
  wasValidated })`, writes the user + assistant `chat_messages`, stamping the
  per-turn tracking fields.

## Transcript delivery (`app/api/transcripts/deliver/route.ts`)

When the chat closes (or after 30 min inactivity), the client fires a
`sendBeacon` to `POST /api/transcripts/deliver`.

- **Idempotent**, guarded by `chat_sessions.transcript_sent`; the flag is set up
  front so duplicate beacons no-op.
- Emails **both sides** via Resend (`lib/email/client.ts`, templates in
  `lib/email/transcript.ts`; both server-only). The candidate email includes the
  full transcript, company name (if the recruiter was logged in), pattern insights
  at 3+ same-topic questions, and a fine-tune link; the employer email includes the
  transcript, profile link, and save-candidate + feedback CTAs.

## Transcript → brain gap loop (`lib/ai/analyze-transcript.ts`)

After delivery, the route fires gap analysis (async, best-effort, it never fails
the email):
- `analyzeTranscriptGaps({ candidate, resumeMarkdown, messages })` (Sonnet, forced
  tool output) returns up to 5 gaps, each typed `deflection` / `weak` /
  `new_topic` with a ready-to-show `suggested_prompt`, `category`, and `priority`.
- Gaps persist to `transcript_gaps`. **Pattern detection:** when a category recurs
  (3+), priority is raised to `high` and `pattern_count` reflects frequency.
- These surface in AI Studio's prompt bot (see [06](./06-ai-studio.md)). The raw
  transcript is not persisted as a record beyond the chat messages already logged.

## The growth loop

```
recruiter chats → transcript emailed → gaps mined (transcript_gaps)
   → prompt bot surfaces expansion prompts → candidate strengthens a field
   → brain improves → next recruiter gets a better answer  ↺
```

This is the retention mechanism: the brain compounds with use, and the accumulated
career intelligence is the switching cost. The sandbox and external-transcript
hardening feed the same loop from predicted and real questions respectively.
````


#### `docs/architecture/02-data-model.md`

Data-model overview incl. all brain/chat tables.

````md
# 02, Data Model

**The schema's source of truth is `supabase/migrations/`.** Never reproduce it by
hand and never edit the database manually, migrations auto-apply on PR merge via
the Supabase branching integration. This doc is a map, not the schema.

## Conventions

- **Keys.** `user_id` everywhere is the Clerk `clerk_user_id TEXT`. Clerk is auth
  only; all data lives in Supabase keyed by it.
- **RLS on by default.** Every user-scoped table enables Row Level Security and
  ships its isolation policy *in the same migration that creates it*.
- **`requesting_user_id()`** (introduced in `20260620000000_initial_schema.sql`)
  returns the authenticated Clerk id from the JWT:
  ```sql
  CREATE OR REPLACE FUNCTION requesting_user_id() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
  AS $$ SELECT auth.jwt() ->> 'sub'; $$;
  ```
- **Two isolation shapes:**
  - *Ownership* (candidate tables): `clerk_user_id = requesting_user_id()`.
  - *Membership* (employer tables): row's `employer_account_id IN (SELECT
    employer_account_id FROM employer_members WHERE clerk_user_id =
    requesting_user_id())`.
- **The anon-column-grant pattern** (the most important security detail). On
  published profiles, the anon role can read `candidate_profiles` rows where
  `is_published = TRUE`. To stop sensitive brain columns leaking, the
  `20260626000000_ai_brain.sql` migration does `REVOKE SELECT … FROM anon` then
  `GRANT SELECT (<safe columns>)`. **Because the grant is an explicit column
  list, every column added afterward is automatically unreadable by anon**,
  including all brain fields, `context_package_md`, and `career_context_drafts`.
  New sensitive columns therefore need *no* extra grant work; new *public* columns
  must be added to the grant deliberately. The chat path reads the full brain
  server-side via the service-role client, so anon restriction never affects it.

## Tables

### Identity & profile
| Table | Purpose | Key columns / notes | RLS |
|---|---|---|---|
| `users` | One row per Clerk user | `clerk_user_id` (unique), `role` (nullable until onboarding), `is_admin`, `subscription_status`, `subscription_tier`, `paddle_subscription_id` | self-access; admins read all (impersonation) |
| `candidate_profiles` | Profile **and** AI-brain columns | `slug` (unique, public), identity fields, **brain fields** (below), intake fields, career-context fields | owner (ALL) + public_read for anon when `is_published`; anon column-grant narrowed |
| `admin_role_sessions` | Which role an admin is previewing | `admin_clerk_user_id` (unique), `previewing_role` | self |

`candidate_profiles` brain-relevant columns (added across migrations):
- **Brain fields** (`20260626000000_ai_brain.sql`): `leadership_philosophy`,
  `key_wins`, `departure_reasons`, `biggest_challenge`, `ideal_environment`,
  `manager_needs`, `honest_weaknesses`, `wish_questions`, `additional_context`,
  `custom_qa_pairs` (JSONB), `redirect_topics` (TEXT[]), `ai_enabled`.
- **Intake** (`20260629000000_intake.sql`): `intake_completed`,
  `intake_pass{1,2,3}_at`, `brain_readiness_score`, `inconsistencies_found`,
  `inconsistencies_resolved` (JSONB).
- **Career context** (`20260705…`, `20260706…`): `context_package_md`,
  `context_package_updated_at`, `career_context_drafts` (JSONB). See
  [05](./05-career-context-document.md).

### AI brain inputs & logs
| Table | Purpose | Notes | RLS |
|---|---|---|---|
| `resume_documents` | Parsed résumé | `canonical_json`, **`canonical_markdown`** (the AI's résumé source), `status` (`draft`/`generating`/`ready`/`approved`), `docx_asset_id`, `pdf_asset_id`; one per profile | owner |
| `career_sources` | External career material (LinkedIn/GitHub/reviews) | `source_type`, `extracted_text` (text only, never the binary), `ingest_method`, `is_active`; feeds intake + context generation, **not** the live prompt directly | owner |
| `intake_answers` | Raw intake-interview answers | `pass_number` (1–3), `category`, `answer_source` | owner (via profile) |
| `chat_sessions` | One recruiter (or sandbox) conversation | `viewer_clerk_user_id`, `employer_account_id`, `employer_company_name`, `is_sandbox`, `transcript_sent` | candidate-read + employer-team-read; insert open (service-role writes) |
| `chat_messages` | One chat turn | `role`, `content`, `model_used`, `was_complex`, `was_validated` (`20260627…`) | via owning session |
| `sandbox_sessions` | Candidate self-test results | `verdict` (`strong`/`adequate`/`weak`/`hallucinated`), `diagnosis`, `prescription`, `brain_field_target`, `pattern_signal` | owner |
| `transcript_gaps` | Gaps mined from real recruiter chats | `gap_type` (`deflection`/`weak`/`new_topic`), `suggested_prompt`, `priority`, `pattern_count`, `is_addressed` | owner |
| `brain_hardening_sessions` | External-transcript hardening runs | `transcript_source`, `hardening_plan` (JSONB), counts; **transcript itself never stored** | owner |

### Assets
| Table | Purpose | Notes | RLS |
|---|---|---|---|
| `candidate_assets` | Recruiter-facing media | `asset_type` (`audio`/`debate_audio`/`video`/`deck`/`infographic`/`resume`/`resume_docx`/`avatar`), `storage_bucket`, `storage_path`, `is_active` | owner |

### Employer (multi-tenant)
| Table | Purpose | Notes | RLS |
|---|---|---|---|
| `employer_accounts` | One per hiring org | `company_name`, `created_by` | members only |
| `employer_members` | Users in an account | `role` (`owner`/`member`), unique (account, user) | same-account |
| `job_postings` | Job opening | scoped to `employer_account_id` | membership |
| `saved_candidates` | The pool + pipeline | `stage` (`saved`/`screening`/`interview`/`offer`/`passed`), `job_posting_id`, `notes`, unique (account, profile) | membership |
| `feedback` | Employer → candidate message | `is_read` | employer write/read + candidate read & mark-read |
| `profile_views` | View analytics | `viewer_clerk_user_id`, `employer_account_id`, `duration_seconds` | candidate-read; insert open |

## Storage buckets (`20260704000000_storage_buckets.sql`)

All **private**; access only via signed URLs. Owner-scoped by the first path
segment being the user's id.

| Bucket | Contents |
|---|---|
| `candidate-audio` | Audio overview + debate audio |
| `candidate-video` | Video overview |
| `candidate-documents` | Slide decks + ATS résumés (PDF/DOCX) |
| `candidate-images` | Infographics + avatars |

Path convention: `{clerk_user_id}/{timestamp}-{sanitized-filename}`. Storage RLS:
`(storage.foldername(name))[1] = requesting_user_id()`. See
[08](./08-assets-resume-storage.md).

## Migration history (chronological)

`initial_schema` → `add_admin_and_role_switch` → `make_user_role_nullable` →
`resume_pipeline` → `additional_context` → `ai_brain` (brain columns + chat tables
+ anon grant) → `chat_message_model_tracking` → `sandbox_sessions` → `intake` →
`transcript_gaps` → `brain_hardening` → `career_sources` → `avatar_asset_type` →
`storage_buckets` → `context_package` → `career_context_drafts`.
````


#### `docs/architecture/03-auth-and-entitlements.md`

getUserContext + the assertCandidateAiAccess entitlement seam.

````md
# 03, Auth & Entitlements

## Clerk = authentication only

Clerk verifies who the user is and issues a JWT whose `sub` claim is the
`clerk_user_id`. Everything about *what they can do* (role, ownership,
subscription) lives in Supabase. **Never trust a client-side role claim**, and
never store role in Clerk metadata.

User rows are created by the Clerk webhook (`app/api/webhooks/clerk/route.ts`,
Svix-verified): `user.created` upserts a `users` row with `role = NULL` and
`subscription_status = 'free'` (`ignoreDuplicates: true`, so re-fires never reset
role/subscription); `user.updated` syncs email; `user.deleted` deletes the row
(CASCADE cleans up all child data). Role is set later in onboarding
(`app/(auth)/onboarding/actions.ts` → `setUserRole`), which refuses to reassign an
existing role.

## `getUserContext`, the gate every server entry point uses

`lib/auth/user-context.ts`:

```ts
const { userId, supabase, role, isAdmin, user } = await getUserContext('candidate');
```

1. `auth()` → Clerk `userId`; missing → `AuthError('UNAUTHENTICATED')`.
2. Look up the `users` row with the **admin client** (this one bootstrap read
   happens before we have a role-scoped client; it filters by `clerk_user_id`,
   equivalent to what RLS would enforce).
3. No row → `AuthError('NO_USER')`; null role (not onboarded) →
   `AuthError('NO_ROLE')`.
4. **Admin preview:** if `is_admin` and the `rb-admin-preview-role` cookie is set,
   the effective role becomes the previewed one (admins can walk both dashboards).
5. If a `requiredRole` was passed and doesn't match → `AuthError('FORBIDDEN')`.
6. Returns the **request-scoped RLS client** (`getRequestClient()`) plus role and
   the user record (which carries `is_admin`, `subscription_status`,
   `subscription_tier`).

`AuthError` codes map to HTTP/error-envelope codes, see
[10, Conventions](./10-conventions-and-ops.md).

## The three Supabase clients, one purpose each

`lib/supabase/`:

| Client | File | RLS | Use it for |
|---|---|---|---|
| `getRequestClient()` | `server.ts` | **Enforced** (forwards the Clerk JWT as Bearer) | Default. Every API route, Server Action, Server Component read/write. |
| `adminClient` | `admin.ts` | **Bypassed** (service role) | Only where RLS bypass is genuinely required: the `getUserContext` bootstrap read, webhooks, the public chat path (anonymous recruiters), server-side signed-URL generation, transcript delivery. Every import carries a comment explaining why. |
| `getBrowserClient()` | `browser.ts` | Anon role | `"use client"` reads of public data (calling-card profile fields, view tracking). |

Hard rules: `SUPABASE_SERVICE_ROLE_KEY` is read **only** in `admin.ts`; never
import `admin.ts` from anything that can reach the browser bundle; treat every
admin-client use as security-review-worthy.

Why the chat path uses the admin client: recruiters are anonymous (no Clerk JWT),
and the brain spans columns the anon role can't read. `getCandidateBrainBySlug`
therefore reads server-side via the service-role client and the route enforces
visibility itself (`is_published` or owner-preview). See
[07, Chat](./07-chat-and-transcripts.md).

## Entitlements, the AI-access seam

`lib/auth/entitlements.ts` is the **single** place that decides whether a
candidate may use AI Studio, generate/augment a context document, and (eventually)
use the live chatbot.

```ts
assertCandidateAiAccess(user);   // throws EntitlementError('PAYMENT_REQUIRED') when not entitled
candidateHasAiAccess(user);      // boolean
```

Today it is **open to all candidates during rollout** (`BILLING_ENFORCED =
false`). The real check is already written, admin or
`subscription_status === 'active'`, and gated behind that flag. When candidate
subscriptions/trials ship, flipping `BILLING_ENFORCED` to `true` activates the
paywall with **no caller changes**.

This is the deliberate decoupling that let the Career Context Document feature ship
ahead of billing. The planned billing workstream ("PR 4") will: add candidate
Paddle products + trial-clock state, gate the public chat/AI Studio on entitlement,
and flip the flag. `EntitlementError` maps to HTTP **402 / `PAYMENT_REQUIRED`**.

Routes that already call the seam: `/api/career-context/generate`,
`/api/career-context/augment`, and the `selectCareerContextAngle` server action.
````


#### `docs/architecture/11-anti-spam.md`

Rate limiting on the public chat pipeline.

````md
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
| **Meeting-invitation nudge** | `buildCandidateSystemPrompt(..., meetingInvitation)` in `/api/chat` | Soft, conversion-first throttle: after a few exchanges the assistant warmly invites a live meeting, so real conversations resolve to a booking well before the hard cap. Doubles as the product's core recruiter-conversion loop. |
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

## Meeting-invitation nudge (soft, conversion-first throttle)

The hard interaction caps are the abuse backstop; the meeting nudge is the
low-friction ceiling that real recruiters actually hit first. It reframes "stop
spending tokens" as "book a meeting," which is what RoleBoost wants anyway.

- **Trigger:** `/api/chat` counts completed exchanges from the server-rebuilt
  history. Once past `NUDGE_AFTER_EXCHANGES` (3), it passes
  `meetingInvitation: 'gentle'` into `buildCandidateSystemPrompt`, which appends a
  `<meeting_invitation>` block. Owner previews (`isOwner`) are never nudged.
- **Behavior (gentle & ambient):** the assistant keeps answering every question
  fully; the block explicitly forbids withholding an answer to push a meeting.
  When it fits, and only after answering, it adds one short, warm invite to
  continue live with the candidate, at most once every couple of replies. Because
  the invite is generated in the assistant's own `<voice>`, it stays relatable on
  any model (including Haiku), never a scripted append.
- **Client surface:** the response carries `inviteMeeting: true`, which latches a
  persistent, low-key "Request time with {name}" chip by the input in
  `ChatPanel`. One tap opens the existing schedule form, prefilled. Non-interruptive;
  hidden while that form is already open, and reset by "Start a new conversation".
- **Deliberately soft:** the assistant never hard-stops or refuses to answer to
  force a booking; that would sacrifice the "interrogate it 24/7" differentiator.
  The 40/hr per-chat cap remains the only hard stop, for genuine abuse.

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
````


#### `docs/architecture/12-security.md`

Security posture incl. chat trust boundaries and anon grants.

````md
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
````

### 8.3 Career context / narrative production skill

#### `docs/CANDIDATE_ASSET_PRODUCTION_SKILL.md` (lines 16-53)

What the skill does and how it is triggered. Only Section 1 of its output (the Narrative Guide Block) enters the candidate flow as context_package_md.

````md
## What This Skill Does

This skill runs the RoleBoost candidate asset production workflow. It is designed for superadmin use -- either directly in Claude chat today, or triggered from the superadmin dashboard once that is built.

Given a candidate's resume and any available supporting context, this skill:

1. Reads and analyzes all uploaded material
2. Applies the AI Mirror -- an honest, non-biased read of what the evidence actually shows
3. Determines the candidate's story type and narrative perspective (two versions)
4. Produces a complete candidate asset package in one pass:
   - Narrative Guide Block (6 sections, matches `PERSONA_NARRATIVE_GUIDE.md` format)
   - Two personalized NotebookLM prompt sets -- one per narrative perspective, fully written and ready to copy-paste into NotebookLM. Each set contains four prompts: Deep Dive, Brief, Infographic, and Short Video.

**Output is one `.md` file per candidate.** Filename format: `[slug]-asset-package.md`

---

## How To Trigger This Skill

Paste the following prompt into a new Claude chat session to begin:

---

> I am starting a RoleBoost candidate asset production session. You are running the RoleBoost Candidate Asset Production Skill. Your job is to read everything I give you, apply the AI Mirror, determine this candidate's story, and produce their complete asset package.
>
> Before you begin, ask me for the following:
> 1. The candidate's resume (upload as PDF, Word doc, or paste as text)
> 2. Any company URLs from their work history (paste as a list -- I will provide what I have)
> 3. Any additional context documents (interview notes, career context form, job target, anything else available)
>
> Tell me what you received, confirm you are ready, and wait for me to say go.

---

Claude will acknowledge, list what it received, and wait. When you say go, it runs the full workflow below.

---

````


#### `docs/CANDIDATE_ASSET_PRODUCTION_SKILL.md` (lines 110-242)

Story types, the two narrative perspectives, and the Section 1 Narrative Guide Block definition (this is the document format the brain reads), plus the Section 2 boundary (excluded from the candidate flow).

````md
### Step 3 -- Determine Story Type and Two Narrative Perspectives

Based on the AI Mirror read, Claude selects the candidate's primary story type from the list below. It then defines two distinct narrative perspectives -- not two tones of the same story, but two genuinely different framings that a candidate could choose between.

**Story types:**

| Type | When to use | Do not use when |
|---|---|---|
| The Career Arc | Strong linear progression with measurable results at each stage | The trajectory has a meaningful break, pivot, or gap |
| The Builder | Has built operations, teams, or systems from scratch multiple times | The candidate has primarily maintained or improved existing operations |
| The Problem Solver | Pattern of fixing broken things and turning around underperforming situations | The situations were not broken -- they were scaling or already performing |
| The Leadership Story | Senior candidate where results and people development both need to be present and balanced | The people story or the results story is thin -- both threads must exist |
| The Skeptic and the Champion | Non-linear path, gap, pivot, layoff, or any element that needs contextualizing and reframing | The path is linear and the pivot was successful with a full new track record -- use The Reinventor instead |
| The Specialist | Deep domain expertise in a specific niche -- breadth is not the story, depth is | The candidate has operated across multiple industries or functions -- breadth is part of the value |
| The Promoter | Career measured primarily in commercial terms -- quota, pipeline, revenue, accounts, market share | The candidate's results are operational or functional rather than revenue-driven |
| The Reinventor | Deliberate, completed industry or function pivot with a real track record now built in the new lane | The pivot is recent, incomplete, or the new track record is thin -- use Skeptic and Champion instead |
| The Culture Builder | Most compelling proof is human -- teams built and retained, cultures shaped, leadership pipelines developed, engagement moved | Operational KPIs are the primary proof -- use Leadership Story instead |
| The Steady Hand | Sustained, consistent, high-stakes performance over a long period at scale -- no drama, no transformation, just reliable excellence | The candidate's value is transformation or change -- use Builder or Problem Solver instead |

**Story type definitions -- new types added in v1.4:**

**The Promoter:** The candidate's career is measured in revenue terms. Quota attainment, pipeline generated, accounts closed, revenue retained, or market share grown are the primary proof points. Every role has a number and that number is commercial. The pitch is not what they built or fixed -- it is what they sold, grew, or protected. Common profiles: sales leaders, business development directors, account executives, revenue operations.

**The Reinventor:** The candidate made a deliberate, voluntary pivot from one industry or function to another and has now built a real track record in the new lane. The pivot is complete, not in progress. Results exist on both sides. The story is momentum, not explanation -- "I chose this direction and here is what I built." This is an offensive framing, not a defensive one. Do not use Skeptic and Champion when the new chapter is already strong.

**The Culture Builder:** The candidate's most compelling proof is human. Teams they built and retained, cultures they shaped, leadership development pipelines, retention records, and engagement scores are the KPIs. Operational results exist but are downstream of the people story. The pitch is "I built the kind of organization where performance is a natural outcome." Common profiles: HR leaders, Chief People Officers, People Ops directors, some COOs and General Managers whose legacy is organizational.

**The Steady Hand:** The candidate's story is sustained, consistent, high-stakes performance over a long period with no dramatic transformation. They have run complex operations reliably at scale and the proof is longevity and consistency. In industries where reliability and compliance track records matter more than innovation, this is the most credible pitch available. Common profiles: long-tenure operations managers, healthcare operations leaders, logistics directors at established carriers, government contractors.

Claude states:
- Which story type it selected and why (2-3 sentences)
- Narrative Perspective A -- what this framing leads with and why
- Narrative Perspective B -- what this framing leads with and why
- Which perspective it recommends and why

### Step 4 -- Produce the Candidate Asset Package

Claude produces the full output as a single `.md` document with two sections.

---

#### SECTION 1 -- NARRATIVE GUIDE BLOCK

Follows the exact format used in `PERSONA_NARRATIVE_GUIDE.md`. Six subsections:

**1. Identity Snapshot**
Name, slug (firstname-lastname, lowercase, hyphenated), public URL (roleboost.app/c/[slug]), location, target role, headline, avatar color (assign from RoleBoost palette below), initials.

RoleBoost avatar color palette:

| Name | Hex | Primary feel |
|---|---|---|
| Teal | #0F6E56 | Calm, trusted, service-oriented |
| Coral | #993C1D | Grounded, direct, operations-worn |
| Amber | #B45309 | Warm, credentialed, healthcare-adjacent |
| Blue | #185FA5 | Confident, tech, analytical |
| Purple | #534AB7 | Strategic, executive, visionary |
| Forest Green | #1A5C38 | Experienced, floor-level, built things |
| Warm Rose | #A0394A | People-first, empathetic, culture-oriented |
| Slate Blue | #2C4A7C | Precise, data-driven, senior tech |
| Deep Navy | #1E3A5F | Authoritative, executive, boardroom |
| Charcoal | #2D2D2D | No-nonsense, industrial, heavy ops |
| Crimson | #8B1A2B | Commercial, sales-driven, results-hungry |
| Sienna | #7D4E2D | Trades, skilled labor, hands-on craft |
| Sage | #4A7C59 | Healthcare-adjacent, clinical, compliance |
| Steel Blue | #3A5F7D | Engineering, logistics, infrastructure |
| Plum | #6B3A6B | Creative, marketing, brand-oriented |
| Warm Taupe | #7A6A58 | Versatile, neutral authority, cross-industry |

**Color selection -- two-axis pairing guide:**

Claude selects the avatar color using two axes: the candidate's industry or function (from their target role) and their dominant tone (from the AI Mirror Tier 1 read). Find the intersection in the table below.

| | Authoritative and proven | Energetic and growth-oriented | Warm and people-first | Precise and data-driven |
|---|---|---|---|---|
| **Operations / Warehouse / Fulfillment** | Charcoal | Coral | Forest Green | Steel Blue |
| **Trades / Skilled Labor** | Sienna | Coral | Forest Green | Charcoal |
| **Healthcare / Clinical** | Sage | Amber | Warm Rose | Slate Blue |
| **Technology / SaaS** | Slate Blue | Blue | Teal | Steel Blue |
| **Executive / C-Suite** | Deep Navy | Purple | Warm Rose | Slate Blue |
| **Sales / Commercial / BD** | Crimson | Coral | Teal | Blue |
| **People / HR / Culture** | Deep Navy | Teal | Warm Rose | Sage |
| **Creative / Marketing / Brand** | Plum | Coral | Warm Rose | Blue |
| **Finance / Accounting** | Deep Navy | Steel Blue | Slate Blue | Charcoal |
| **Engineering / Infrastructure** | Steel Blue | Blue | Slate Blue | Charcoal |
| **Consulting / Strategy** | Deep Navy | Purple | Warm Taupe | Slate Blue |
| **Logistics / Supply Chain** | Charcoal | Steel Blue | Forest Green | Slate Blue |

**Tone definitions for the Mirror read:**
- Authoritative and proven: long track record, sustained performance, credentials-forward, seniority is the story
- Energetic and growth-oriented: trajectory is upward, results compound across roles, momentum is the story
- Warm and people-first: team development, culture, empathy, and human outcomes are the proof points
- Precise and data-driven: quantified results dominate, systems and accuracy are the differentiators

**If the tone is a blend:** pick the axis that the candidate's strongest proof points support, not the one their job title implies. A 20-year ops veteran whose biggest results are all safety and team culture reads warm and people-first, not authoritative and proven, even if the title is Director.

**Color rationale required:** Claude must include a one-sentence color rationale in the Identity Snapshot output. Example: "Forest Green -- operations background, tone reads warm and people-first based on safety culture and team development proof points." This lets the superadmin sanity-check the selection on every candidate run.

**Background selection required:** Based on the candidate's avatar color, Claude selects the infographic background tier from the table below and states the selection in the Identity Snapshot alongside the color rationale.

| Background tier | Avatar colors |
|---|---|
| Light (off-white or warm white, professional) | Deep Navy, Slate Blue, Charcoal, Steel Blue, Forest Green, Plum |
| Dark (deep, professional) | Amber, Coral, Warm Rose, Crimson, Sienna, Warm Taupe |
| Neutral (mid-gray or deep cool gray) | Teal, Blue, Purple, Sage |

Example Identity Snapshot output: "Slate Blue -- Technology/SaaS lane, tone reads precise and data-driven. Infographic background: Light."

**2. The Narrative**
2-3 sentences. This is the human story, not a resume summary. It must answer: what does this person's career actually show, what can their resume not say about them, and what does RoleBoost specifically do for this person that no other tool could. Write from the AI Mirror read -- grounded in evidence, free of inflation.

**3. The Hook**
One line only. The single most credible and compelling fact in the file. The thing that makes a recruiter stop. Must be specific -- a number, a moment, a result. No generalities.

**4. The Hard Question**
The one question every recruiter will ask and the AI chatbot must handle perfectly. State the question, then write a tight, specific answer (5-8 sentences). The answer must use only evidence from the file -- no claims without support. The answer should be direct, confident, and end with a pivot to what the candidate brings.

**5. Key Numbers**
A bulleted list of 5-8 metrics and specifics that must appear in every asset -- audio, infographic, chatbot, everything. These are the facts that cannot be wrong or missing. Include: career span, scale metrics (team size, revenue, volume, portfolio size), the most impressive quantified result, any certifications or credentials worth noting, and anything that directly addresses the likely hard question.

**6. NotebookLM Prompt Mapping**
A table showing which prompts from the RoleBoost NotebookLM Elite Prompt Library fit this candidate, with a one-line rationale and a tone note for each. Separate rows for Deep Dive, Brief, Infographic, and Short Video.

---

#### SECTION 2 -- PERSONALIZED NOTEBOOKLM PROMPTS

Two complete prompt sets -- one for Narrative Perspective A, one for Narrative Perspective B. Each set contains four prompts: one Deep Dive, one Brief, one Infographic, and one Short Video. All prompts are fully written out with the candidate's name, specialty, and relevant specifics already filled in. They are ready to copy and paste directly into NotebookLM with no editing required.

Each prompt follows the format spec for its type. Audio prompts (Deep Dive and Brief) use this structure:

---

````

### 8.4 Vision document (brain-relevant sections)

#### `docs/VISION.md` (lines 48-77)

The AI Mirror, the product's framing for context extraction.

````md
## The AI Mirror

There is a gap that nobody in hiring technology has addressed -- and it sits at the very beginning of the candidate's journey.

The data is stark. An [Express Employment Professionals / Harris Poll study from February 2026](https://www.prnewswire.com/news-releases/86-of-us-hiring-managers-say-ai-makes-it-too-easy-to-exaggerate-skills-on-resumes-302682962.html) found that 80% of hiring managers say candidates' resumes don't match their real-world skills at least sometimes -- with 34% saying it happens all the time or often. A separate finding from the same period: only 22% of job seekers admit to listing skills they don't actually have. The gap between those two numbers tells the whole story. Candidates are inflating more than they realize, or more than they will admit. Recruiters are catching it. Trust is collapsing on both sides.

The industry has named this the ["resume illusion"](https://blog.theinterviewguys.com/why-ai-resumes-are-backfiring-in-2026/) -- AI-polished documents that pass ATS screening but fall apart the moment a real conversation begins. Recruiters are responding by conducting more interviews to verify authenticity, leaning harder on behavioral questions, and becoming more skeptical of every document that crosses their desk.

Every tool in the market is making this worse. AI resume builders help candidates optimize, polish, and keyword-match -- which produces more look-alike documents with less signal and more risk of inflation. The candidate who uses these tools gains a short-term ATS advantage and a long-term credibility problem.

RoleBoost goes the opposite direction.

Most candidates have a meaningful disconnect between how they perceive their own career and what their documented experience actually shows. The story they tell in interviews is often bigger, more polished, or differently framed than what appears on paper. Sometimes it is the opposite: a candidate undersells because their resume was never built to reflect the full scope of what they actually did.

RoleBoost uses AI to create a non-biased mirror.

When a candidate uploads their resume and career context, the platform reads what is actually there -- without ego, without the narrative the candidate has been telling themselves for years, without the inflation of a sales pitch or the deflation of imposter syndrome. It makes a clear, evidence-based determination of who this person is based on what they have documented.

That honest read does three things:

First, it produces a narrative that is credible. Not inflated. Not undersold. Grounded in what the evidence supports. In a market where 80% of hiring managers expect resumes to misrepresent candidates, a grounded AI read is a competitive advantage, not a limitation.

Second, it gives the candidate something they rarely get: an objective reflection of how their career actually reads to someone who does not know them. Most candidates have never seen themselves from that angle. It is often the most clarifying moment in the process -- and it is the starting point for building a story that holds up under scrutiny.

Third, it trains the AI chatbot on the same honest read. So when a recruiter asks the chatbot anything -- at any hour, before any call -- they get a consistent, grounded answer in the candidate's voice that matches what the evidence supports. Not the inflated pitch. Not the thin resume. The real person.

This is not a feature. It is the foundation of trust that makes the entire platform work -- for candidates, for recruiters, and for the employers who need to make real hiring decisions. In a market drowning in AI-generated noise, the honest candidate is the differentiated one. RoleBoost makes that possible.

---

````


#### `docs/VISION.md` (lines 125-172)

The AI Chatbot, the Transcript Loop, Resume Intelligence, and the Fine-Tuning Interface.

````md
### The AI Chatbot -- The Game Changer

Every candidate gets a personal career AI trained on their specific career data. Recruiters can ask it anything directly from the modal:

- "How did you scale operations 3X in 90 days?"
- "Why did you leave your last role?"
- "What is your leadership style with underperforming team members?"
- "Walk me through the 20-month gap on your resume."
- "This role requires a degree -- walk me through your experience instead."

The AI answers instantly -- in the candidate's voice, from their actual career data -- 24 hours a day, 7 days a week. Before the recruiter ever schedules a screening call.

The candidate never has to be defensive again. The hard questions are handled before the phone ever rings.

### The Transcript Loop -- The First In Hiring History

Every AI conversation is logged and delivered to both sides by email immediately after.

**The recruiter receives:**
A full transcript of every question they asked and every answer the AI gave -- with a direct link to save the candidate, send feedback, or schedule a call.

**The candidate receives:**
A full transcript of every question the recruiter asked -- with pattern insights showing which questions come up most frequently and prompts to refine their AI answers.

This closes a loop that has never existed before in hiring. Candidates finally know exactly what recruiters are curious about, how their AI is representing them, and what they need to improve.

### Resume Intelligence -- Arming the AI Before the First Question

When a candidate uploads their resume, the platform analyzes it through the lens of what recruiters and ATS systems actually flag -- employment gaps, career pivots, layoffs, missing degrees, short tenures, skills without evidence, missing metrics.

The output is not a score. It is a prioritized coaching list:

*"Recruiters will ask about the 20-month gap in your timeline. Here is what your AI needs to say before they do."*

Every recommendation links directly to the context field that feeds the chatbot. The candidate fills it in once. The AI handles it forever. The completion bar tracks how well-armed the chatbot is before the profile goes live.

### The Fine-Tuning Interface

Candidates log into their dashboard and see:

- Which questions recruiters asked most this week
- How their AI answered each one
- Options to refine specific answers
- Privacy controls -- which topics the AI discusses and which it redirects to a direct conversation
- A live testing interface to preview AI responses before going live

The platform gets smarter the longer they use it. Every recruiter interaction improves the next one.

````


---

## 9. PRD.md: AI brain and chat sections

The PRD (`docs/PRD.md`) predates parts of the build; where it conflicts with the architecture docs or code, the repo is the source of truth (e.g. the "modal" became the chat-first calling card at `/c/[slug]`).

#### `docs/PRD.md` (lines 170-256)

Section 3.3 AI Tab (Career AI management, fine-tuning UI) and 3.4 Transcripts Tab.

````md
### 3.3 AI Tab -- Career AI Management

The core candidate AI management interface. This is where candidates arm their chatbot.

**Resume Intelligence Panel (top of AI tab):**

Shown after resume upload. Analyzes the resume for what recruiters and ATS systems will flag and returns targeted context recommendations. See Section 8A for full spec.

- Displays flagged items ordered by severity (high / medium / low)
- Each flag shows: what a recruiter will notice, what to add, and a direct link to the relevant context field
- Completion bar tracks how many flags have been addressed
- Re-analyze available when target role changes or resume is updated

**Context form -- Career Intelligence:**

Guided by Resume Intelligence recommendations. Fields listed below. All optional except resume text and key wins.

- Resume text (required -- paste or upload)
- Top 5 career wins with specific numbers (required)
- Target role and target company type
- Leadership philosophy
- How you handle an underperforming team member
- Ideal team and work environment
- What you need from a manager to do your best work
- Why you left each of your last 3 roles
- Biggest professional challenge and what you did about it
- What you are not good at -- honest answer
- Questions you wish recruiters would ask you
- What defines your career in one sentence

**Custom answers:**
- List of question-answer pairs the candidate has refined based on recruiter transcript patterns
- Add, edit, and delete custom answers
- Custom answers are injected into the system prompt with highest priority

**Privacy controls:**
- Toggle: AI chat enabled / disabled for this profile
- Topics to redirect to direct conversation (add/remove list)
- Example redirects: salary expectations, references, availability date

**Testing interface:**
- "Test your AI" sandbox
- Candidate asks their own AI questions
- Sees exactly how it responds before going live
- Preview mode label: "This is how your AI responds to recruiters"

**Pattern insights (shown after first recruiter conversations):**
- Most asked questions this week
- Questions your AI redirected
- Suggestions for new custom answers based on patterns

**Acceptance criteria:**
- [ ] Resume Intelligence panel visible after resume upload
- [ ] Flags displayed ordered by severity
- [ ] Each flag CTA links directly to the relevant context field
- [ ] Completion bar updates as context fields are filled in
- [ ] All context fields saved to `candidate_profiles`
- [ ] Custom QA pairs stored as JSONB in `custom_qa_pairs`
- [ ] Privacy toggle updates `ai_enabled`
- [ ] Redirect topics stored in `redirect_topics` array
- [ ] Testing interface calls the same chat endpoint as recruiter chat
- [ ] Pattern insights shown after minimum 1 completed session
- [ ] All changes reflected immediately in AI responses

### 3.4 Transcripts Tab

Full history of all recruiter AI conversations.

**List view:**
- Company name (if employer logged in) or "Anonymous recruiter"
- Date and time
- Number of questions asked
- Duration
- Link to full transcript

**Full transcript view:**
- Every question asked and every AI answer
- Timestamp per message
- Link to fine-tune a specific answer

**Acceptance criteria:**
- [ ] All chat sessions shown reverse chronological
- [ ] Company name shown when employer was logged in
- [ ] Anonymous shown for unauthenticated viewers
- [ ] Full transcript readable inline
- [ ] Direct link from each question to AI fine-tuning interface

````


#### `docs/PRD.md` (lines 327-389)

Sections 4.5-4.7: the Chat Tab (recruiter-facing career AI), employer actions, view and chat tracking.

````md
### 4.5 Chat Tab -- Career AI

The AI chat interface embedded in the modal.

**Interface:**
- "Ask [Name]'s career AI anything" header
- Message input field
- Send button
- Conversation history in chat bubbles
- "Powered by RoleBoost AI" footer label
- Disclaimer: "This AI represents [Name]'s career history and may not reflect all details"

**Behavior:**
- Chat session created on first message
- All messages logged to `chat_messages`
- System prompt built from candidate's career data and custom QA pairs
- Claude Haiku generates all responses (fast, cheap, conversational)
- Session ends on modal close or 30 minutes of inactivity
- Transcript delivered by email to both sides on session end

**If AI disabled by candidate:**
- Chat tab hidden entirely

**Acceptance criteria:**
- [ ] Chat interface loads when Chat tab clicked
- [ ] Messages send and receive correctly
- [ ] Conversation history persists within session
- [ ] Session logged to `chat_sessions`
- [ ] All messages logged to `chat_messages`
- [ ] Transcript email sent to candidate after session ends
- [ ] Transcript email sent to logged-in employer after session ends
- [ ] Tab hidden if candidate has disabled AI
- [ ] Fully keyboard navigable
- [ ] Screen reader accessible

### 4.6 Employer Actions

Shown when employer is logged in:
- Save button -- saves to pool, changes to Saved with filled icon
- Connect button -- opens feedback compose
- Status dropdown -- assign stage (shown if already saved)
- Share button -- copies public URL

Unauthenticated viewers see Save and Connect -- clicking prompts sign up first.

### 4.7 View and Chat Tracking

Every modal open logs a view in `profile_views`.
Every chat session logs to `chat_sessions` with `employer_account_id` if logged in.
Duration tracked on modal close.

**Acceptance criteria:**
- [ ] View logged on every modal open
- [ ] Duration tracked on close
- [ ] Chat session created on first message
- [ ] Session closed and transcript triggered on modal close
- [ ] Fully keyboard navigable
- [ ] Focus trapped while open
- [ ] ESC closes modal
- [ ] WCAG 2.1 AA compliant

---

````


#### `docs/PRD.md` (lines 476-529)

Section 6: Email Delivery, the transcript system (session lifecycle, both emails).

````md
## 6. Email Delivery -- Transcript System

### 6.1 Chat Session Lifecycle

1. Recruiter opens modal and sends first message -- `chat_sessions` row created
2. Messages logged in real time to `chat_messages`
3. Session ends when modal closes OR 30 minutes of inactivity
4. `POST /api/transcripts/deliver` called
5. Transcript built from all `chat_messages` in session
6. Email sent to candidate via Resend
7. Email sent to employer if logged in via Resend
8. `chat_sessions.transcript_sent` set to true

### 6.2 Candidate Transcript Email

**Subject:** A recruiter just chatted with your RoleBoost AI

**Body:**
- Company name (or "An anonymous recruiter") viewed your profile
- Date and time, number of questions asked
- Full conversation transcript
- Pattern insight if same question asked 3+ times this week
- CTA: Fine-tune your AI
- CTA: View full analytics

### 6.3 Employer Transcript Email

**Subject:** Your RoleBoost conversation with [Candidate Name]

**Body:**
- Summary -- N questions asked, duration
- Full conversation transcript
- CTA: View full profile
- CTA: Save candidate
- CTA: Send feedback

### 6.4 Feedback Notification Email

**Subject:** You have new feedback from [Company Name] on RoleBoost

**Body:**
- Company name and message preview
- CTA: Read full feedback

**Acceptance criteria:**
- [ ] Transcript email sent to candidate after every session
- [ ] Transcript email sent to logged-in employer after every session
- [ ] Feedback email sent to candidate on every feedback submission
- [ ] All emails from `transcripts@roleboost.app`
- [ ] Email templates mobile responsive
- [ ] Unsubscribe link included per CAN-SPAM

---

````


#### `docs/PRD.md` (lines 530-603)

Section 7: AI Chatbot System (system prompt construction, chat API, fine-tuning data model, privacy controls).

````md
## 7. AI Chatbot System

### 7.1 System Prompt Construction

Built from `candidate_profiles` fields:

```
You are the career AI for [full_name]. You represent them professionally to recruiters
and hiring managers. Answer only from the career information provided below. If asked
something outside this data, redirect to direct conversation.

Never invent, embellish, or extrapolate beyond what is provided. If you do not know
the answer from the provided data, say so honestly and suggest the recruiter connect
directly.

CAREER INFORMATION:
[resume_text]

CAREER CONTEXT:
Target Role: [target_role]
Leadership Philosophy: [leadership_philosophy]
Key Wins: [key_wins]
Departure Reasons: [departure_reasons]
Biggest Challenge: [biggest_challenge]
Ideal Environment: [ideal_environment]
Manager Needs: [manager_needs]
Honest Weaknesses: [honest_weaknesses]
Wish Questions: [wish_questions]

CUSTOM ANSWERS (candidate-refined, highest priority):
[custom_qa_pairs formatted as Q: / A: pairs]

TOPICS TO REDIRECT:
[redirect_topics -- respond: "I would recommend connecting directly with [name]
to discuss this. You can reach them via the Connect button on their profile."]

Keep responses concise, warm, and grounded. No corporate speak.
Let the career data speak for itself.
```

### 7.2 Chat API

`POST /api/chat`

Request: `{ candidateSlug, message, sessionId, conversationHistory }`
Response: `{ answer, sessionId }`

Model: `claude-haiku-4-5-20251001` -- fast, cheap, conversational. Max tokens 500.

### 7.3 Fine-Tuning Data Model

`custom_qa_pairs` stored as JSONB array in `candidate_profiles`:

```json
[
  {
    "question": "Why did you leave Bedgear?",
    "answer": "The role was a startup build that I completed successfully. I established
    the systems, hired and trained the team, and handed off a running operation. I am most
    energized by building from zero and that chapter was complete."
  }
]
```

Custom answers injected into system prompt above base career data -- they take priority.

### 7.4 Privacy Controls

`redirect_topics` stored as `TEXT[]` in `candidate_profiles`.

`ai_enabled` BOOLEAN -- when false, Chat tab hidden entirely from modal.

---

````


#### `docs/PRD.md` (lines 604-639)

Section 8: Candidate Context Form, the deep career questions feeding the brain.

````md
## 8. Candidate Context Form -- Deep Career Questions

The intake form that trains the AI. Shown after initial onboarding. Guided by Resume Intelligence recommendations so candidates know which fields matter most for their specific resume.

**Section 1 -- Career highlights:**
- Paste your full resume or upload it (required)
- Top 5 career wins with specific numbers (required)
- Target role and target company type (required)

**Section 2 -- Leadership and work style:**
- Describe your leadership philosophy in your own words
- How do you handle an underperforming team member?
- What does your ideal team look like?
- What do you need from a manager to do your best work?

**Section 3 -- Honest answers recruiters appreciate:**
- Why did you leave each of your last 3 roles?
- What is your biggest professional failure and what did you learn?
- What are you not good at -- be honest?
- What question do you wish recruiters would ask you?

**Section 4 -- Your story:**
- What defines your career in one sentence?
- What gets you out of bed in the morning professionally?
- Where do you want to be in 5 years?

**Acceptance criteria:**
- [ ] All fields optional except resume text and key wins
- [ ] Auto-saves on blur
- [ ] Preview AI responses immediately after saving each section
- [ ] Progress indicator showing completion percentage
- [ ] Completion nudges shown -- "Your AI gives better answers with leadership context"
- [ ] Resume Intelligence panel visible above form after resume upload

---

````


#### `docs/PRD.md` (lines 640-841)

Section 8A: Resume Intelligence, AI-powered context recommendations (analysis prompt, data model, triggers, cost).

````md
## 8A. Resume Intelligence -- AI-Powered Context Recommendations

### 8A.1 Overview

Resume Intelligence is the layer between resume upload and the context form. When a candidate uploads or pastes their resume, Claude Sonnet analyzes it through the lens of what recruiters and ATS systems flag -- gaps, short tenures, career pivots, layoffs, missing degrees, title mismatches, skills without evidence, missing metrics -- and returns a targeted set of context-building recommendations.

The output is not a resume score. It is a prioritized list of questions the candidate's AI chatbot needs to be able to answer, derived directly from what is in the resume.

The framing to the candidate:

**"Based on your resume, here are the questions recruiters are likely to ask. Let's make sure your AI has the answers before they do."**

This is what empowers the candidate's voice to be heard before easy or automatic elimination by algorithm. Every context field filled in based on a Resume Intelligence recommendation is one fewer time a candidate has to answer that question defensively on a screening call.

### 8A.2 How It Works

**Trigger:** Candidate uploads or pastes resume text for the first time, or re-uploads an updated resume.

**Process:**
1. Resume text extracted from uploaded PDF or taken from paste field
2. `POST /api/resume-intelligence` with resume text and target role
3. Claude Sonnet analyzes resume against the recruiter and ATS flag rubric (see 8A.4)
4. Returns structured JSON containing flagged items and recommended context fields
5. Recommendations displayed in AI tab as prioritized list
6. Each recommendation links directly to the relevant context field
7. Completed recommendations marked with checkmark as candidate fills in context
8. Recommendations persist and update when candidate uploads a new resume

**API endpoint:** `POST /api/resume-intelligence`

**Request:**
```typescript
{
  resumeText: string,
  targetRole: string,
  candidateProfileId: string
}
```

**Response:**
```typescript
{
  flags: ResumeFlag[],
  completionScore: number,
  generatedAt: string
}

type ResumeFlag = {
  id: string,
  category: FlagCategory,
  severity: 'high' | 'medium' | 'low',
  title: string,
  explanation: string,
  recommendation: string,
  contextField: string,
  isAddressed: boolean
}

type FlagCategory =
  | 'employment_gap'
  | 'career_pivot'
  | 'layoff_or_rif'
  | 'no_degree'
  | 'short_tenure'
  | 'title_mismatch'
  | 'skills_without_evidence'
  | 'missing_metrics'
  | 'departure_reason'
  | 'overqualification'
  | 'underqualification'
  | 'returning_to_workforce'
```

### 8A.3 The Analysis Prompt

Claude Sonnet receives the following system prompt:

```
You are a senior recruiter and ATS specialist reviewing a candidate's resume. Your job
is to identify the specific things that will get flagged by ATS systems and human
recruiters during the screening process -- not to critique the candidate, but to help
them prepare their AI chatbot to answer these questions confidently before a recruiter
ever asks.

Analyze the resume against the following categories. For each flag identified, return
a structured object with: the category, severity, a plain-language title, an explanation
of what a recruiter or ATS will notice, a specific recommendation for what context to
add, and which context field that recommendation belongs in.

FLAG CATEGORIES:

employment_gap -- Any gap of 3+ months between roles. Severity: high if 12+ months,
medium if 6-12 months, low if 3-6 months. Context field: departure_reasons.

career_pivot -- Significant change in industry, function, or level unexplained by the
resume. Severity: high if unexplained and recent. Context fields: leadership_philosophy,
biggest_challenge.

layoff_or_rif -- Indication of reduction in force, company closure, or involuntary
separation. Severity: high (asked in first 60 seconds of every screening call).
Context field: departure_reasons.

no_degree -- Absence of degree where target role typically requires one.
Severity: high if degree commonly required, medium otherwise. Context field: key_wins.

short_tenure -- Any role under 18 months, especially if pattern of multiple.
Severity: medium to high. Context field: departure_reasons.

title_mismatch -- Gap between most recent title and target role -- significant step up
or step down. Severity: medium. Context fields: key_wins, leadership_philosophy.

skills_without_evidence -- Skills listed not supported by specific examples or outcomes.
Severity: medium. Context fields: key_wins, biggest_challenge.

missing_metrics -- Work experience describes responsibilities without quantified outcomes
in roles where numbers are expected. Severity: medium. Context field: key_wins.

departure_reason -- Role where departure reason is not obvious and likely to be asked.
Severity: medium. Context field: departure_reasons.

overqualification -- Candidate appears significantly more experienced than target role
requires. Severity: low to medium. Context fields: ideal_environment, manager_needs.

returning_to_workforce -- Out of workforce 12+ months, re-entering.
Severity: high. Context field: departure_reasons.

RULES:
- Return only flags genuinely present. Do not invent flags.
- Maximum 6 flags. Prioritize by severity and recruiter impact.
- High severity: recruiter asks in first 60 seconds of screening call.
- Medium severity: recruiter likely asks at some point.
- Low severity: ATS may flag but recruiter may not always ask.
- Keep explanations plain and direct. No hedging.
- Return valid JSON only. No preamble, no markdown fences.
```

### 8A.4 UI -- Resume Intelligence Panel

**Location:** AI tab, above the context form.

**States:**
- Not analyzed (no resume): muted panel with CTA to upload resume
- Analyzing: skeleton loader, "Analyzing your resume..."
- Results: prioritized flag cards with completion bar
- All addressed: green completion state

**Each flag card:**
- Severity dot (red = high, amber = medium, gray = low)
- Title
- Explanation (what a recruiter will notice)
- Recommendation (what to add)
- "Add context" CTA linking directly to the relevant context field
- Checkmark when context field is filled in (50+ characters)

**Completion bar:** "X of Y recruiter questions covered" -- fills as candidate addresses flags.

### 8A.5 Data Model Additions

```sql
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS resume_intelligence_flags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resume_intelligence_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_intelligence_run_at TIMESTAMPTZ;
```

A flag is considered addressed when its linked `contextField` in `candidate_profiles` is non-null and contains more than 50 characters. Score recalculates on every context field save.

### 8A.6 Trigger Points

- First resume upload: runs automatically
- Resume replacement: runs automatically, replaces prior flags
- Manual re-run: available from AI tab when target role changes

### 8A.7 Model and Cost

Model: `claude-sonnet-4-6` -- one-time generation per resume, not real-time chat.
Estimated cost: ~$0.02 per analysis (1,500 tokens input + 800 tokens output at Sonnet pricing).

### 8A.8 Acceptance Criteria

- [ ] Resume Intelligence panel visible in AI tab after resume upload
- [ ] Panel shows loading state during Claude API call
- [ ] Flags displayed ordered by severity
- [ ] Each flag card shows title, explanation, recommendation, and CTA
- [ ] CTA links to relevant context field and scrolls to it
- [ ] Completion bar updates as context fields are filled in
- [ ] Flags marked addressed when linked field has 50+ characters
- [ ] Panel shows completion state when all flags addressed
- [ ] Re-analysis available when target role changes
- [ ] New resume upload triggers automatic re-analysis
- [ ] Results stored in `candidate_profiles.resume_intelligence_flags`
- [ ] Score stored in `candidate_profiles.resume_intelligence_score`
- [ ] All UI meets WCAG 2.1 AA

### 8A.9 Phase and Priority

**Phase 3** -- builds on top of the context form and Claude API integration.
Build after the base context form is live and chat endpoint is working.
This is an enhancement layer, not a prerequisite.

---

````


#### `docs/PRD.md` (lines 842-864)

Section 9 (candidate tiers): where the chatbot sits in the pricing gates.

````md
## 9. Pricing and Feature Gates

### Candidate Tiers

Pricing TBD. Candidates generate real API costs at two points:
- Resume Intelligence (Claude Sonnet): approximately $0.02 per resume upload/re-analysis
- AI chatbot (Claude Haiku): approximately $0.0008 per recruiter chat session

The supply-side economics favor keeping candidates free or near-free to maximize profile volume and employer-side value. Final structure will be determined once usage patterns are understood from Fiverr validation.

| Feature | Free | Pro (TBD) |
|---|---|---|
| Full profile and all media assets | Yes | Yes |
| Shareable link, QR code, badge | Yes | Yes |
| Resume Intelligence | Yes | Yes |
| Basic AI chatbot | Yes | Yes |
| Transcript delivery by email | Yes | Yes |
| Basic fine-tuning -- edit custom answers | Yes | Yes |
| Advanced conversation analytics | No | Yes |
| Pattern recognition -- most asked questions | No | Yes |
| Custom chatbot personality settings | No | Yes |
| Priority profile placement | No | Yes |

````


#### `docs/PRD.md` (lines 943-985)

Section 12 schema excerpt: candidate_profiles as originally specced (incl. custom_qa_pairs).

````md
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
  -- Resume Intelligence fields
  resume_intelligence_flags JSONB DEFAULT '[]',
  resume_intelligence_score INTEGER DEFAULT 0,
  resume_intelligence_run_at TIMESTAMPTZ,
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

````


#### `docs/PRD.md` (lines 1008-1063)

Section 12 schema excerpt: chat_sessions and chat_messages as originally specced.

````md
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

````


---

## 10. CLAUDE.md: AI brain and chat sections

Durable rules and decisions (the parts covering RLS, the chatbot, fine-tuning, transcripts, meeting requests, anti-spam, payments gating, the career context document, model usage, and the database).

#### `CLAUDE.md` (lines 121-219)

RLS rules, AI Chatbot Architecture, Candidate AI Fine-Tuning, Transcript Delivery, Meeting Requests, Anti-Spam.

````md
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
`resume_documents.canonical_markdown` and passed to the builder as a **separate argument**, there is
**no `resume_text` column** in active use (the prompt builder reads the markdown, not the candidate record).

**Prompt structure (`lib/ai/build-system-prompt.ts`), data near the top, rules near the bottom:**

1. `<role>`, third-person "Personal Assistant" identity, speaks ABOUT the candidate; not a FAQ bot
2. `<career_information>`, full resume markdown
3. `<context>`, named career-context fields
4. `<custom_answers priority="highest">`, candidate-refined QA pairs; highest priority
5. `<few_shot_examples>`, 2–3 worked hard-question exemplars from custom QA
6. `<knowledge_boundary>`, explicit known / not_known / when_not_known
7. `<principles>`, honesty, calm confidence, human warmth
8. `<adversarial_posture>`, handling skeptical / pressure-testing questions
9. `<redirect_topics>`, topics that go to a direct conversation, not the AI
10. `<voice>`, tone derived from the candidate's own writing
11. `<reasoning_instruction>`, synthesis and numeric grounding

**Complexity router (`app/api/chat/route.ts`):** simple factual → `CHAT_MODEL` (Haiku);
multi-part / adversarial / synthesis → `GENERATION_MODEL` (Sonnet). Detection is a fast string
heuristic (`detectComplexQuestion`), no API call.

**Post-generation validation:** runs only when an answer contains numbers, dollars, percentages, or
credential claims (`detectHighRiskContent`). A forced-tool Sonnet call (`validateAndSanitize`) checks
every such claim traces to the candidate's data; if not grounded, the answer becomes the honest
handoff (a small Haiku call writes it per-question, scripted fallback); if the validation call fails
for any reason, the original answer is returned (fail-safe). Deliberately **no token streaming**, it
conflicts with post-gen validation.

**Trust boundary:** conversation history is rebuilt server-side from `chat_messages`, never taken
from the client (fabricated assistant turns are a jailbreak vector), and a client-supplied
`sessionId` must be verified against the candidate's profile before it is read or written. The system
prompt carries a `cache_control` breakpoint (prompt caching), so per-turn cost drops ~10x within a session.

**Per-turn tracking:** each assistant `chat_messages` row records `model_used`, `was_complex`,
`was_validated`. Blended cost ≈ $0.01 per 10-turn session.

### Candidate AI Fine-Tuning (`/dashboard/ai`)

Candidates see most-asked questions, edit answers (stored as `custom_qa_pairs` JSONB on
`candidate_profiles`), toggle redirect topics / `ai_enabled`, and test in a sandbox. Custom QA pairs
are injected above base career data, giving them priority over resume-derived answers.

### Transcript Delivery

Every AI chat session emails a transcript to both sides when the modal closes or after 30 min of
inactivity. Trigger: `POST /api/transcripts/deliver` (idempotent, fired by `sendBeacon` on chat close).
A sweep endpoint (`/api/cron/deliver-transcripts`) also delivers stale/abandoned sessions the beacon
missed. Candidate email: full transcript, pattern insights at 3+ same-topic questions, fine-tune link.
Employer email: full transcript, profile link, save-candidate + feedback CTAs. All email via Resend;
client (`lib/email/client.ts`) and templates (`lib/email/`) are server-only, never send from client
components.

**Recruiter identity (anonymous viewers).** A recruiter on a public link is anonymous by default. They
may optionally self-identify via `POST /api/chat/identify` `{ sessionId, name?, email, company? }`
(public, service-role write onto `chat_sessions.recruiter_name` / `recruiter_email`, company reuses
`employer_company_name`). When present, the recruiter receives their own transcript copy and the
candidate's transcript names who they spoke with. A logged-in employer viewer still resolves via
`viewer_clerk_user_id` as before; the captured identity is the fallback path for anonymous viewers.
Candidates manage their own conversation records: archive (`chat_sessions.archived_at`) and permanent
delete from the archive. Deleting a transcript never removes training, `custom_qa_pairs` live
independently on `candidate_profiles`.

### Meeting Requests

When the Personal Assistant cannot answer a recruiter's question, it offers to schedule a live
conversation. The recruiter submits availability ranges + email from the chat via
`POST /api/chat/schedule`; that lands in `meeting_requests` (service-role insert, the recruiter is
anonymous). The candidate reads/actions their own requests on `/dashboard/meeting-requests`; the
employer-facing thread view is `/dashboard/conversations`.

### Anti-Spam / Rate Limiting (`lib/security/`)

The public chat pipeline (`/api/chat`, `/api/transcripts/deliver`, `/api/chat/schedule`) is abuse-
controlled by a shared fixed-window counter in the `rate_limits` table, applied via `check_rate_limit()`
(service-role only, never exposed to anon/authenticated roles). Keyed by an opaque bucket string
(`ip:route`, `session:id`, `transcript-email:profile`, ...). See `docs/architecture/11-anti-spam.md`.

````


#### `CLAUDE.md` (lines 269-315)

Paddle Payments (the AI Studio paid seam), Career Context Document, data-fetching conventions for the chat/API routes.

````md
### Paddle Payments

Paddle handles employer billing. Webhook at `/api/webhooks/paddle`, always verify the signature
before processing. Price-id env vars: `PADDLE_EMPLOYER_{STARTER,GROWTH,SCALE}_PRICE_ID`
($49 / $99 / $249 per mo).

**Candidate AI Studio is moving to a paid component** (subscription + free trial of duration TBD;
the free tier has no chatbot). This reverses the original "candidates always free" decision. The
billing/trial system is its own workstream and is **not yet built**. All candidate AI access flows
through one seam, `lib/auth/entitlements.ts` (`assertCandidateAiAccess`). It is open to all
candidates during rollout (`BILLING_ENFORCED = false`); flip the flag and the real
subscription/trial check takes over with no caller changes.

### Career Context Document (`context_package_md`)

A polished, single-file career-context document, generated by the "Candidate Asset Production Skill"
(`docs/CANDIDATE_ASSET_PRODUCTION_SKILL.md`), Section 1 only (the Narrative Guide Block; the NotebookLM
prompt sets in Section 2 are excluded from the candidate flow).

- **Self-serve generation** (`/api/career-context/generate`, `lib/ai/career-context.ts`): reads the
  candidate's résumé + career sources and produces **two narrative angles**; the candidate picks one
  (`selectCareerContextAngle`). Staged in `candidate_profiles.career_context_drafts` (JSONB).
- The selected angle's markdown, or an externally-generated doc uploaded on `/dashboard/assets`,
  lands in the **single** `context_package_md` slot. That column is the active document the brain
  reads and the assets page downloads.
- **Augment loop** (`/api/career-context/augment`, `augmentCareerContextAngle`): re-synthesizes the
  *selected* angle, folding in the candidate's newer authored material (brain fields, refined Q&A,
  career sources) and refreshing verbatim third-party **evidence snippets** from sources. New context
  enters the brain **distilled, not appended**, the deliberate "deepen the synthesis loop" decision
  over adding raw context layers. The story-type/angle framing is preserved across updates.
- `context_package_md` is sensitive brain material: it stays out of the anon column grant (the
  explicit-grant pattern from the 20260626 migration covers all later-added columns automatically).

### Data Fetching, RSC + Server Actions

- **Reads**, Server Components call Supabase via `getRequestClient()` (no API round-trip).
- **Mutations**, Server Actions (`"use server"`): Zod-validate, write, `revalidatePath`.
- **`/api` routes**, reserved for: webhooks (Paddle, Clerk), AI chat (`/api/chat` + `identify` /
  `schedule`), transcript delivery (`/api/transcripts/deliver` + the `cron/deliver-transcripts`
  sweep), career-context / intake / sandbox / resume / harden / sources endpoints, and any caller
  without a Clerk session (public recruiter actions on the calling card). Note: there are no
  `candidates` / `employers` / `jobs` / `feedback` API routes; those are Server Actions.
- **Default to Server Components.** Every `app/` `.tsx` is a Server Component unless it opts out with
  `"use client"`. Push interactive subtrees into small `*Client.tsx` children.

---

````


#### `CLAUDE.md` (lines 316-373)

Claude API usage rules and the database table map.

````md
## Claude API Usage

Two models, two purposes, never swap them. Ids come from `lib/ai/models.ts`.

| Constant | Value | Use |
|---|---|---|
| `CHAT_MODEL` | `claude-haiku-4-5-20251001` | Chatbot responses, fast, cheap |
| `GENERATION_MODEL` | `claude-sonnet-4-6` | Prompt / bullet generation, validation, higher quality |

Import the Anthropic SDK only from a server-only file (`lib/ai/client.ts`). Never expose the API key
to the client.

---

## Database

**The schema's source of truth is `supabase/migrations/`, never reproduce it here.**

**Migrations are applied MANUALLY by the founder, not auto-applied.** The Supabase branching
integration is unreliable and has silently failed to reach the live DB (this caused a production
login outage when a new column never landed). So for every schema change, Claude must do BOTH:
1. **Commit the migration** as a file in `supabase/migrations/` (timestamped), the source of truth.
2. **Surface the full SQL inline** so the founder can run it by hand, paste the exact `.sql` contents
   into the chat reply AND into the PR description under a clear "Migration to apply" heading.

Never assume a migration has been applied. Because deploys can ship before the founder runs the SQL,
**write code defensively against not-yet-applied migrations**: read newly-added columns in a separate,
error-tolerant query (see `readSuspendedAt` in `lib/auth/user-context.ts` and the resilient
`secondary_target_roles` read) so a missing column degrades gracefully instead of breaking the app.
Schema changes still go only through migration files, never ad-hoc edits in the Supabase console.

Tables (as of July 2026):

| Table | Purpose |
|---|---|
| `users` | Clerk-keyed user, role, subscription, `is_admin` |
| `candidate_profiles` | Profile + AI-brain columns (context fields, `custom_qa_pairs`, intake/readiness, `context_package_md`, `career_context_drafts`, `secondary_target_roles`) |
| `candidate_assets` | Uploaded career assets (audio/video/deck/infographic/resume/avatar) |
| `resume_documents` | Parsed resume + `canonical_markdown` (the AI's resume source) |
| `career_sources` | Candidate-supplied third-party sources feeding the career-context synthesis |
| `chat_sessions` / `chat_messages` | AI chat logs; sessions track `recruiter_name`/`recruiter_email`/`archived_at`; messages track `model_used`/`was_complex`/`was_validated` |
| `meeting_requests` | Recruiter-requested live conversations from the chat |
| `intake_answers` | AI intake-interview answers |
| `sandbox_sessions` | Candidate self-test sessions |
| `transcript_gaps` | Gaps surfaced from transcripts to improve the brain (+ `suggested_answer`) |
| `brain_hardening_sessions` | External-transcript hardening runs |
| `rate_limits` | Fixed-window anti-spam counters for the public pipeline (service-role only) |
| `employer_accounts` / `employer_members` | Employer multi-tenancy + team |
| `job_postings` / `saved_candidates` | Jobs + saved pool with stage |
| `feedback` | Employer → candidate messages |
| `profile_views` | View tracking |
| `admin_role_sessions` | Admin role-switch sessions |

Every user-scoped table has RLS enabled with an owner/isolation policy in its creating migration (see
RLS section above).

---

````


#### `CLAUDE.md` (lines 478-557)

Current build status: everything brain/chat that is shipped, the next-session TODOs (brain intelligence follow-ups), standing decisions.

````md
## Current Build Status

> Durable cross-session handoff, updated July 2026. The in-session task list (`TaskCreate`) and any
> scheduled check-ins are **ephemeral**, only what is committed here survives. Read this first.
> The active build plan (recruiter conversion loop + polish) lives in `todo.md` at the repo root;
> keep that and this section in sync rather than duplicating.

**Phase:** The AI Brain (Phases A–E) is fully built and merged to `main`, plus polish fast-follows,
the recruiter conversation loop (identity capture + meeting requests), anti-spam, transcript archive,
and the candidate Settings page. **Working branch:** one `claude/<task-slug>` branch per task,
sequential draft PRs into `main`.

### Shipped & merged
- **Superadmin tools (July 2026):** `SUPERADMIN_EMAILS` first-admin bootstrap (self-heal in
  `getUserContext`); shared `getAdminContext()` guard; `admin_audit_log` table + `logAdminAction`;
  read-only impersonation (`rb-admin-impersonate` cookie → service-role reads via a write-blocking
  `createReadOnlyClient` Proxy, render-time bootstraps guarded); navy operator `AdminCommandBar`
  (absorbs the old preview banner) + ⌘K `AdminCommandPalette` (search/impersonate/grant-revoke);
  `/admin` users table wired with impersonate + grant/revoke (no self-revoke).
- **Superadmin dashboard shell (July 2026):** admins get a first-class dashboard on the shared
  `SidebarLayout` (`app/(admin)/layout.tsx` + `AdminNav` + `UserMenu role="admin"` + palette
  launcher), split into `/admin` (Overview: stat cards, preview, provisioning note) and
  `/admin/users` (management table). Login routing (`app/page.tsx`) redirects `is_admin` users
  (bootstrap-healed) to `/admin`, regardless of their candidate/employer role. Users table shows
  the Clerk user id and supports **disable** (`users.suspended_at`, gated in `getUserContext`,
  suspended non-admins land on `/suspended`) and **full delete** (Clerk account + cascade Supabase
  data, confirm-guarded); `/admin` sidebar has one-click Candidate/Employer view launchers.
- **A, Minimum viable brain:** `candidate_profiles` brain columns + `chat_sessions`/`chat_messages`;
  `lib/ai/build-system-prompt.ts`; `getCandidateBrainBySlug`; `/api/chat`; `ChatPanel`; AI Studio
  context form; anon-column REVOKE/GRANT security fix.
- **B, Elite chat route:** complexity router; high-risk detection + `validateAndSanitize` grounding;
  per-turn `model_used`/`was_complex`/`was_validated` tracking.
- **C, Sandbox self-testing:** `sandbox_sessions`; 20-question library; `analyze-sandbox.ts`;
  `/api/sandbox/analyze`; `SandboxPanel` with verdicts + "Strengthen <field>" deep-links.
- **Calling card (UX):** chat-first public `/c/[slug]`; replaced the old modal. No token streaming.
- **D, AI intake interview:** `intake_answers` + readiness columns; `lib/ai/intake.ts`;
  `/api/intake/analyze` + `/assemble`; `IntakeInterview` dialog.
- **E1, Transcript email:** Resend client + branded candidate/employer emails;
  `/api/transcripts/deliver` (idempotent, `sendBeacon` on chat close).
- **E2, Transcript→brain gap loop:** `transcript_gaps`; `analyze-transcript.ts`; gap-analysis hook in
  the deliver route; `PromptBot` in AI Studio.
- **E3, External transcript hardening:** `brain_hardening_sessions`; `harden-transcript.ts`;
  `/api/transcript/harden` (transcript never stored); `HardenPanel` + history.
- **Fast-follow, PWA + share:** `app/manifest.ts`; code-generated `app/icons/[size]`; `ShareButton`.
- **Chat hardening + one-click learning (July 2026):** server-rebuilt history + verified sessionId
  (trust boundary); prompt caching on the system prompt; forced-tool validator; model-written
  handoffs; truncation guard; staged latency indicator + retry in `ChatPanel`; auto-grow input;
  `transcript_gaps.suggested_answer` drafted by the analyzer + `adoptGapAnswer` one-click approve in
  `PromptBot`; asset loading shimmers; dashboard `loading.tsx`.
- **Career context document (July 2026):** self-serve generate → two angles → select → augment loop
  (`lib/ai/career-context.ts`, `/api/career-context/*`); `context_package_md` slot; `career_sources`.
- **Recruiter conversation loop (July 2026):** anonymous recruiter identity capture
  (`/api/chat/identify`, `chat_sessions.recruiter_name/email`) so both sides get transcripts;
  meeting requests when the AI can't answer (`meeting_requests`, `/api/chat/schedule`,
  `/dashboard/meeting-requests`, employer `/dashboard/conversations`); cron transcript-delivery sweep.
- **Anti-spam (July 2026):** `rate_limits` + `check_rate_limit()` on the public chat pipeline;
  `lib/security/`; `docs/architecture/11-anti-spam.md`.
- **Candidate self-management (July 2026):** transcript archive/delete (`chat_sessions.archived_at`),
  Settings page with data export (`/api/candidate/data-export`) and fresh-start controls.
- **Design system:** `design-system/roleboost/MASTER.md` now committed as the visual reference.

### Next-session TODO (in order)
1. **A11y + empty/loading-states audit** *(partially done: chat/calling-card/AI-Studio surfaces +
   dashboard loading.tsx shipped July 2026)*, finish WCAG 2.1 AA sweep on employer dashboards.
2. **Brain intelligence follow-ups** *(designed, not built)*: voice profile column (Sonnet-derived
   tone descriptors injected into `<voice>`); cross-session question clustering + answer-rate metric;
   returning-recruiter memory (needs founder steer on privacy).
3. **Distinctive visual refresh** *(design system committed at `design-system/roleboost/MASTER.md`;
   apply, don't redesign)*, roll the documented direction across surfaces; propose before any
   deviation from MASTER.md.
4. **Phase F, voice input (Whisper)** *(held)*, browser audio → `/api/transcribe` (OpenAI Whisper) →
   editable transcript before submit. Gated on: founder has tested A–E, and `OPENAI_API_KEY` is
   provisioned. Build with graceful degradation so it is safe to merge before the key is set.

### Standing decisions
- Voice (F) is **last**, only after the rest is tested.
- DB migrations are applied **manually by the founder**: always commit the migration file AND surface
  the full SQL inline (chat + PR "Migration to apply" section). Code defensively for not-yet-applied
  migrations. See the Database section.
- Model ids come from `lib/ai/models.ts`, never hardcode.
````


---

## 11. Appendix: shared types and open work items

### 11.1 Shared TypeScript types (brain/chat)

#### `lib/types/index.ts` (lines 29-148)

CustomQAPair, CandidateBrain, CandidateProfile, and the career-context types. (Lines 149-251, omitted, are the Asset Package types.)

````ts
export interface CustomQAPair {
  question: string;
  answer: string;
}

// The verified career context that feeds the AI system prompt. Resume text is
// NOT stored here -- it is sourced from resume_documents.canonical_markdown and
// passed to the prompt builder separately.
export interface CandidateBrain {
  full_name: string;
  target_role: string | null;
  /** Additional roles the candidate is open to, beyond the primary target. */
  secondary_target_roles: string[];
  leadership_philosophy: string | null;
  key_wins: string | null;
  departure_reasons: string | null;
  biggest_challenge: string | null;
  ideal_environment: string | null;
  manager_needs: string | null;
  honest_weaknesses: string | null;
  wish_questions: string | null;
  additional_context: string | null;
  custom_qa_pairs: CustomQAPair[];
  redirect_topics: string[];
}

export interface CandidateProfile extends CandidateBrain {
  id: string;
  clerk_user_id: string;
  slug: string;
  headline: string | null;
  location: string | null;
  linkedin_url: string | null;
  summary_bullets: string[];
  ai_enabled: boolean;
  is_published: boolean;
  intake_completed?: boolean;
  brain_readiness_score?: number;
  // The active career-context document (uploaded OR generated-and-selected). This
  // is the single slot the brain reads; both flows write here.
  context_package_md?: string | null;
  context_package_updated_at?: string | null;
  // Staging for self-serve generation: both narrative angles + which is selected.
  // Retired in favor of asset_package; kept optional for back-compat reads.
  career_context_drafts?: CareerContextDrafts | null;
  // The full self-serve asset package (both perspectives + which is chosen). The
  // chosen perspective's Section 1 is what populates context_package_md.
  asset_package?: AssetPackage | null;
  created_at: string;
  updated_at: string;
}

// ── Career Context Document (self-serve generation) ─────────────────────────
// The "RoleBoost Candidate Asset Production Skill" (Section 1 only) run in-app:
// the candidate's résumé + career sources synthesized into a polished, elite
// career-context document. Two narrative angles are generated; the candidate
// picks one, whose markdown becomes the active context_package_md.

export type CareerContextStoryType =
  | 'career_arc'
  | 'builder'
  | 'problem_solver'
  | 'leadership'
  | 'skeptic_champion'
  | 'specialist';

export type CareerContextAngleKey = 'A' | 'B';

export interface CareerContextAngle {
  /** Short human label for this framing, e.g. "The Builder". */
  name: string;
  story_type: CareerContextStoryType;
  headline: string;
  target_role: string;
  location: string;
  /** 2-3 sentence evidence-grounded story (third person about the candidate). */
  narrative: string;
  /** One line: the single most credible, specific fact. */
  hook: string;
  /** The one hard question every recruiter asks, with a first-person answer. */
  hard_question: { question: string; answer: string };
  /** 5-8 specific metrics/facts that must appear in every asset. */
  key_numbers: string[];
  positioning: string;
  /**
   * Verbatim third-party quotes pulled from career sources (recommendations,
   * reviews), curated evidence, not raw source text. Empty when no sources.
   */
  evidence_snippets: EvidenceSnippet[];
  /** The full document rendered to markdown, what lands in context_package_md. */
  markdown: string;
}

export interface EvidenceSnippet {
  /** The exact quote from a source. */
  quote: string;
  /** Where it came from, e.g. "LinkedIn recommendation" or a name/title. */
  source: string;
}

export interface CareerContextDrafts {
  angles: Record<CareerContextAngleKey, CareerContextAngle>;
  /** The angle the generator recommends. */
  recommended: CareerContextAngleKey;
  /** The angle the candidate selected, or null until they choose. */
  selected: CareerContextAngleKey | null;
  generated_at: string;
}

// ── Asset Package (self-serve, in-app) ──────────────────────────────────────
// The full RoleBoost Candidate Asset Production Skill run in AI Studio: résumé +
// career sources, strategized toward a target role + optional job description,
// producing TWO narrative perspectives, each a self-contained narrative (Section
// 1) plus its four ready-to-run NotebookLM prompts (Section 2). The candidate
// chooses one perspective; that perspective's rendered Section 1 becomes the
// active context_package_md and drives the AI brain. Both perspectives' prompts
// stay available to copy/download. This is the narrative hub; it replaces the
// retired career-context two-angle generator.

/** The 10 story types from the Candidate Asset Production Skill (v1.7). */
````


#### `lib/types/index.ts` (lines 252-512)

Chat, meeting-request, sandbox, intake, brain-readiness, career-source, transcript-gap, and hardening types.

````ts
export type ChatRole = 'user' | 'assistant';

// One turn in the chat transcript, exchanged between the client and /api/chat.
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatSession {
  id: string;
  candidate_profile_id: string;
  viewer_clerk_user_id: string | null;
  employer_account_id: string | null;
  employer_company_name: string | null;
  is_sandbox: boolean;
  started_at: string;
  ended_at: string | null;
  transcript_sent: boolean;
}

export interface ChatMessage {
  id: string;
  chat_session_id: string;
  role: ChatRole;
  content: string;
  // Phase B model + validation tracking (populated on assistant turns).
  model_used: string | null;
  was_complex: boolean;
  was_validated: boolean;
  created_at: string;
}

export interface CandidateAsset {
  id: string;
  candidate_profile_id: string;
  clerk_user_id: string;
  asset_type: AssetType;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  is_active: boolean;
  created_at: string;
}

// A recruiter's request to meet, captured when the Personal Assistant redirects.
// Lightweight inbound pipeline: new -> contacted -> scheduled -> closed.
export type MeetingRequestStatus = 'new' | 'contacted' | 'scheduled' | 'closed';

export interface MeetingRequest {
  id: string;
  candidate_profile_id: string;
  chat_session_id: string | null;
  recruiter_email: string;
  recruiter_name: string | null;
  availability: string;
  status: MeetingRequestStatus;
  created_at: string;
}

// ── Sandbox self-testing (Phase C) ──────────────────────────────────────────

export type SandboxCategory =
  | 'gap_departure'
  | 'commitment_tenure'
  | 'metric_verification'
  | 'leadership'
  | 'adversarial'
  | 'weakness_failure';

export type SandboxVerdict = 'strong' | 'adequate' | 'weak' | 'hallucinated';

export interface SandboxQuestion {
  id: string;
  category: SandboxCategory;
  question: string;
  whyItMatters: string;
  // Brain field keys this question probes (e.g. 'departure_reasons', 'key_wins').
  brainFields: string[];
}

export interface SandboxAnalysis {
  verdict: SandboxVerdict;
  diagnosis: string;
  prescription: string;
  // A brain field key to strengthen, or 'custom_qa', or null.
  brainFieldTarget: string | null;
  expansionPrompt: string;
}

export interface SandboxSession {
  id: string;
  candidate_profile_id: string;
  question: string;
  question_category: string;
  ai_answer: string;
  verdict: SandboxVerdict;
  diagnosis: string;
  prescription: string;
  brain_field_target: string | null;
  expansion_prompt: string | null;
  pattern_signal: boolean;
  created_at: string;
}

// ── AI intake interview (Phase D) ───────────────────────────────────────────

export type IntakeSeverity = 'high' | 'medium' | 'low';

export interface IntakeInconsistency {
  id: string;
  sourceA: string;
  sourceB: string;
  description: string;
  severity: IntakeSeverity;
}

export interface IntakeQuestion {
  id: string;
  question: string;
  /** Why this is being asked -- shown under the question. */
  context: string;
  /** Brain field key the answer feeds (e.g. 'departure_reasons'). */
  category: string;
  pass: number;
}

export interface IntakeAnswer {
  questionId: string;
  questionText: string;
  answerText: string;
  category: string;
  pass: number;
}

/** A source document fed to the analysis (résumé, LinkedIn paste, etc.). */
export interface IntakeDocument {
  label: string;
  text: string;
}

export interface BrainReadiness {
  overall: number; // 0-100
  categories: { label: string; score: number }[];
}

// ── Career sources (external profile imports) ───────────────────────────────

export type CareerSourceType =
  | 'linkedin'
  | 'indeed'
  | 'github'
  | 'portfolio'
  | 'review'
  | 'recommendation'
  | 'other';

export type SourceIngestMethod = 'upload' | 'paste' | 'link';

// Client-safe view of a source: metadata only, never the extracted_text body.
export type CareerSourceSummary = Pick<
  CareerSource,
  'id' | 'source_type' | 'label' | 'ingest_method' | 'char_count' | 'file_name' | 'created_at'
>;

// External career material a candidate brings in (LinkedIn/Indeed/GitHub/reviews).
// Stored as extracted text and fed to the brain as grounding -- never displayed
// raw to recruiters. extracted_text is private; never granted to anon.
export interface CareerSource {
  id: string;
  candidate_profile_id: string;
  clerk_user_id: string;
  source_type: CareerSourceType;
  label: string;
  ingest_method: SourceIngestMethod;
  extracted_text: string;
  char_count: number;
  source_url: string | null;
  file_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Transcript-to-brain gap loop (Phase E2) ─────────────────────────────────

export type TranscriptGapType = 'deflection' | 'weak' | 'new_topic';
export type GapPriority = 'high' | 'medium' | 'low';

/** A gap as produced by the analyzer (before it gets DB ids). */
export interface TranscriptGapItem {
  questionAsked: string;
  chatbotAnswer: string;
  gapType: TranscriptGapType;
  suggestedPrompt: string;
  /** Ready-to-approve drafted answer; only when the brain already has the substance. */
  suggestedAnswer?: string | null;
  category: string;
  priority: GapPriority;
}

export interface TranscriptGap {
  id: string;
  candidate_profile_id: string;
  chat_session_id: string;
  question_asked: string;
  chatbot_answer: string;
  gap_type: TranscriptGapType;
  suggested_prompt: string;
  suggested_answer: string | null;
  category: string;
  priority: GapPriority;
  is_addressed: boolean;
  pattern_count: number;
  created_at: string;
}

// ── External transcript hardening (Phase E3) ────────────────────────────────

export type HardeningSource = 'paste' | 'file';
export type CoverageVerdict = 'strong' | 'adequate' | 'weak' | 'missing';

/** A question pulled from an external transcript, judged against the brain. */
export interface TranscriptHardeningGap {
  questionFromTranscript: string;
  brainCoverageVerdict: CoverageVerdict;
  expansionPrompt: string;
  /** A brain field key, or 'custom_qa'. */
  brainFieldTarget: string;
  priority: GapPriority;
}

/** One prioritized step in the hardening plan. */
export interface HardeningAction {
  priority: number;
  action: string;
  brainFieldTarget: string;
  expansionPrompt: string;
}

/** The analyzer's full result for one transcript (also the API response body). */
export interface BrainHardeningResult {
  questionsFound: number;
  gapsIdentified: TranscriptHardeningGap[];
  strongCoverageConfirmed: string[];
  hardeningPlan: HardeningAction[];
}

export interface BrainHardeningSession {
  id: string;
  candidate_profile_id: string;
  transcript_source: HardeningSource;
  source_context: string | null;
  questions_found: number;
  gaps_identified: number;
  gaps_addressed: number;
  hardening_plan: HardeningAction[];
  created_at: string;
  last_reanalyzed_at: string | null;
}
````

### 11.2 Open work items (todo.md, full)

The active build plan is almost entirely about the recruiter chat conversion loop and brain pipeline; included in full because nearly every item touches the systems above (note especially the flagged `chat_sessions` anon INSERT policy, the detector fixes, and the prompt-injection framing item).

#### `todo.md`

````md
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
````


---

*End of snapshot. Every file above lives at the path shown; line-ranged excerpts note their exact ranges. For anything ambiguous, the repo is the source of truth per CLAUDE.md.*
