# RoleBoost Marketing Site — Claude Code Build Prompt
**Version:** 1.4
**Date:** June 2026
**Purpose:** Drop this file into Claude Code to build the roleboost.app marketing homepage.

---

## Context

Read CLAUDE.md before starting. This task is the public-facing marketing homepage only. It does not touch the candidate dashboard, employer dashboard, auth flows, or any Supabase/Clerk/Paddle integration. This is a standalone Next.js page at `app/page.tsx`.

**Brand:**
- Name: RoleBoost
- Domain: roleboost.app
- One-line pitch: "Your career. Your AI. Finally heard."
- Brand colors: Navy (#1E3A5F) and Gold (#B8860B)
- Background: White (#FFFFFF) with light gray (#F9FAFB) alternating sections
- Primary text: Near-black (#111827)
- Font: Inter (already available via Next.js font optimization)

---

## Design System

This section defines the exact visual language for the entire page. Follow it precisely. Every decision below is derived from studying Loom (loom.com) and Homerun (homerun.co) -- two best-in-class light-mode SaaS marketing sites targeting professional hiring audiences. Do not deviate from these values without a strong reason.

### Philosophy

The two reference sites share the same core principles:
- **Whitespace is the design.** Sections breathe. Content is never cramped. When in doubt, add more padding.
- **The product is the hero.** Real UI screenshots and mock interfaces outperform stock photography every time. Show what RoleBoost actually looks like.
- **Bold headlines, quiet body copy.** Section headings are large and confident. Body text is comfortable and readable, never competing with headings for attention.
- **One action per section.** Every section has one primary CTA. Never two competing buttons at the same visual weight.
- **Clean over clever.** No decorative gradients, no glassmorphism, no drop shadows on everything. Restraint is the brand.

---

### Color Tokens

Use these exact values as Tailwind arbitrary values (`text-[#1E3A5F]`) or extend the Tailwind config if preferred. Do not substitute approximations.

| Token | Name | Hex | Tailwind Usage |
|---|---|---|---|
| Primary | Deep Navy | `#1E3A5F` | Headings, nav, badges, step numbers, card borders |
| Accent | Amber | `#D97706` | CTA buttons, highlight borders, checkmarks, tag labels |
| Base | Warm White | `#FFFBF5` | Page base and card backgrounds -- use instead of pure white |
| Surface | Warm Gray | `#F5F0E8` | Alternating section backgrounds -- use instead of `bg-gray-50` |
| Border | Warm Border | `#E8E0D0` | Card borders, dividers -- use instead of `border-gray-200` |
| Body text | Near Black | `#111827` | All primary body copy |
| Secondary text | Warm Gray Text | `#6B7280` | Subheadings, descriptions, captions |
| Muted text | Light Gray | `#9CA3AF` | Fine print, placeholders |
| Navy hover | Navy Dark | `#162d4a` | Navy button hover state |
| Amber hover | Amber Dark | `#B45309` | Amber button hover state |

**Why this palette:** Deep navy anchors the brand with credibility and authority. Amber replaces the previous gold -- it is a darker, warmer tone that passes WCAG AA contrast checks on the warm white base (unlike the previous `#B8860B` which failed on white). The warm white and warm gray surfaces give the page a human, editorial feel that distinguishes RoleBoost from cold blue-and-white SaaS tools -- which is intentional. This platform was built by a person who has done the work, and the palette should reflect that warmth.

**Contrast rule:** Amber (`#D97706`) on warm white (`#FFFBF5`) passes 4.5:1 contrast for normal text -- it is safe to use for functional text and buttons. Never use the previous `#B8860B` value anywhere. Never place secondary text (`#6B7280`) on any surface darker than `#F5F0E8`.

---

### Typography Scale

Two fonts. Plus Jakarta Sans for all headings -- it has more personality and confidence than Inter while remaining completely professional. Inter for all body copy -- maximally readable at small sizes. Both are free and load via `next/font/google`.

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

Apply `${jakarta.variable} ${inter.variable}` to the `<body>` className, then use `font-jakarta` and `font-inter` as Tailwind classes (extend the config accordingly).

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

### Spacing Scale

Loom and Homerun both use generous, consistent vertical rhythm. Follow this exactly.

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

### Button Styles

Every button on the page must use one of these four exact patterns. No variations.

**Primary (amber fill) -- main CTAs:**
```
className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
```

**Secondary (navy fill) -- secondary CTAs:**
```
className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#1E3A5F] text-white font-jakarta text-[15px] font-semibold hover:bg-[#162d4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
```

**Outline navy -- tertiary CTAs:**
```
className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-[#1E3A5F] text-[#1E3A5F] font-jakarta text-[15px] font-semibold hover:bg-[#1E3A5F] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
```

**Outline white -- used on dark navy backgrounds only:**
```
className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-white text-white font-jakarta text-[15px] font-semibold hover:bg-white hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E3A5F] transition-colors min-h-[44px]"
```

---

### Card Styles

Two card types are used on this page.

**Standard card:**
```
className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-8"
```

**Hover card (used in hero dual-path and asset suite):**
```
className="bg-[#FFFBF5] rounded-2xl border-2 border-[#1E3A5F] shadow-sm hover:shadow-md transition-shadow p-8"
```

**Accent card -- navy left border (transcript candidate card):**
```
className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-8 border-l-4 border-l-[#1E3A5F]"
```

**Accent card -- amber left border (transcript employer card):**
```
className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-8 border-l-4 border-l-[#D97706]"
```

**Featured card -- amber border (Personal Career AI asset card):**
```
className="bg-[#FFFBF5] rounded-2xl border-2 border-[#D97706] shadow-sm p-6"
```

---

### Section Wrapper Pattern

Every section uses this wrapper. Apply it consistently without exception.

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

### Section Heading Pattern

Every section heading block follows this exact structure. Apply it consistently.

```tsx
<div className="text-center max-w-3xl mx-auto mb-16">
  {/* Optional tag label -- only used when specified */}
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

### Icon Style

Use inline SVGs throughout. No external icon packages. All icons must:
- Be `24x24` by default, `32x32` or `40x40` for feature icons in cards
- Use `currentColor` for stroke/fill so color is controlled by the parent's `text-` class
- Have `aria-hidden="true"` since they are decorative (the surrounding text provides meaning)
- Use `strokeWidth={1.5}` for outline-style icons -- not filled, not too thin

Example pattern:
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

### Animation System (Framer Motion)

Framer Motion is used for all animation on this page. Install it with `npm install framer-motion` before writing any component code.

**Animation philosophy:**
- Motion should feel like gravity -- things ease in, never pop in or fly around
- Scroll-triggered animations only fire once per element (no re-triggering on scroll back up)
- Duration is short -- 0.4s to 0.6s maximum. Anything longer feels sluggish
- Respect `prefers-reduced-motion` -- wrap all motion components with the `useReducedMotion` hook and skip animation if true
- Never animate color, font-size, or border-radius -- only opacity, y position, and scale

---

**Reusable animation variants -- define these once in `lib/motion.ts` and import everywhere:**

```ts
// lib/motion.ts
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

---

**Scroll trigger wrapper -- use this pattern for every section:**

```tsx
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { fadeUp } from '@/lib/motion'

// Wrap the section content (not the <section> tag itself) in this pattern
const ref = useRef(null)
const isInView = useInView(ref, { once: true, margin: '-80px' })

<motion.div
  ref={ref}
  variants={fadeUp}
  initial="hidden"
  animate={isInView ? 'visible' : 'hidden'}
>
  {/* content */}
</motion.div>
```

---

**Section-by-section animation spec:**

**Nav:** No animation. Stays static. Sticky behavior via CSS only.

**Hero section:**
- Headline: `fadeUp`, delay 0s
- Subheadline: `fadeUp`, delay 0.15s
- Candidate card: `fadeUp`, delay 0.25s
- Employer card: `fadeUp`, delay 0.35s
- Use `motion.h1`, `motion.p`, `motion.div` with explicit `initial` / `animate` (not scroll-triggered -- fires on page load)

**Social proof bar:**
- Three stats: `staggerContainer` parent, `fadeUp` children, stagger 0.12s
- Scroll-triggered

**Problem section:**
- Heading: `fadeUp`, scroll-triggered
- Two columns: `staggerContainer` with `fadeUp` children, 0.15s stagger

**Asset suite (8 cards):**
- Parent grid: `staggerContainer`
- Each card: `scaleIn` variant, stagger 0.08s
- Scroll-triggered
- On hover: `whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}` on each card's `motion.div`

**How It Works -- Candidate and Employer:**
- Step number badges: `scaleIn`, stagger 0.15s between steps
- Step text: `fadeUp`, stagger 0.15s, slight delay after badge
- Connecting line: `fadeIn`, fires after badges appear

**AI Chatbot Spotlight:**
- Left column copy: `fadeUp`, scroll-triggered
- Mock chat UI right column: `fadeUp` with 0.2s delay relative to left column
- Chat messages inside the mock UI: stagger in one at a time with 0.3s delay between each message bubble, using `fadeUp` -- this gives the impression the conversation is loading in

**Transcript loop cards:**
- Two cards: `staggerContainer`, `scaleIn` children, 0.15s stagger

**Pricing cards:**
- Candidate card: `fadeUp`, scroll-triggered
- Three employer cards: `staggerContainer`, `scaleIn`, 0.1s stagger

**Done For You section:**
- Two path cards: `staggerContainer`, `fadeUp`, 0.15s stagger
- Package table rows: `staggerContainer`, `fadeIn`, 0.06s stagger

**Final CTA:**
- Heading: `fadeUp`
- Subheading: `fadeUp`, 0.15s delay
- Buttons: `fadeUp`, 0.25s delay
- All fire on scroll-trigger

**Footer:** No animation.

---

**Button hover animations -- apply to all buttons:**

```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15 }}
  className="..." // existing button className
>
```

Note: wrap `next/link` CTA buttons using `motion(Link)` pattern:
```tsx
import { motion } from 'framer-motion'
import Link from 'next/link'

const MotionLink = motion(Link)

<MotionLink
  href="/sign-up"
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15 }}
  className="..."
>
  Get Started Free
</MotionLink>
```

---

**Reduced motion -- apply this in every animated component:**

```tsx
import { useReducedMotion } from 'framer-motion'

const prefersReduced = useReducedMotion()

// Then pass to animate:
animate={prefersReduced ? 'visible' : (isInView ? 'visible' : 'hidden')}
```

This skips all animation for users who have enabled "reduce motion" in their OS accessibility settings. Non-negotiable for WCAG compliance.

---

### What Loom Does That We Are Copying

1. **Product UI as the visual.** Loom never uses lifestyle photography. The UI is the image. For RoleBoost, the mock chat interface in Section 8 and any product screenshots carry all the visual weight. Make them look polished and real.

2. **Minimal nav.** Loom's nav has a logo, 3-4 links, and one button. Ours matches this exactly. No mega-menus, no dropdowns, no utility links cluttering the bar.

3. **Stats as trust signals, not testimonials.** Loom leads with numbers. We do the same in the social proof bar -- big stat, small description, clean dividers.

4. **Generous section padding.** Loom uses 96px vertical padding on major sections. It feels luxurious and professional. We match this with `py-24` throughout.

5. **Single-column prose at controlled width.** Loom never lets body copy stretch full-width. All prose is capped at `max-w-2xl` or `max-w-3xl`. We follow the same rule.

---

### What Homerun Does That We Are Copying

1. **Dual-path hero.** Homerun addresses two audiences (job seekers and employers) directly from the hero with separate CTAs. Our dual-path card approach is drawn from this pattern.

2. **Bold headline, quiet subheadline.** Homerun leads with a punchy problem-statement headline ("Declutter your inbox. Organize your hiring.") and a calm supporting sentence. Our hero and section headings follow this ratio -- big and bold up top, measured and informative below.

3. **Product screenshots early.** Homerun shows what the dashboard looks like before anything else. The mock chat UI in Section 8 and the step-by-step product descriptions in Sections 6 and 7 serve this same function.

4. **Simple pricing with clear tiers.** Homerun's pricing page uses a monthly/annual toggle, clear tier names, and a short feature list per tier. Our pricing section mirrors this structure exactly.

5. **Social proof as numbers, not quotes.** Homerun leads with Capterra ratings, monthly hire counts, and satisfaction scores before showing any testimonial quotes. We use the same approach in the social proof bar.

---

## First Task Before Writing Any Code

Before building anything, write the entire Design System section above out to `design-system/roleboost/MASTER.md`. Create the file and any missing directories. Overwrite if the file already exists.

The file should contain everything under the "Design System" heading above -- philosophy, color tokens, typography scale, spacing scale, button styles, card styles, section wrapper pattern, section heading pattern, icon style, animation system, and both reference sections ("What Loom Does" and "What Homerun Does").

Format it as a standalone markdown file with this header:

```
# RoleBoost Design System — MASTER
**Version:** 1.0
**Last updated:** June 2026
**Source of truth for all RoleBoost UI decisions. Read this before building any page or component.**
```

Once the file is written, proceed to building the homepage.

---

## What to Build

A single polished marketing homepage at `app/page.tsx` with a matching layout component. No routing changes. One new dependency required: `framer-motion` (install before writing any component code).

The page must be:
- Fully responsive (mobile-first)
- WCAG 2.1 AA accessible from the ground up (minimum 44px touch targets, 4.5:1 contrast, keyboard navigable, meaningful alt text, semantic HTML)
- Built with Tailwind CSS only for styling -- no additional UI libraries
- Animated with Framer Motion per the Animation System spec in the Design System section
- TypeScript strict mode -- no `any`, no `@ts-ignore`
- Static -- no server actions, no database calls, no auth checks on this page

---

## Page Sections -- Build in This Order

### 1. Navigation (`components/marketing/Nav.tsx`)

- Logo left: "RoleBoost" wordmark in navy, bold
- Three nav links center or right: "How It Works", "Pricing", "For Employers"
- One CTA button far right: "Get Started Free" -- gold background, white text, links to `/sign-up`
- Sticky on scroll
- Mobile: hamburger menu that opens a full-width dropdown with all links and the CTA button
- Background: white with a subtle bottom border (`border-b border-gray-100`)

---

### 2. Hero Section

**Headline (large, bold, navy):**
> "Your career, finally heard. Your next hire, finally found."

**Subheadline (gray, medium weight):**
> "RoleBoost replaces the resume with a rich AI-powered candidate profile -- audio, video, infographic, slide deck, and a personal career AI that answers recruiter questions 24/7."

**Dual-path cards (two side-by-side cards, full-width on mobile stacked):**

Card 1 -- Candidate:
- Icon: microphone or person silhouette (use an inline SVG or Heroicon)
- Heading: "I'm looking for my next role"
- Body: "Upload your resume. Get a complete AI-powered career profile. Share one link."
- CTA button: "Build My Profile Free" -- links to `/sign-up`

Card 2 -- Employer:
- Icon: briefcase or magnifying glass
- Heading: "I'm hiring for my team"
- Body: "Find candidates, chat with their career AI, and manage your pipeline -- all in one place."
- CTA button: "Start Hiring Free" -- links to `/sign-up`

Both cards: white background, navy border, subtle shadow, rounded corners (`rounded-2xl`). On hover: slight shadow lift. Min height 44px on all interactive elements.

**Background:** White. Generous top/bottom padding.

---

### 3. Social Proof Bar

Thin full-width strip, light gray background (`bg-gray-50`), centered content.

Display these three stats in a horizontal row (stacked on mobile):

- "20+ Years" / "Operations & logistics expertise behind every profile"
- "99.99%" / "Order accuracy -- the standard we hold our candidates to"
- "Built by someone who has sat on both sides of the hiring table"

Style: Stat number in large navy bold text. Description in small gray text below. Separated by vertical dividers on desktop.

---

### 4. Problem Section

**Section heading (navy, centered):**
> "AI broke hiring. For everyone."

**Body copy (two columns on desktop, single column on mobile, dark gray, comfortable line height):**

Column 1 -- Candidates:
> "Candidates use AI to write resumes. Every resume sounds the same. The best people get filtered out by keyword algorithms before a human ever sees their name."

Column 2 -- Employers:
> "Hiring managers are buried under thousands of identical applications. LinkedIn sees 11,000 submissions every minute. The signal is gone. The screening call backlog never ends."

**Centered closing line (navy, slightly larger, bold):**
> "The resume is dead. We built what comes next."

Background: White.

---

### 5. The Asset Suite -- "One Link. Every Version of You."

**Section heading:**
> "One link. Every version of you."

**Subheading:**
> "Upload your resume and career context. RoleBoost produces a complete professional asset suite -- then gives you a personal career AI that works for you around the clock."

**Card grid (2 columns on mobile, 4 columns on desktop):**

Build 8 cards, one per asset type. Each card has:
- A simple inline SVG icon (use basic shapes -- no external icon library needed)
- Asset name (bold, navy)
- One-line description (gray)

Asset cards:
1. Audio Overview -- "2-3 min podcast-style career narrative. Perfect for commuters."
2. Debate Audio -- "A hiring committee debates your candidacy. Handles objections before they're asked."
3. Video Overview -- "90-second cinematic career story for visual reviewers."
4. Slide Deck -- "Structured career presentation for detail-oriented hiring managers."
5. Career Infographic -- "Visual timeline and key stats. Built for skimmers."
6. ATS Resume -- "Clean, keyword-optimized resume that clears applicant tracking systems."
7. AI Bullet Summary -- "5-7 career highlights for the 10-second first impression."
8. Personal Career AI -- "A 24/7 chatbot trained on your career data. Recruiters ask it anything."

Card style: white background, light gray border, rounded corners, subtle shadow. The Personal Career AI card gets a gold border to make it stand out as the marquee feature.

Background: Light gray (`bg-gray-50`).

---

### 6. How It Works -- Candidate

**Section heading:**
> "For job seekers: your story, told the way it deserves to be."

**3-step visual flow (horizontal on desktop, vertical on mobile):**

Step 1:
- Number badge: "1" in navy circle
- Heading: "Upload your resume and career context"
- Body: "Answer a few deep questions about your wins, your leadership style, and what makes you different. Takes about 20 minutes."

Step 2:
- Number badge: "2" in navy circle
- Heading: "Get your complete asset suite"
- Body: "RoleBoost produces your audio overview, video, infographic, slide deck, AI summary, and ATS resume -- all from one upload."

Step 3:
- Number badge: "3" in navy circle
- Heading: "Share one link. Let your AI do the talking."
- Body: "Paste your RoleBoost link anywhere. Employers click it, explore your assets, and chat with your career AI -- before they ever schedule a call."

Steps connected by a horizontal line (desktop) or vertical line (mobile) between the number badges.

Below the steps, a single centered CTA:
- Button: "Build My Profile Free" -- gold background, white text, links to `/sign-up`
- Small text below: "Free forever for candidates."

Background: White.

---

### 7. How It Works -- Employer

**Section heading:**
> "For hiring teams: know your candidates before the first call."

**3-step visual flow (same treatment as candidate section):**

Step 1:
- Number badge: "1"
- Heading: "Receive a candidate's RoleBoost link"
- Body: "Candidates share their link in applications, email signatures, and LinkedIn. Click it and a rich profile modal opens instantly."

Step 2:
- Number badge: "2"
- Heading: "Explore their full career narrative"
- Body: "Listen to their audio overview, watch their video, review their infographic and slide deck -- in the format that works for you."

Step 3:
- Number badge: "3"
- Heading: "Chat with their career AI"
- Body: "Ask the candidate's AI anything -- their leadership style, why they left their last role, how they handled their toughest challenge. Get instant answers, 24/7."

Below the steps, a single centered CTA:
- Button: "Start Hiring Free" -- gold background, white text, links to `/sign-up`
- Small text below: "Free tier available. No credit card required."

Background: Light gray (`bg-gray-50`).

---

### 8. AI Chatbot Feature Spotlight

This section is a full-width feature callout. It gets more visual weight than the other sections.

**Layout:** Two columns on desktop. Left column is copy. Right column is a mock chat UI.

**Left column:**

Tag label (small, gold text, gold border, pill shape): "The Game Changer"

Heading (large, navy):
> "A personal career AI, available to recruiters 24/7."

Body:
> "Every RoleBoost candidate gets a career AI trained on their specific data. Recruiters chat with it directly from the candidate's profile -- no scheduling, no waiting, no screening call required."

Three bullet points with checkmark icons (gold checkmarks):
- "Answers questions in the candidate's voice, from their real career data"
- "Full conversation transcript delivered by email to both sides"
- "Candidates fine-tune their AI based on what recruiters actually ask"

CTA: "See How It Works" -- navy outline button, links to `#how-it-works` (smooth scroll anchor on the candidate section)

**Right column -- mock chat UI:**

Build a static visual that looks like a chat interface. Use a white card with a subtle shadow and rounded corners. Include:

- Header: Small avatar (navy circle with initials "MW") + "Marcus Wheeler's Career AI" + "Online" green dot
- Three mock messages alternating user/AI:

  User bubble (gray, right-aligned):
  > "How did you scale operations 3X in 90 days at Complemar?"

  AI bubble (navy, left-aligned):
  > "That expansion required moving fast without breaking what was working. I started by mapping every constraint in the current flow, then built parallel processes for the incoming volume before the cutover. We hired and trained 14 people in 3 weeks and ran dual operations for 10 days to validate. The key was having the SOPs written before the first new hire showed up."

  User bubble:
  > "Why did you leave that role?"

  AI bubble:
  > "The expansion I was brought in to execute was complete. The site was stable, the team was self-managing, and my value was in building -- not maintaining. I look for environments where the next hard thing is waiting."

- Footer text (small gray): "Powered by RoleBoost AI"

Background: Navy (`bg-[#1E3A5F]`) to make this section stand out visually. Adjust text colors accordingly -- white/light for the left column copy.

---

### 9. Transcript Loop Section

**Section heading (centered, navy):**
> "The first feedback loop in hiring history."

**Body (centered, max-width prose, gray):**
> "Every recruiter conversation is logged and delivered by email to both sides -- immediately. Candidates learn exactly what recruiters are curious about. Recruiters get a full transcript with a direct link to save the candidate or send feedback."

**Two cards side by side (stacked on mobile):**

Card 1 -- Candidate gets:
- Heading: "You receive"
- List items:
  - Who viewed your profile and what they asked
  - The full AI conversation transcript
  - Pattern insights: which questions come up most
  - A direct link to refine your AI answers

Card 2 -- Employer gets:
- Heading: "They receive"
- List items:
  - Full transcript of every question asked
  - Direct link to the candidate's full profile
  - One-click save to their candidate pipeline
  - Option to send direct feedback

Card style: white background, light border, rounded corners. Candidate card gets a navy left border accent. Employer card gets a gold left border accent.

Background: White.

---

### 10. Pricing Section

**Section heading:**
> "Simple pricing. Candidates are always free."

**Layout:** Two groups separated visually.

**Group 1 -- Candidates (single card, centered, max-width 480px):**

Card:
- Label: "For Job Seekers"
- Price: "$0 / forever"
- Subtext: "Every candidate gets the full suite. No credit card. No trial. No catch."
- Feature list:
  - Full profile with all 7 asset types
  - Shareable link, QR code, and profile badge
  - Personal career AI chatbot
  - Transcript delivery after every recruiter conversation
  - AI fine-tuning interface
- CTA button: "Build My Profile Free" -- gold, full width

**Group 2 -- Employers (3 cards in a row, stacked on mobile):**

Heading above: "For Hiring Teams"

Card 1 -- Free:
- Price: "$0"
- Features: 5 saved candidates, 1 job posting, AI chat with candidates, transcript delivery
- CTA: "Get Started Free" -- navy outline

Card 2 -- Starter ($49/mo): -- add a "Most Popular" badge in gold
- Price: "$49/mo"
- Features: Everything free, plus 50 saved candidates, 5 job postings, candidate notes, transcript history in dashboard
- CTA: "Start Free Trial" -- gold filled

Card 3 -- Growth ($99/mo):
- Price: "$99/mo"
- Features: Everything Starter, plus unlimited candidates, unlimited postings, team collaboration, chat analytics
- CTA: "Start Free Trial" -- navy outline

Add a small toggle above the employer cards: "Monthly / Annual (save 20%)" -- the toggle is visual only for now, no logic needed, just renders the monthly prices.

Below all cards, small centered text:
> "Scale plan at $249/mo available for enterprise teams. Contact us for details."

Background: Light gray (`bg-gray-50`).

---

### 11. Done For You Section

**Section heading:**
> "Want us to build it for you?"

**Body:**
> "Not ready to DIY? We build RoleBoost profiles for candidates directly -- the same way we built our own. Specialized in operations, logistics, and warehouse leadership. Available through Fiverr or direct."

**Two paths side by side (stacked on mobile):**

Path 1 -- Fiverr:
- Icon: external link icon
- Heading: "Order on Fiverr"
- Body: "Browse our packages, see examples, and order with Fiverr's built-in buyer protection."
- CTA: "View Fiverr Packages" -- gold button, target `_blank`, href is a placeholder `#` for now (Rob will add the real Fiverr URL)

Path 2 -- Direct:
- Icon: envelope or chat icon
- Heading: "Work with us directly"
- Body: "Prefer to skip Fiverr? Reach out directly and we'll find the right package for your background."
- CTA: "Contact Us" -- navy outline button, href is a placeholder `#` for now (contact method TBD)

**Package summary (below the two paths, a simple 4-column table or card row):**

| Package | Price | What's Included |
|---|---|---|
| Starter | $49 | ATS resume + AI summary + profile setup |
| Standard | $99 | Everything + audio overview + infographic |
| Pro | $197 | Full suite including debate audio |
| Elite | $397 | Everything + 30 min career interview + AI chatbot setup |

Style the table cleanly -- alternating row backgrounds, navy header row with white text.

Background: White.

---

### 12. Final CTA Section

Full-width section, navy background.

**Heading (white, large, centered):**
> "Your story deserves to be told the way it deserves to be told."

**Subheading (light blue-gray, centered):**
> "Join RoleBoost free. Build your profile in under an hour. Share one link that gives hiring managers everything they need."

**Two buttons centered:**
- "Build My Profile Free" -- gold background, white text, links to `/sign-up`
- "I'm Hiring" -- white outline, white text, links to `/sign-up`

---

### 13. Footer (`components/marketing/Footer.tsx`)

Simple, clean.

- Left: RoleBoost wordmark + "The world's first AI-powered candidate intelligence platform."
- Center: Links -- How It Works / Pricing / For Employers / Contact
- Right: "Built by Rob Ramos -- 20+ years in operations and logistics."
- Bottom bar: "© 2026 RoleBoost. All rights reserved." + Privacy Policy + Terms of Service (links to `#` placeholders)

Background: Near-black (`bg-gray-900`). Text: white and gray.

---

## Component File Structure

Create these files:

```
lib/
  motion.ts                         # Shared Framer Motion variants

app/
  page.tsx                          # Imports and assembles all sections

components/
  marketing/
    Nav.tsx
    HeroSection.tsx
    SocialProofBar.tsx
    ProblemSection.tsx
    AssetSuite.tsx
    HowItWorksCandidate.tsx
    HowItWorksEmployer.tsx
    AIChatbotSpotlight.tsx
    TranscriptLoop.tsx
    PricingSection.tsx
    DoneForYouSection.tsx
    FinalCTA.tsx
    Footer.tsx
```

Each component is a default export. `app/page.tsx` imports them all in order and renders them.

---

## Accessibility Requirements (Non-Negotiable)

- All images and icons must have descriptive `alt` text or `aria-label`
- All buttons must have visible focus rings (`focus-visible:ring-2 focus-visible:ring-offset-2`)
- All interactive elements minimum 44px height/width
- Color contrast minimum 4.5:1 for normal text, 3:1 for large text
- Nav must be keyboard navigable with visible focus states
- Mobile hamburger menu must trap focus when open and close on ESC
- Pricing toggle must be keyboard operable with proper `role="switch"` and `aria-checked`
- Section headings use proper semantic hierarchy (h1 in hero, h2 for section headings, h3 for card headings)
- No information conveyed by color alone

---

## Do Not Build

- Any Supabase queries or database connections
- Any Clerk auth components (other than linking to `/sign-up`)
- Any Paddle payment integration
- Any API routes
- The actual contact form functionality (placeholder only)
- Any npm packages beyond `framer-motion` -- ask first if something else seems needed

---

## After Building

1. Run `npm run build` and confirm zero errors
2. Run `npx tsc --noEmit` and confirm zero type errors
3. Run `npm run lint` and confirm zero lint errors
4. Commit with message: `feat: marketing homepage v1.0`
5. Push to GitHub -- Vercel will auto-deploy

---

## Notes for Claude Code

- Run `npm install framer-motion` before writing any component code
- Load both `Plus_Jakarta_Sans` and `Inter` via `next/font/google` in `app/layout.tsx` -- see the Typography Scale section for the exact config
- Extend `tailwind.config.ts` to add `font-jakarta` and `font-inter` as font family utilities pointing to the CSS variables from the font config
- Set the `<body>` background to `bg-[#FFFBF5]` (warm white) -- not the default white -- so the base surface matches the palette throughout
- Create `lib/motion.ts` first and import variants from it everywhere -- do not define animation variants inline in components
- Use Tailwind utility classes throughout -- no custom CSS files
- Use `next/link` for all internal links, wrapped with `motion(Link)` when hover animation is needed
- The mock chat UI in section 8 is a static visual -- no real API calls -- but animate the message bubbles staggering in per the animation spec
- All placeholder `href="#"` links are intentional -- Rob will update them
- Do not install any npm packages other than `framer-motion` without asking first
- If something is ambiguous, default to the simpler implementation and leave a `// TODO:` comment
- Always apply `useReducedMotion` in every animated component -- this is required for WCAG compliance
