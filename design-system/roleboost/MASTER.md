# RoleBoost Design System — MASTER
**Version:** 1.0
**Last updated:** June 2026
**Source of truth for all RoleBoost UI decisions. Read this before building any page or component.**

---

## Philosophy

The two reference sites (Loom and Homerun) share the same core principles:
- **Whitespace is the design.** Sections breathe. Content is never cramped. When in doubt, add more padding.
- **The product is the hero.** Real UI screenshots and mock interfaces outperform stock photography every time. Show what RoleBoost actually looks like.
- **Bold headlines, quiet body copy.** Section headings are large and confident. Body text is comfortable and readable, never competing with headings for attention.
- **One action per section.** Every section has one primary CTA. Never two competing buttons at the same visual weight.
- **Clean over clever.** No decorative gradients, no glassmorphism, no drop shadows on everything. Restraint is the brand.

---

## Color Tokens

Use these exact values as Tailwind arbitrary values (`text-[#1E3A5F]`) or extend the Tailwind config if preferred. Do not substitute approximations.

| Token | Name | Hex | Tailwind Usage |
|---|---|---|---|
| Primary | Deep Navy | `#1E3A5F` | Headings, nav, badges, step numbers, card borders |
| Accent | Amber | `#D97706` | CTA buttons, highlight borders, checkmarks, tag labels |
| Base | Warm White | `#FFFBF5` | Page base and card backgrounds — use instead of pure white |
| Surface | Warm Gray | `#F5F0E8` | Alternating section backgrounds — use instead of `bg-gray-50` |
| Border | Warm Border | `#E8E0D0` | Card borders, dividers — use instead of `border-gray-200` |
| Body text | Near Black | `#111827` | All primary body copy |
| Secondary text | Warm Gray Text | `#6B7280` | Subheadings, descriptions, captions |
| Muted text | Light Gray | `#9CA3AF` | Fine print, placeholders |
| Navy hover | Navy Dark | `#162d4a` | Navy button hover state |
| Amber hover | Amber Dark | `#B45309` | Amber button hover state |

**Why this palette:** Deep navy anchors the brand with credibility and authority. Amber replaces the previous gold — it is a darker, warmer tone that passes WCAG AA contrast checks on the warm white base (unlike the previous `#B8860B` which failed on white). The warm white and warm gray surfaces give the page a human, editorial feel that distinguishes RoleBoost from cold blue-and-white SaaS tools — which is intentional.

**Contrast rule:** Amber (`#D97706`) on warm white (`#FFFBF5`) passes 4.5:1 contrast for normal text — it is safe to use for functional text and buttons. Never use the previous `#B8860B` value anywhere. Never place secondary text (`#6B7280`) on any surface darker than `#F5F0E8`.

---

## Typography Scale

Two fonts. Plus Jakarta Sans for all headings. Inter for all body copy. Both load via `next/font/google`.

```ts
// app/layout.tsx font config
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['600', '700', '800'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600'],
  display: 'swap',
})
```

Apply `${jakarta.variable} ${inter.variable}` to the `<body>` className, then use `font-jakarta` and `font-inter` as Tailwind utility classes (defined in `@theme` in globals.css).

| Role | Font | Size | Weight | Color | Tailwind Classes |
|---|---|---|---|---|---|
| Page H1 (hero headline) | Jakarta | 48px / 56px desktop | 800 | Navy | `font-jakarta text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#1E3A5F] leading-tight` |
| Section H2 | Jakarta | 32px / 40px desktop | 700 | Navy | `font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug` |
| Card H3 | Jakarta | 20px | 600 | Navy | `font-jakarta text-xl font-semibold text-[#1E3A5F]` |
| Body (large) | Inter | 18px | 400 | Gray-700 | `font-inter text-lg text-gray-700 leading-relaxed` |
| Body (standard) | Inter | 16px | 400 | Gray-600 | `font-inter text-base text-gray-600 leading-relaxed` |
| Caption / fine print | Inter | 14px | 400 | Gray-500 | `font-inter text-sm text-gray-500` |
| Stat number | Jakarta | 36px | 700 | Navy | `font-jakarta text-4xl font-bold text-[#1E3A5F]` |
| Nav link | Inter | 15px | 500 | Gray-700 | `font-inter text-[15px] font-medium text-gray-700 hover:text-[#1E3A5F]` |
| Button text | Jakarta | 15px | 600 | White or Navy | `font-jakarta text-[15px] font-semibold` |
| Tag / pill label | Jakarta | 13px | 600 | Amber | `font-jakarta text-[13px] font-semibold text-[#D97706]` |

**Line length rule:** Body copy should never exceed `max-w-2xl` (672px) when centered. Two-column body copy should use `max-w-prose` per column. Never let lines of text stretch full-width on desktop.

---

## Spacing Scale

| Context | Value | Tailwind |
|---|---|---|
| Section top/bottom padding | 96px | `py-24` |
| Section top/bottom padding (compact) | 64px | `py-16` |
| Nav height | 64px | `h-16` |
| Card internal padding | 32px | `p-8` |
| Card internal padding (compact) | 24px | `p-6` |
| Gap between cards in a grid | 24px | `gap-6` |
| Gap between stacked elements inside a card | 16px | `space-y-4` |
| Max content width | 1280px | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |
| Centered prose max width | 672px | `max-w-2xl mx-auto` |

---

## Button Styles

Every button on the page must use one of these four exact patterns. No variations.

