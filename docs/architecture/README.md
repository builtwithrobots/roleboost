# RoleBoost Architecture, The Build Bible

> The authoritative, living reference for how RoleBoost is built and works.
> The **code is always the source of truth**; this folder explains how the pieces
> fit, why decisions were made, and where to look. When code and docs disagree,
> the code wins, then fix the doc.
> Last updated: June 2026.

---

## What RoleBoost Is

An AI-powered candidate intelligence platform. A job seeker uploads a résumé and
career context; the platform builds a **personal career AI** ("the brain") that
represents them to recruiters 24/7 over one shareable link (`/c/[slug]`). Every
conversation emails a transcript to both sides and feeds a growth loop that makes
the brain sharper over time. Employers get a dashboard to save candidates, run a
pipeline, and send feedback.

**The flagship is the brain.** The asset suite (audio, video, deck, infographic,
ATS résumé) and everything else exists to *feed the brain* or *deliver it*.

---

## How to read this folder

Start at [01, System Overview](./01-system-overview.md), then jump to the area
you care about. Each doc is self-contained and references exact file paths.

| Doc | Covers |
|---|---|
| [01, System Overview](./01-system-overview.md) | Stack, repo layout, request lifecycle, the big picture |
| [02, Data Model](./02-data-model.md) | Every table, RLS, the anon-grant pattern, migrations |
| [03, Auth & Entitlements](./03-auth-and-entitlements.md) | Clerk, `getUserContext`, the three Supabase clients, admin preview, the AI-access seam |
| [04, The AI Brain](./04-ai-brain.md) | Brain assembly, the layered system prompt, complexity router, grounding validation, model split |
| [05, Career Context Document](./05-career-context-document.md) | Generate → select → augment → evidence; the synthesis loop |
| [06, AI Studio](./06-ai-studio.md) | The candidate's build/test/harden surface: fields, custom QA, intake, sandbox, hardening, sources |
| [07, Chat & Transcripts](./07-chat-and-transcripts.md) | Live chat flow, logging, transcript email, transcript→brain gap loop |
| [08, Assets, Résumé & Storage](./08-assets-resume-storage.md) | Buckets, signed URLs, résumé pipeline, the public calling card |
| [09, Employer Side](./09-employer.md) | Accounts/members multi-tenancy, jobs, board, saved candidates, feedback |
| [10, Conventions & Ops](./10-conventions-and-ops.md) | Server patterns, error envelope, webhooks, env vars, deployment, dev workflow |

`./specs/` holds the **historical build specs**, the point-in-time design
documents the features were built from. They are preserved for intent and
rationale but are *not* kept in sync with the code; the numbered docs above are.

---

## The 60-second mental model

```
Candidate uploads résumé + career sources
   → résumé parsed to resume_documents.canonical_markdown
   → AI Studio: intake interview / manual fields / career context document
                build the brain (candidate_profiles brain columns + context_package_md)
   → /c/[slug] public calling card: recruiter chats with the brain (/api/chat)
        · system prompt assembled from the brain (lib/ai/build-system-prompt.ts)
        · Haiku for simple Q, Sonnet for hard Q (complexity router)
        · numeric/credential claims grounded against the brain before returning
   → chat closes → transcript emailed to both sides (/api/transcripts/deliver)
                  → transcript analyzed for gaps → fed back into AI Studio
   → candidate keeps enriching → brain compounds
Employer saves candidates → board pipeline → feedback
```

Two Claude models, one job each: **Haiku** (`CHAT_MODEL`) for live chat,
**Sonnet** (`GENERATION_MODEL`) for one-time generation/analysis. IDs live in
`lib/ai/models.ts` and are never hardcoded elsewhere.
