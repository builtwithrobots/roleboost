name: ui-ux-pro-max

description: Comprehensive UI/UX design intelligence for web and mobile applications. Use when designing new pages, creating UI components, choosing color schemes, reviewing UI code for accessibility, implementing navigation structures, or any task involving how features look, feel, move, or are interacted with. Covers 50+ styles, 161 color palettes, 57 font pairings, 161 product types with reasoning rules, 99 UX guidelines, and 25 chart types across 10 technology stacks.

# UI/UX Pro Max — Design Intelligence

Comprehensive design guide for web and mobile applications. Apply this skill whenever a task involves how something looks, feels, moves, or is interacted with.

## When to Apply

**Must use:**
- Designing new pages or screens
- Creating UI components
- Choosing color schemes or typography
- Reviewing UI code for accessibility
- Implementing navigation structures

**Recommended:**
- Refactoring existing UI for consistency
- Adding animations or transitions
- Implementing forms or data tables

**Skip for:**
- Pure backend/API work with no UI surface
- Database migrations
- CI/CD configuration

## Rule Categories by Priority

| Priority | Category | Impact |
|----------|----------|--------|
| 1 | Accessibility | CRITICAL |
| 2 | Touch & Interaction | CRITICAL |
| 3 | Performance | HIGH |
| 4 | Style Selection | HIGH |
| 5 | Layout & Responsive | HIGH |
| 6 | Typography & Color | MEDIUM |
| 7 | Animation | MEDIUM |
| 8 | Forms & Feedback | MEDIUM |
| 9 | Navigation Patterns | HIGH |
| 10 | Charts & Data | LOW |

## 1. Accessibility (CRITICAL)

- Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text (WCAG AA)
- All interactive elements keyboard accessible with visible focus indicators
- Meaningful alt text on all images; decorative images use `alt=""`
- ARIA roles match actual component behavior; prefer native HTML elements
- `lang` attribute set on `<html>`
- No reliance on color alone to convey information

## 2. Touch & Interaction (CRITICAL)

- Minimum 44×44px touch targets (Apple HIG) / 48×48dp (Material Design)
- Minimum 8px spacing between adjacent touch targets
- Tap feedback on all interactive elements
- Swipe gestures never the only way to perform an action

## 3. Performance (HIGH)

- Images: WebP/AVIF with fallbacks, correct `srcset`, lazy load below fold
- LCP < 2.5s, INP < 200ms, CLS < 0.1
- Defer non-critical JS; avoid render-blocking resources
- `content-visibility: auto` for long lists

## 4. Style Selection (HIGH)

- Choose ONE aesthetic direction and commit to it
- Available styles: minimalist, maximalist, brutalist, editorial, luxury, retro-futuristic, organic, industrial, art deco, soft/pastel, playful, and 40+ more
- Avoid clichés: Inter + purple gradient = AI slop
- Every design should be context-specific and unrepeatable

## 5. Layout & Responsive (HIGH)

- Mobile-first; no horizontal scroll at any viewport
- Consistent spacing rhythm using a scale (4px, 8px, 16px, 24px, 40px, 64px)
- Grid-breaking and asymmetric layouts are encouraged for distinction
- Sticky headers max 60px on mobile

## 6. Typography & Color (MEDIUM)

- Use semantic color tokens (CSS variables), never hardcoded hex in components
- Distinctive font pairing: display font + body font. Avoid Inter, Roboto, Arial, Space Grotesk
- Line length 45–75 characters for body text
- Type scale: base 16px, use a modular scale (1.25 or 1.333 ratio)

## 7. Animation (MEDIUM)

- Duration: 150–300ms for UI transitions; 400–600ms for page transitions
- Use `transform` and `opacity` only — never animate `width`, `height`, `top`, `left`
- Respect `prefers-reduced-motion`
- One orchestrated entrance > scattered micro-interactions

## 8. Forms & Feedback (MEDIUM)

- Visible labels always (no placeholder-only labels)
- Inline error messages adjacent to the field, not just at top of form
- Loading states on all async actions
- Success/error feedback within 100ms of user action

## 9. Navigation Patterns (HIGH)

- Mobile bottom nav: max 5 items
- Deep link every navigable state
- Breadcrumbs for 3+ level hierarchies
- Back button always predictable

## 10. Charts & Data (LOW)

- Accessible color palettes (not red/green alone)
- Always include a legend
- Responsive: charts reflow or scroll on mobile
- Empty states designed, not blank

## Workflow

1. **Extract requirements**: product type, audience, style keywords, technical constraints
2. **Commit to aesthetic direction**: name it, describe it in one sentence
3. **Define design system**: CSS variables first, then components
4. **Apply stack-specific patterns**: React, Next.js, Vue, SwiftUI, etc.
5. **Run pre-delivery checklist** before completing

## Pre-Delivery Checklist

### Visual Quality
- [ ] Distinctive, context-appropriate aesthetic (not generic AI output)
- [ ] Consistent spacing rhythm throughout
- [ ] Typography hierarchy clear at a glance
- [ ] Color palette cohesive with sufficient contrast

### Interaction
- [ ] All interactive elements have hover/focus/active states
- [ ] Touch targets ≥ 44×44px
- [ ] Loading and error states implemented
- [ ] Keyboard navigation works end-to-end

### Layout
- [ ] No horizontal scroll at 320px, 768px, 1280px viewports
- [ ] Content readable without horizontal scrolling
- [ ] Images have explicit dimensions (no CLS)

### Accessibility
- [ ] Contrast ratios pass WCAG AA
- [ ] Focus indicators visible
- [ ] Screen reader labels present
- [ ] No color-only information conveyance

## Stack-Specific Notes

**Next.js / React**: Use `next/image` for all images. Use CSS Modules or Tailwind with CSS variables. Prefer Server Components for static UI, Client Components only for interactivity.

**Tailwind CSS**: Define brand tokens in `tailwind.config.js` mapping to CSS variables. Use `@layer components` for repeated patterns. Never use arbitrary values for brand colors.

**shadcn/ui**: Use primitives as base; style via Tailwind utilities. Check `components/ui/` before importing. Respect the variant system.
