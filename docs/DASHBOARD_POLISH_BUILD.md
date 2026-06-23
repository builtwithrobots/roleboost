# RoleBoost Dashboard — Token + Motion Polish
**Version:** 1.0
**Date:** June 2026
**Purpose:** Drop this file into the repository root and reference it in Claude Code to apply the design token overhaul and Framer Motion layer to the candidate and employer dashboards.

---

## Context

Read `CLAUDE.md` before starting. This task is the dashboard shell and content components only. It does not touch the marketing homepage, auth flows, Supabase schema, API routes, or any server-side logic. All changes are visual and motion-only.

The goal is two things in one pass:
1. Replace the generic indigo/slate token palette in the dashboard with the exact RoleBoost brand tokens used on the marketing site (`FFFBF5`, `1E3A5F`, `D97706`, `F5F0E8`)
2. Add Framer Motion to the dashboard shell and content components at the same intensity as the marketing landing page

After this task the dashboard should feel like a continuation of the marketing site -- not a different product bolted on.

---

## What NOT to touch

Do not modify any of the following. If a change would require touching these, stop and ask.

- `app/globals.css` dark mode token block (`.dark { ... }`) -- dark mode stays as-is
- `components/landing/LandingPage.tsx` and all `components/marketing/` files -- already correct
- `lib/motion.ts` -- do not edit the existing marketing variants
- All API routes under `app/api/`
- All Supabase query logic
- All Clerk auth logic
- `components/employer/CandidateBoard.tsx` -- employer kanban board is excluded from motion (dropdowns must feel instant)
- Form field `<input>`, `<textarea>`, `<select>` elements inside `ProfileEditor` -- no stagger on form fields, forms must feel immediate
- Database schema, migrations, or environment variables

---

## Part 1 -- Design Token Overhaul

### File: `app/globals.css`

Edit the `:root` light mode block only. Replace the values listed below with the new values. Touch nothing else in the file.

The indigo/violet brand palette is being replaced with the RoleBoost marketing palette throughout the dashboard. The logic: `--rb-brand` becomes Amber (the marketing CTA and accent color), Deep Navy replaces slate for primary text, and all surface/border tokens shift from cool-toned slate to warm-toned values that match the marketing page backgrounds.

| Token | Old value | New value | Reason |
|---|---|---|---|
| `--rb-bg-page` | `#F8FAFC` | `#F5F0E8` | Warm Gray -- matches marketing alternating section bg |
| `--rb-bg-sidebar` | `#FFFFFF` | `#FFFBF5` | Warm White -- matches marketing card surface |
| `--rb-bg-surface-raised` | `#F1F5F9` | `#F5F0E8` | Warm hover state, not cool slate |
| `--rb-bg-surface-sunken` | `#E2E8F0` | `#EDE7DC` | Warm inset areas |
| `--rb-text` | `#0F172A` | `#1E3A5F` | Deep Navy -- marketing primary text color |
| `--rb-text-secondary` | `#475569` | `#4B6580` | Muted navy, not cool slate-600 |
| `--rb-text-muted` | `#94A3B8` | `#8FA3B8` | Placeholder, stays readable |
| `--rb-text-brand` | `#4F46E5` | `#92400E` | Amber-800 -- readable on amber-50 backgrounds |
| `--rb-border` | `#E2E8F0` | `#E8E0D4` | Warm-toned border matching marketing card borders |
| `--rb-border-strong` | `#CBD5E1` | `#D4C8B8` | Warm emphasis border |
| `--rb-border-brand` | `#A5B4FC` | `#FCD34D` | Amber border for tip boxes and brand-accented elements |
| `--rb-border-focus` | `#4F46E5` | `#D97706` | Focus ring follows brand amber |
| `--rb-brand` | `#4F46E5` | `#D97706` | Amber -- marketing CTA and accent color |
| `--rb-brand-hover` | `#4338CA` | `#B45309` | Amber dark -- marketing button hover |
| `--rb-brand-subtle` | `#EEF2FF` | `#FEF3C7` | Amber-50 -- tip boxes and subtle tints |
| `--rb-brand-gradient` | `linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)` | `linear-gradient(135deg, #D97706 0%, #B45309 100%)` | Amber gradient |

