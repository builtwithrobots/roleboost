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
