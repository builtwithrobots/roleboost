# 08 — Assets, Résumé & Storage

## Storage model

All buckets are **private**; nothing is ever a public URL. Access is via
short-lived signed URLs generated server-side.

- Buckets: `candidate-audio`, `candidate-video`, `candidate-documents`,
  `candidate-images` (`20260704000000_storage_buckets.sql`).
- Path convention: `{clerk_user_id}/{timestamp}-{sanitized-filename}`.
- Storage RLS: a user can only touch objects under their own id prefix
  (`(storage.foldername(name))[1] = requesting_user_id()`).
- `lib/storage/signed-urls.ts` → `getSignedAssetUrl(bucket, path)`, **1-hour TTL**,
  generated at page-render time. The client receives pre-signed URLs and never
  calls Storage directly.

## Upload (`app/api/assets/upload/route.ts`)

Clerk-authenticated. Verifies the `candidate_profile_id` belongs to the caller,
validates **both** MIME type and extension (anti-spoof), enforces per-type size
limits (audio 50MB, video 500MB, images 5–10MB, docs 25MB), writes to the bucket
at the path convention, and inserts a `candidate_assets` row with `is_active =
true` — deactivating the prior active asset of the same type. Asset types:
`audio`, `debate_audio`, `video`, `deck`, `infographic`, `avatar`, `resume`,
`resume_docx`.

## Résumé pipeline

The résumé is special: it is both a downloadable asset **and** the source of the
brain's `<career_information>`.

```
Upload PDF/DOCX/TXT
  → extractResumeText()            lib/resume/extract-text.ts  (unpdf / mammoth / decode)
  → parseResumeText()              lib/ai/parse-resume.ts      (Sonnet, forced tool → CanonicalResume, Zod-validated)
  → upsert resume_documents        canonical_json + canonical_markdown, status='draft'
  → deriveProfileFromResume()      best-effort pre-fill of empty profile fields
  ── candidate reviews / edits canonical_markdown ──
  → generateResumeDocuments()      lib/resume/generate.ts
        renderResumePdf()          lib/resume/render-pdf.tsx   (@react-pdf/renderer; ATS-friendly, selectable text)
        renderResumeDocx()         lib/resume/render-docx.ts   (docx lib)
        storeGeneratedAsset()      lib/resume/store-asset.ts   → candidate_assets ('resume' / 'resume_docx')
  → resume_documents.status='ready', links pdf_asset_id / docx_asset_id
```

Endpoints: `POST /api/resume/parse` and `POST /api/resume/generate`. All renderers
are pure-JS / serverless-safe (no native binaries). `canonical_markdown` is the
single résumé text the brain reads — there is no separate résumé column on the
profile.

`context_package_md` (the [career context document](./05-career-context-document.md))
is also surfaced on `/dashboard/assets` for upload/download via
`AssetPackageCard` + `package-actions.ts`; that upload path and the AI Studio
generate/select path write the **same** column.

## The public calling card (`app/c/[slug]/page.tsx`)

The core employer-facing experience — chat-first, no login, no page navigation.

- **Profile fetch** uses the anon client (RLS: `is_published`); OG metadata is
  built from the safe public columns.
- **Assets** are signed server-side (1-hour URLs) and handed to the client.
- **Layer 1 — the card** (`components/modal/CallingCard.tsx`): name, role,
  headline, and an open "Ask [name] anything" chat entry with suggested openers.
  If `ai_enabled` is false, it falls back to an offline message + LinkedIn.
- **Layer 2 — learn more**: summary bullets + `AssetGallery` (lazy tabs — audio,
  debate, video, deck, infographic, résumé — one renders at a time).
- **Chat** (`components/chat/ChatOverlay.tsx`): a focus-trapped, ESC-to-close,
  WCAG-compliant dialog (full-screen on mobile) that talks to `/api/chat`.

PWA support (`app/manifest.ts`, code-generated icons) and a native `ShareButton`
let recruiters add the card to their home screen and share the link onward.
Accessibility target across these surfaces is **WCAG 2.1 AA** (≥44px targets,
≥4.5:1 contrast, full keyboard nav, focus management).