Leave `--rb-bg-surface` (`#FFFFFF`), `--rb-bg-modal`, `--rb-bg-input`, `--rb-text-inverse`, `--rb-player-*`, `--rb-overlay`, `--rb-scrim`, and all dark mode tokens exactly as they are.

After editing, run `npm run build` to confirm no broken references.

---

## Part 2 -- New File: Dashboard Motion Variants

### File: `lib/motion-dashboard.ts` (CREATE)

Create this file. Do not edit `lib/motion.ts`. The dashboard variants are tuned for a tool used every day -- subtler Y displacement and tighter stagger than the marketing page, but same easing and energy.

```ts
// lib/motion-dashboard.ts
// v1.0.0
// Framer Motion variants for the RoleBoost dashboard shell and content components.
// Separate from lib/motion.ts (marketing page variants) -- do not merge.
// All variants respect prefers-reduced-motion via useReducedMotion() at the call site.

import type { Variants } from 'motion/react'

// Page-level entrance -- every dashboard page fades and lifts on mount.
// Subtler Y than marketing (12px vs 24px) -- tool UX, not storytelling.
export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
}

// Stagger container -- wraps grids of cards.
// 60ms child delay is tighter than marketing's 100ms -- faster tool feel.
export const cardStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
}

// Individual card entrance -- used as children of cardStagger.
export const cardEnter: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
}

// Save/status indicator -- used with AnimatePresence for inline status text.
// Slides in from left on enter, slides out to left on exit.
export const statusSlide: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
  },
}

// Upload state swap -- used with AnimatePresence mode="wait" for icon/status transitions.
export const uploadStateFade: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
  },
}
```

---

## Part 3 -- New File: DashboardPage Wrapper Component

### File: `components/layout/DashboardPage.tsx` (CREATE)

Create this client component. It wraps every dashboard page's content in the `pageEnter` variant. By centralising the entrance animation here, all current and future dashboard pages get it with one import -- no copy-paste.

```tsx
// components/layout/DashboardPage.tsx
// v1.0.0
// Wraps every dashboard page content area with the standard entrance animation.
// Usage: wrap the outermost <div> or <main> returned by each dashboard page.
// Server Components pass children through -- this is the only client boundary needed.
'use client'

import { motion, useReducedMotion } from 'motion/react'
import { pageEnter } from '@/lib/motion-dashboard'

interface Props {
  children: React.ReactNode
  className?: string
}

export default function DashboardPage({ children, className }: Props) {
  const prefersReduced = useReducedMotion()

  return (
    <motion.div
      variants={pageEnter}
      initial={prefersReduced ? false : 'hidden'}
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

---

## Part 4 -- Shell Component Updates

### File: `components/ui/sidebar.tsx`

One change only. In `SidebarItem`, remove the active background fill from the `current` state. The animated left-edge bar (already present via `motion.span layoutId="current-indicator"`) is the correct visual indicator. A filled background on top of it looks generic.

Find this line in the `classes` string inside `SidebarItem`:

```
'data-current:bg-[--rb-bg-surface-raised] data-current:*:data-[slot=icon]:fill-[--rb-brand]'
```

Replace with:

```
'data-current:font-semibold data-current:text-[--rb-text] data-current:*:data-[slot=icon]:fill-[--rb-brand]'
```

This removes the fill, keeps the amber icon on the active item, and adds slight weight to the active label text. Everything else in `sidebar.tsx` stays exactly as-is. The `layoutId="current-indicator"` motion bar already handles the visual anchor.

### File: `components/layout/SubscriptionBadge.tsx`

Update the `free` tier badge className only:

```ts
// Before
free: { label: 'Free', className: 'bg-[--rb-bg-surface-raised] text-[--rb-text-secondary]' },

