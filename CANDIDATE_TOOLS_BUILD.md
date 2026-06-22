# Candidate Dashboard Tools — Build Checklist

> Working checklist for: Resume→ATS pipeline, Profile changes, Labels.
> Full design: `/root/.claude/plans/let-s-work-on-candidate-velvet-snowglobe.md`.
> Sequence: Phase 0 (AI foundation) → 1 (resume→ATS) → 2 (profile) → 3 (labels) → 4 (elite add-ons).

⚠️ **Prod-migration drift:** the Supabase GitHub integration points at the wrong project, so
migrations do NOT auto-apply to production (`gsilfhywebnzlxyyzbgq`). Each migration below must be
**run against prod by hand before the matching code deploys.** Verify prod's real
`candidate_assets.asset_type` CHECK before altering it.

---

## Phase 0 — AI Foundation  (prerequisite)  ✅ DONE
- [x] Add dependency `@anthropic-ai/sdk`; ⏳ add `ANTHROPIC_API_KEY` to `.env.local` + Vercel (deploy step).
- [x] `lib/ai/client.ts` — `server-only`, lazy `anthropic` (no build crash when key absent).
- [x] `lib/ai/models.ts` — `CHAT_MODEL='claude-haiku-4-5-20251001'`, `GENERATION_MODEL='claude-sonnet-4-6'`.
- [x] `lib/ai/canonical-resume.ts` — Zod schema + `CanonicalResume` type + JSON schema + `canonicalResumeToMarkdown()`.
- [x] `lib/ai/parse-resume.ts` — `parseResumeText()` via Sonnet forced tool-call, Zod-revalidated.
- [x] Gate: `tsc --noEmit` clean, `lint` 0 errors, `build` passes; `client.ts` is `server-only`.

## Phase 1a — Resume → ATS pipeline (backend)  ✅ DONE
- [x] Add deps: `unpdf` (PDF), `mammoth` (DOCX), `docx` (.docx), `@react-pdf/renderer` (.pdf).
- [x] Migration `20260622100000_resume_pipeline.sql`: `resume_documents` + owner RLS; extend
      `candidate_assets.asset_type` CHECK with `resume_docx` (+ fix missing `debate_audio`).  ⏳ run on prod.
- [x] `lib/resume/extract-text.ts` (dispatch on MIME), `render-docx.ts`, `render-pdf.tsx`, `store-asset.ts`, `generate.ts`.
- [x] `app/api/resume/parse/route.ts` (Node runtime) — extract → parse → upsert `resume_documents` draft.
- [x] `app/api/resume/generate/route.ts` (Node runtime) — render docx+pdf → store assets → status ready.
- [x] Gate: `tsc` clean, `lint` 0 errors, `build` passes (react-pdf/unpdf/docx compile on Next 16).

## Phase 1b — Resume → ATS pipeline (assets UI)  ✅ DONE
- [x] `app/(candidate)/dashboard/assets/resume-actions.ts` — `generateResume`, `saveAndRegenerateResume` (re-parse edited markdown → regenerate), `approveResume`.
- [x] `components/candidate/ResumeBuilderCard.tsx` at top of `dashboard/assets` (any-format dropzone → /api/resume/parse, Markdown editor, Save & regenerate, PDF/Word download, Approve).
- [x] Wire `assets/page.tsx` to load active `resume_documents` + signed download URLs.
- [x] Gate: `tsc` clean, `lint` 0 errors, `build` passes.
- Note: regeneration is an explicit **"Save & regenerate"** button (not autosave) to avoid a Sonnet call per blur.

## Phase 1c — Onboarding entry point
- [ ] Make `onboarding/page.tsx` a 2-step candidate flow (role → résumé upload → `/dashboard/assets?review=<id>`); employers skip step 2.
- [ ] Ensure candidate `candidate_profiles` row exists before the résumé upload (parse route requires it).

## Phase 2 — Profile changes
- [ ] Migration: `candidate_profiles.additional_context TEXT` (≤2000 CHECK).
- [ ] Extend `ProfileInput` Zod + `updateCandidateProfile` + `PROFILE_COLUMNS` + `CandidateProfile` type.
- [ ] `ProfileEditor.tsx`: clone Headline section for Additional Context.
- [ ] `lib/ai/derive-profile.ts` — Sonnet → `{headline, summary_bullets}` (≤200/≤7).
- [ ] `approveResume` → derive → stash in `resume_documents.derived_suggestions` → return.
- [ ] `components/candidate/ProfileSuggestionModal.tsx` (review/confirm → existing `updateCandidateProfile`).
- [ ] Gate + E2E: context persists/caps; approval → suggestion modal (not silent); accept survives refresh.

## Phase 3 — Labels  (global searchable + capped personal non-searchable; both sides)
- [ ] Migration `*_labels.sql`: `labels` (scope/name/color/is_searchable, invariant CHECK) +
      `label_assignments` (polymorphic) + RLS (global read-all/admin-write; personal owner; assignments scoped to target).
- [ ] `lib/labels/constants.ts` (`MAX_PERSONAL_LABELS=20`) + `lib/labels/actions.ts`
      (`createPersonalLabel` w/ cap, `delete`, `assignLabel`, `unassignLabel`).
- [ ] `app/(admin)/admin/labels/actions.ts` + "Global Labels" panel on admin page (admin-gated).
- [ ] Parameterize `components/ui/combobox.tsx` for multiselect (or thin toggle picker).
- [ ] `components/labels/LabelPicker.tsx` + `LabelBadges.tsx`.
- [ ] Candidate side: picker on profile + assets. Employer side: picker/badges on `CandidateGrid`/`CandidateBoard` + global-labels filter.
- [ ] Gate + E2E: cap enforced; personal not searchable; global searchable; RLS isolation.

## Phase 4 — Elite add-ons (later)
- [ ] JD-tailored résumé variant (new `resume_documents` row).
- [ ] ATS score / gap check (Haiku vs pasted JD).
- [ ] Auto-seed career-AI context fields at approval (review/confirm).
- [ ] Interview-prep pack in `dashboard/ai`.

## Cross-cutting
- [ ] Update `CLAUDE.md`: reverse the resume/ATS "do not build" guardrails, correct the schema block,
      document `lib/ai/` + resume pipeline + labels invariant/cap.
- [ ] Per phase: apply migration to prod → verify → deploy code.