**Primary (amber fill) — main CTAs:**
```
className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
```

**Secondary (navy fill) — secondary CTAs:**
```
className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#1E3A5F] text-white font-jakarta text-[15px] font-semibold hover:bg-[#162d4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
```

**Outline navy — tertiary CTAs:**
```
className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-[#1E3A5F] text-[#1E3A5F] font-jakarta text-[15px] font-semibold hover:bg-[#1E3A5F] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
```

**Outline white — used on dark navy backgrounds only:**
```
className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-white text-white font-jakarta text-[15px] font-semibold hover:bg-white hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E3A5F] transition-colors min-h-[44px]"
```

---

## Card Styles

**Standard card:**
```
className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-8"
```

**Hover card (used in hero dual-path and asset suite):**
```
className="bg-[#FFFBF5] rounded-2xl border-2 border-[#1E3A5F] shadow-sm hover:shadow-md transition-shadow p-8"
```

**Accent card — navy left border (transcript candidate card):**
```
className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-8 border-l-4 border-l-[#1E3A5F]"
```

**Accent card — amber left border (transcript employer card):**
```
className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-8 border-l-4 border-l-[#D97706]"
```

**Featured card — amber border (Personal Career AI asset card):**
```
className="bg-[#FFFBF5] rounded-2xl border-2 border-[#D97706] shadow-sm p-6"
```

---

## Section Wrapper Pattern

```tsx
// Warm white background section (primary)
<section className="py-24 bg-[#FFFBF5]">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {/* content */}
  </div>
</section>

// Warm gray background section (alternating)
<section className="py-24 bg-[#F5F0E8]">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {/* content */}
  </div>
</section>

// Dark navy background section (Final CTA and AI Chatbot Spotlight only)
<section className="py-24 bg-[#1E3A5F]">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {/* content */}
  </div>
</section>
```

---

## Section Heading Pattern

```tsx
<div className="text-center max-w-3xl mx-auto mb-16">
  {/* Optional tag label — only used when specified */}
  <span className="inline-flex items-center px-3 py-1 rounded-full border border-[#D97706] text-[#D97706] font-jakarta text-[13px] font-semibold mb-4">
    Tag Label
  </span>
  <h2 className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug mb-4">
    Section Heading
  </h2>
  <p className="font-inter text-lg text-gray-600 leading-relaxed">
    Subheading or supporting copy.
  </p>
</div>
```

---

## Icon Style

Use inline SVGs throughout. No external icon packages. All icons must:
- Be `24x24` by default, `32x32` or `40x40` for feature icons in cards
- Use `currentColor` for stroke/fill so color is controlled by the parent's `text-` class
- Have `aria-hidden="true"` since they are decorative
- Use `strokeWidth={1.5}` for outline-style icons — not filled, not too thin

```tsx
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="32"
  height="32"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth={1.5}
  strokeLinecap="round"
  strokeLinejoin="round"
  aria-hidden="true"
  className="text-[#1E3A5F]"
>
  {/* path here */}
</svg>
```

---

## Animation System (Motion for React)

Motion for React (the `motion` package v12, formerly Framer Motion) is used for all animation. Import from `motion/react`.

**Animation philosophy:**
- Motion should feel like gravity — things ease in, never pop in or fly around
- Scroll-triggered animations only fire once per element (no re-triggering on scroll back up)
- Duration is short — 0.4s to 0.6s maximum
- Respect `prefers-reduced-motion` — use `useReducedMotion` hook and skip animation if true
- Never animate color, font-size, or border-radius — only opacity, y position, and scale

**Reusable animation variants (defined in `lib/motion.ts`):**

```ts
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
  }
}

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
}

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
  }
}
```

**Scroll trigger wrapper:**
```tsx
const ref = useRef(null)
const isInView = useInView(ref, { once: true, margin: '-80px' })

<motion.div
  ref={ref}
  variants={fadeUp}
  initial="hidden"
  animate={isInView ? 'visible' : 'hidden'}
>
```

**Reduced motion (apply in every animated component):**
```tsx
const prefersReduced = useReducedMotion()
animate={prefersReduced ? 'visible' : (isInView ? 'visible' : 'hidden')}
```

---

## What Loom Does That We Are Copying

1. **Product UI as the visual.** Loom never uses lifestyle photography. The UI is the image. For RoleBoost, the mock chat interface and product screenshots carry all the visual weight.
2. **Minimal nav.** Logo, 3-4 links, and one button. No mega-menus, no dropdowns, no utility links cluttering the bar.
3. **Stats as trust signals.** Big stat, small description, clean dividers. Leads with numbers, not testimonials.
4. **Generous section padding.** 96px vertical padding on major sections (`py-24`). It feels luxurious and professional.
5. **Single-column prose at controlled width.** All prose capped at `max-w-2xl` or `max-w-3xl`. Never full-width on desktop.

---

## What Homerun Does That We Are Copying

1. **Dual-path hero.** Two audiences (job seekers and employers) addressed directly from the hero with separate CTAs.
2. **Bold headline, quiet subheadline.** Punchy problem-statement headline, calm supporting sentence below.
3. **Product screenshots early.** Shows what the dashboard looks like before anything else.
4. **Simple pricing with clear tiers.** Monthly/annual toggle, clear tier names, short feature list per tier.
5. **Social proof as numbers.** Leads with metrics and satisfaction scores before showing any testimonial quotes.