// After
free: { label: 'Free', className: 'bg-[#FEF3C7] text-[#92400E]' },
```

Leave all other tier configs (`pro`, `starter`, `growth`, `scale`) exactly as they are.

---

## Part 5 -- Apply DashboardPage Wrapper to All Pages

Import `DashboardPage` and wrap the outermost returned element in each of the following pages. The Server Component data fetching above the return statement is not touched -- only the JSX return value is wrapped.

**Candidate pages:**
- `app/(candidate)/dashboard/profile/page.tsx`
- `app/(candidate)/dashboard/assets/page.tsx`
- `app/(candidate)/dashboard/share/page.tsx`
- `app/(candidate)/dashboard/analytics/page.tsx`
- `app/(candidate)/dashboard/feedback/page.tsx`
- `app/(candidate)/dashboard/ai/page.tsx`

**Employer pages:**
- `app/(employer)/dashboard/candidates/page.tsx`
- `app/(employer)/dashboard/board/page.tsx`
- `app/(employer)/dashboard/jobs/page.tsx`
- `app/(employer)/dashboard/team/page.tsx`

Pattern for each page (example using assets page):

```tsx
// Before
return (
  <div className="min-h-full bg-[--rb-bg-page]">
    {/* content */}
  </div>
)

// After
import DashboardPage from '@/components/layout/DashboardPage'

return (
  <DashboardPage className="min-h-full bg-[--rb-bg-page]">
    {/* content */}
  </DashboardPage>
)
```

---

## Part 6 -- Content Component Motion

### File: `app/(candidate)/dashboard/assets/page.tsx`

Two changes:

**1. Progress bar -- promote to motion spring**

Find the progress bar fill div:

```tsx
// Before
<div
  className="h-full bg-[--rb-brand] rounded-full transition-all duration-500"
  style={{ width: `${(uploadedCount / ASSET_TYPES.length) * 100}%` }}
/>
```

Replace with:

```tsx
// After
import { motion } from 'motion/react'

<motion.div
  className="h-full bg-[--rb-brand] rounded-full"
  initial={{ width: 0 }}
  animate={{ width: `${(uploadedCount / ASSET_TYPES.length) * 100}%` }}
  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
/>
```

**2. Asset grid -- add stagger**

Wrap the asset grid container and individual cards:

```tsx
// Before
<div className="mx-auto max-w-5xl px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
  {ASSET_TYPES.map((type) => (
    <AssetUploadCard key={type} ... />
  ))}
</div>

// After
import { motion, useReducedMotion } from 'motion/react'
import { cardStagger, cardEnter } from '@/lib/motion-dashboard'

// Inside the component, declare:
const prefersReduced = useReducedMotion()

// Wrap the grid:
<motion.div
  className="mx-auto max-w-5xl px-6 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
  variants={cardStagger}
  initial={prefersReduced ? false : 'hidden'}
  animate="visible"
>
  {ASSET_TYPES.map((type) => (
    <motion.div key={type} variants={cardEnter}>
      <AssetUploadCard ... />
    </motion.div>
  ))}
</motion.div>
```

Note: `assets/page.tsx` is currently a Server Component. Adding `useReducedMotion` requires converting it to a client component with `'use client'` OR extracting the animated grid into a separate `AssetsGrid` client component and keeping the page as a Server Component for data fetching. Prefer the extracted client component pattern to preserve Server Component data fetching.

### File: `components/candidate/AssetUploadCard.tsx`

Add `AnimatePresence` to the upload state icon/status area. The card already tracks `uploadState` as `'idle' | 'uploading' | 'success' | 'error'`. Wrap the conditional icon block with `AnimatePresence mode="wait"` and apply the `uploadStateFade` variant so the icon transitions smoothly between states instead of snapping.

```tsx
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { uploadStateFade } from '@/lib/motion-dashboard'

// Inside the component:
const prefersReduced = useReducedMotion()

// Wrap the icon/status conditional block:
<AnimatePresence mode="wait">
  <motion.div
    key={uploadState}
    variants={uploadStateFade}
    initial={prefersReduced ? false : 'hidden'}
    animate="visible"
    exit="exit"
  >
    {uploadState === 'uploading' && <Loader2 ... />}
    {uploadState === 'success' && <CheckCircle2 ... />}
    {uploadState === 'error' && <AlertCircle ... />}
    {uploadState === 'idle' && <Upload ... />}
  </motion.div>
