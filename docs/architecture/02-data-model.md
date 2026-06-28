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
