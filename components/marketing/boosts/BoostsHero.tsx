'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

export default function BoostsHero() {
  const prefersReduced = useReducedMotion()
  const baseDelay = prefersReduced ? 0 : undefined

  return (
    <section className="py-24 bg-[#FFFBF5]" aria-labelledby="boosts-hero-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <motion.p
            className="font-jakarta text-xs font-semibold uppercase tracking-[0.12em] text-[#D97706] mb-4"
            initial={prefersReduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: baseDelay ?? 0 }}
          >
            Boosts
          </motion.p>

          <motion.h1
            id="boosts-hero-heading"
            className="font-jakarta text-4xl md:text-5xl font-extrabold text-[#1E3A5F] leading-tight mb-6"
            initial={prefersReduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: baseDelay ?? 0.1 }}
          >
            Three Boosts. One unforgettable candidate.
          </motion.h1>

          <motion.p
            className="font-inter text-lg text-gray-700 leading-relaxed max-w-2xl mx-auto mb-10"
            initial={prefersReduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: baseDelay ?? 0.2 }}
          >
            A Boost is an AI-generated career asset built from your real experience. Each one gives a
            hiring manager a different way to get you fast: see you, hear you, and hear you discussed.
            Below are three real Boosts made for one candidate.
          </motion.p>

          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: baseDelay ?? 0.3 }}
          >
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
            >
              Get Started Free
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