</AnimatePresence>
```

### File: `components/candidate/ProfileEditor.tsx`

Replace the CSS opacity toggle on the save status indicator with `AnimatePresence` + `statusSlide`.

Find the save status display block (currently uses `opacity-0`/`opacity-100` CSS classes):

```tsx
// Before (approximate -- match the actual structure in the file)
<span className={`text-xs transition-opacity duration-200 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'}`}>
  {saveStatus === 'saving' && 'Saving…'}
  {saveStatus === 'saved' && '✓ Saved'}
  {saveStatus === 'error' && 'Save failed'}
</span>
```

Replace with:

```tsx
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { statusSlide } from '@/lib/motion-dashboard'

// Inside the component:
const prefersReduced = useReducedMotion()

// Replace the status span:
<AnimatePresence mode="wait">
  {saveStatus !== 'idle' && (
    <motion.span
      key={saveStatus}
      variants={statusSlide}
      initial={prefersReduced ? false : 'hidden'}
      animate="visible"
      exit="exit"
      className="text-xs"
    >
      {saveStatus === 'saving' && (
        <span className="text-[--rb-text-muted]">Saving…</span>
      )}
      {saveStatus === 'saved' && (
        <span className="text-[--color-success]">✓ Saved</span>
      )}
      {saveStatus === 'error' && (
        <span className="text-[--color-error]">Save failed</span>
      )}
    </motion.span>
  )}
</AnimatePresence>
```

### File: `components/employer/CandidateGrid.tsx`

Add card stagger to the employer candidate grid. The grid maps `filtered` candidates into cards at line 235.

```tsx
import { motion, useReducedMotion } from 'motion/react'
import { cardStagger, cardEnter } from '@/lib/motion-dashboard'

// Inside the component:
const prefersReduced = useReducedMotion()

// Before
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {filtered.map((c) => (
    <CandidateCard key={c.savedId} candidate={c} />
  ))}
</div>

// After
<motion.div
  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
  variants={cardStagger}
  initial={prefersReduced ? false : 'hidden'}
  animate="visible"
>
  {filtered.map((c) => (
    <motion.div key={c.savedId} variants={cardEnter}>
      <CandidateCard candidate={c} />
    </motion.div>
  ))}
</motion.div>
```

---

## Verification Checklist

Run these after all changes are complete, in order.

```bash
npx tsc --noEmit        # Zero type errors required before proceeding
npm run lint            # Zero lint errors required before proceeding
npm run build           # Production build must succeed
```

Then verify visually:

- [ ] Dashboard page background is warm gray (`#F5F0E8`), not cool blue-gray
- [ ] Sidebar background is warm white (`#FFFBF5`), distinct from the content area
- [ ] Active nav item has NO background fill -- only the amber left-edge bar and slightly bolder text
- [ ] Active nav item bar is amber (`#D97706`), not indigo
- [ ] Logo box background is amber (resolves from `--rb-brand`)
- [ ] User avatar in sidebar footer is amber
- [ ] Free tier badge is amber-toned (`#FEF3C7` bg, `#92400E` text)
- [ ] All buttons that use `bg-[--rb-brand]` are now amber, not indigo
- [ ] Progress bar on assets page animates smoothly with spring easing
- [ ] Asset cards stagger in on assets page load
- [ ] Save status in ProfileEditor slides in and out instead of snapping
- [ ] Upload state icon in AssetUploadCard fades between states
- [ ] Candidate grid in employer dashboard staggers in on load
- [ ] All dashboard pages fade and lift on route change
- [ ] Test with `prefers-reduced-motion: reduce` in browser devtools -- all motion must stop

---

## Notes for Claude Code

- `motion/react` is already installed (used by the marketing landing page). No new dependencies.
- `useReducedMotion` must be called at the top of every component that uses motion. Never skip it.
- Never use `@ts-ignore` or `any` to work around TypeScript issues -- ask if stuck.
- The `--rb-brand` token change from indigo to amber will cascade through many components automatically. This is intentional. Do not revert individual components back to hardcoded indigo values.
- If any component currently hardcodes `#4F46E5` or `#4338CA` directly (not via token), update those to `#D97706` / `#B45309` respectively.
- Commit all changes together as a single commit: `feat: dashboard token overhaul + motion polish v1.0`
