# 06 — AI Studio

`/dashboard/ai` — the candidate's surface for building, testing, and hardening
their brain. Page: `app/(candidate)/dashboard/ai/page.tsx` (loads profile, open
gaps, hardening sessions, active career sources) → `components/candidate/AIStudio.tsx`.

## Tabs

`AIStudio.tsx` is an accessible tab layout (`role="tab"`/`role="tabpanel"`):

| Tab | What it holds |
|---|---|
| **Build** | Prompt bot (gaps), guided-interview launcher, career-sources card, the eight career-context fields, custom answers, redirect topics |
| **Context Document** | `ContextDocumentPanel` — see [05](./05-career-context-document.md) |
| **Test** | `SandboxPanel` — self-test against the live brain |
| **Harden** | `HardenPanel` — analyze external transcripts |

Brain edits in **Build** auto-save (debounced) via `updateCandidateBrain`
(`app/(candidate)/dashboard/ai/actions.ts`) and apply to the live AI immediately —
the studio is a living system. The header has the global `ai_enabled` switch.

## Build — the manual brain fields

Eight free-text fields (each ≤5000 chars) map 1:1 to the `<context>` block:
`key_wins`, `leadership_philosophy`, `departure_reasons`, `biggest_challenge`,
`ideal_environment`, `manager_needs`, `honest_weaknesses`, `wish_questions`. Plus:
- **Custom answers** (`custom_qa_pairs`, up to 50) — pinned Q/A used word-for-word,
  highest priority; the first few also become few-shot exemplars. This is the main
  unbounded "keep adding" mechanism.
- **Redirect topics** (up to 30) — routed to a direct human conversation.

`updateCandidateBrain` Zod-validates all of the above and writes them in one call.

## Guided intake interview (`lib/ai/intake.ts`)

A layered, recruiter-style interview that fills the eight fields for the candidate.
All passes use `GENERATION_MODEL` (Sonnet) with forced tool output.

- **Pass 1** — `analyzeIntakePass1(docs)` reads the résumé + career sources, flags
  cross-document **inconsistencies**, and generates 8–12 recruiter questions, each
  tagged to a brain category.
- **Pass 2/3** — `generateNextPass(...)` adds targeted follow-ups *only* for vague
  answers (often Pass 3 returns none). Max 20 answers total.
- **Assembly** — `assembleBrainFromIntake(resumeMarkdown, answers, sources)`
  synthesizes first-person field content; **synthesized content only overwrites a
  field when non-empty** (never wipes what the candidate wrote).
- **Readiness** — `computeReadiness` scores four groups (Core & wins, Hard
  questions, Leadership, Depth & fit); a field counts as covered above ~50 chars.

Endpoints: `POST /api/intake/analyze` (stateless per pass) and
`POST /api/intake/assemble` (persists `intake_answers`, merges fields, writes
`brain_readiness_score`, marks `intake_completed`). UI:
`components/candidate/IntakeInterview.tsx`.

## Test — the sandbox (`lib/ai/analyze-sandbox.ts`, `lib/ai/sandbox-questions.ts`)

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

## Harden — external transcripts (`lib/ai/harden-transcript.ts`)

`HardenPanel` accepts a pasted or uploaded (TXT/PDF) transcript from a *real*
conversation. `POST /api/transcript/harden` runs `hardenTranscriptAnalysis`
(Sonnet): maps every question to brain coverage, flags gaps, and returns a
prioritized `hardening_plan`. **The transcript is never stored** — only the plan +
counts land in `brain_hardening_sessions` (supports re-analysis to confirm gaps
closed). Privacy is the headline design rule.

## The prompt bot & the growth loop

`PromptBot` surfaces open `transcript_gaps` (mined from real recruiter chats — see
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
brain *distilled* — through the fields and the context document — which is the same
synthesis-over-raw-volume principle behind the augment loop.

## Role recommendation & profile derivation

`recommendRoles` (`lib/ai/recommend-roles.ts`, via
`/api/profile/recommend-roles`) suggests 3–5 realistic target roles from the
résumé + sources (Sonnet, transient — not stored). `deriveProfileFromResume`
(`lib/ai/derive-profile.ts`) pre-fills empty profile fields (headline, target
role, summary bullets, location, LinkedIn) after résumé parse, best-effort and
non-destructive.
