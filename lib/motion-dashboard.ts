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
