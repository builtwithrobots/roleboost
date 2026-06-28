# 05 — Career Context Document

A polished, single-file career narrative that becomes the top, authoritative layer
of the brain. It is the in-app, self-serve implementation of the **Candidate Asset
Production Skill** (`docs/CANDIDATE_ASSET_PRODUCTION_SKILL.md`), **Section 1 only**
— the Narrative Guide Block. The NotebookLM prompt sets (Section 2) are
deliberately excluded from the candidate flow.

## The core idea

The document is the candidate's most *synthesized* input — narrative, hook, the
one hard question, key numbers, positioning, and third-party evidence — distilled
from their résumé + career sources. Because it mirrors the prompt's own layering,
it slots in as the first block of the system prompt (above the raw résumé). As the
candidate adds more material over time, the document is **re-synthesized**, not
appended — the brain gets *sharper*, not *longer*. This is the deliberate
"deepen the synthesis loop, don't add a raw layer" decision.

## Storage

On `candidate_profiles` (all anon-excluded by the column-grant pattern):

- **`context_package_md`** (TEXT) — the **single active document** the brain reads
  and the assets page downloads. Written by *either* generation-and-selection
  *or* an external upload on `/dashboard/assets`. One logical slot, two sources;
  selecting a generated angle and uploading both write here (intended).
- **`context_package_updated_at`** (TIMESTAMPTZ).
- **`career_context_drafts`** (JSONB) — generation staging:
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

## Generation — two angles (`lib/ai/career-context.ts`)

`generateCareerContext(fullName, resumeMarkdown, sources)`:
- Runs the skill's workflow — AI Mirror → story type → **two genuinely different
  narrative angles** + a recommendation — via a forced tool call on
  `GENERATION_MODEL` (Sonnet).
- **Story types:** `career_arc`, `builder`, `problem_solver`, `leadership`,
  `skeptic_champion`, `specialist`.
- Hard grounding rules in the system prompt: never invent a number/metric/date/
  credential; the hook must be specific; narrative in third person, hard-question
  answer in first person; evidence quotes must be verbatim from sources (else
  empty).
- Each angle is rendered to markdown (`renderAngleMarkdown`) including a "What
  Others Say" section when evidence exists.

Endpoint: **`POST /api/career-context/generate`** — entitlement-gated
(`assertCandidateAiAccess`), loads résumé + active career sources, requires at
least one of them, calls the module, persists `career_context_drafts`, returns the
drafts. `runtime = nodejs`, `maxDuration = 60`.

## Selection (`selectCareerContextAngle` server action)

In `app/(candidate)/dashboard/ai/actions.ts`. Records `selected` on the drafts and
**copies the chosen angle's markdown into `context_package_md`** (+ timestamps).
Switching angles later is just another call — no regeneration. Revalidates
`/dashboard/ai` and `/dashboard/assets`.

## The augment loop — re-synthesis (`augmentCareerContextAngle`)

The "keep building" mechanism. `augmentCareerContextAngle({ fullName, base,
resumeMarkdown, sources, brainFields, customQA })`:
- Takes the **currently selected angle** as the base and folds in the candidate's
  newer authored material — the eight brain fields, refined custom Q&A, and career
  sources — plus refreshed verbatim evidence snippets.
- **Preserves the story-type and angle name** (forced from the base) so updates
  refine the chosen story rather than redirect it.
- Never invents; every claim must trace to the current document or the new
  material.

Endpoint: **`POST /api/career-context/augment`** — entitlement-gated; requires a
*selected* angle (else 400). Replaces the selected angle in `career_context_drafts`
and promotes its new markdown to `context_package_md`, so the brain picks it up on
the next chat. Revalidates `/dashboard/ai` and `/dashboard/assets`.

## How it reaches recruiters

`getCandidateBrainBySlug` loads `context_package_md` as `careerContextMarkdown` and
the selected angle's hard question is promoted into `custom_qa_pairs`.
`buildCandidateSystemPrompt` renders the `<career_context_document>` block first,
and `validateAndSanitize` includes the document in its grounding set. See
[04 — The AI Brain](./04-ai-brain.md). This wiring is what makes the document
*do* anything — without it the column is just stored text.

## UI (`components/candidate/ContextDocumentPanel.tsx`)

The **Context Document** tab in AI Studio:
- **Empty state** → "Generate document" (calls `/generate`).
- **Two angle cards** side by side: recommended flagged, structured content
  (narrative, hook, hard question, key numbers, evidence), select to make active.
- **Update document** (augment) — primary when an angle is selected — and
  **Start over** (full regenerate).
- Surfaces `402` (entitlement) and "add a résumé/source first" (400) gracefully;
  evidence rendering is guarded for older drafts that predate the field.

## Entitlement & billing

Everything routes through `assertCandidateAiAccess` (rollout-open today). When
billing ships, the paywall activates with no changes here. See
[03 — Entitlements](./03-auth-and-entitlements.md).
