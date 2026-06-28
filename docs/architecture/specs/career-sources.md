# Spec — Career Sources

> Status: in progress · Owner: AI Studio / Brain · Branch: `claude/career-assets-context-325jtw`
> Last updated: June 2026

## Problem

A candidate's chatbot brain is currently built from two inputs only:

1. `resume_documents.canonical_markdown` (the résumé), and
2. the typed answers from the **intake interview**.

The intake dialog *already* lets a candidate paste "extra career text" (LinkedIn About, Indeed
profile, etc.), but that text is:

- **ephemeral** — held in client state, never persisted; and
- **half-used** — it feeds Pass-1 inconsistency detection only. It is **never** passed to
  `assembleBrainFromIntake`, so nothing the candidate brings beyond the résumé ever enriches the
  brain fields. It is discarded when the dialog closes.

The result: rich material job seekers already have (LinkedIn, Indeed, GitHub, performance reviews,
recommendations) cannot durably enhance their profile, their chatbot context, or the discrepancy
analysis.

## Goal

Let candidates bring external career sources — by **upload** (PDF/DOCX/TXT) or **paste** — that are
**persisted**, **typed/labelled**, and used for all three jobs:

1. **Chatbot context / brain enrichment** — sources become grounding for brain assembly.
2. **Discrepancy analysis** — sources cross-check against the résumé in intake Pass 1.
3. **Profile enhancement** — (later) pre-fill profile metadata.

Non-goal (handled by NotebookLM, explicitly out of scope per CLAUDE.md): media assets
(audio/video/deck/infographic). Those are recruiter-facing display media, never AI inputs, and are
**not** part of this feature.

## What counts as a "source"

| `source_type` | Typical ingest | Primary value |
|---|---|---|
| `linkedin`     | LinkedIn "Save to PDF" or pasted About+Experience | discrepancy + recommendations/voice |
| `indeed`       | Indeed résumé/profile download | discrepancy |
| `github`       | (Phase 4) public profile fetch / pasted README | proof of work, voice |
| `portfolio`    | pasted site text / case study | context |
| `review`       | pasted performance review / 360 | wins, weaknesses |
| `recommendation` | pasted reference / LinkedIn recommendation | third-party validation + voice |
| `other`        | anything else | context |

## Data model

New table `career_sources` — a sibling of `resume_documents` (text input to the brain, **not** a
displayable asset, so deliberately separate from `candidate_assets`). We store only the **extracted
text**, never the original binary (mirrors the résumé-parse and transcript-hardening precedents).

```
career_sources
  id                   uuid pk
  candidate_profile_id uuid fk -> candidate_profiles (cascade)
  clerk_user_id        text fk -> users (cascade)
  source_type          text check (linkedin|indeed|github|portfolio|review|recommendation|other)
  label                text                       -- display label, e.g. "LinkedIn profile"
  ingest_method        text check (upload|paste|link)
  extracted_text       text not null default ''   -- the text fed to the brain
  char_count           integer not null default 0
  source_url           text                       -- link method only
  file_name            text                       -- upload method only
  is_active            boolean not null default true
  created_at / updated_at timestamptz
```

- **RLS**: owner-only (`clerk_user_id = requesting_user_id()`), same shape as `resume_documents`.
- **Anon**: never granted — `extracted_text` is private brain material (like intake data).
- Index on `candidate_profile_id`.

`AssembledBrain` and the brain prompt are unchanged; sources flow in as additional grounding
`IntakeDocument`s, reusing the existing `{ label, text }` shape.

## Phase plan

Each phase is its own commit on the working branch, sequential PRs into `main`.

### Phase 1 — Backend foundation (no behaviour change risk)
- Migration `*_career_sources.sql` (table + RLS + index; no anon grant).
- Types: `CareerSource`, `CareerSourceType`, `SourceIngestMethod`.
- `POST /api/sources` — multipart; accepts `file` **or** `text`, plus `source_type` + `label`.
  Extracts text via existing `extractResumeText` (generic PDF/DOCX/TXT), stores the row.
- `deleteCareerSource(id)` server action.
- Helper `getActiveCareerSources(profileId)` returning `IntakeDocument[]`.
- Wire active sources into intake **analyze** (already pushes résumé → also push sources) and, the
  key fix, into **assemble**: extend `assembleBrainFromIntake(resumeMarkdown, answers, sources)` so
  sources become grounding for the synthesized brain fields.

### Phase 2 — AI Studio Career Sources UI + intake hookup
- New "Career sources" card in the AI Studio **Build** section: upload/paste, choose type, list
  with char counts + delete. Server component reads sources, passes to `AIStudio`.
- Intake dialog notes that saved sources are auto-included (the standalone paste box stays for
  one-off text).

### Phase 3 — Onboarding + résumé→profile pre-fill
- Optional "bring your LinkedIn / Indeed" step after the résumé step in onboarding.
- On résumé parse, pre-fill `headline` / `target_role` / `summary_bullets` from the parsed
  `canonical_json` when those profile fields are still empty.

### Phase 4 — Structured imports ✅
- LinkedIn data-export **ZIP** parsing (`lib/career-sources/linkedin-export.ts` + `csv.ts`,
  dependency `jszip`): pulls Profile, Positions, Education, Skills, Certifications, and
  Recommendations Received into one consolidated grounding source.
- GitHub **link** import (`lib/career-sources/github-import.ts`): public GitHub REST API only
  (bio + top repos + languages); ToS-safe, never scrapes. New `link` ingest method + `source_url`.
- `/api/sources` routes by input: `url` → GitHub, `.zip` → LinkedIn parser, else file/paste.
- UI: AI Studio + onboarding gain a **Link** mode (GitHub) and `.zip`-aware upload (LinkedIn).

## Security / guardrails
- Service-role never reads `extracted_text` to the client; the AI page reads it via the
  authenticated (RLS) client, owner-scoped.
- `extracted_text` excluded from any anon grant.
- Upload limits mirror résumé: 10 MB, `.pdf/.docx/.txt`. Paste capped (e.g. 50k chars).
- Per-candidate active-source cap (e.g. 10) to bound prompt size and cost.
