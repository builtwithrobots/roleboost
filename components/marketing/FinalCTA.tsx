'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp } from '@/lib/motion'
import Link from 'next/link'

export default function FinalCTA() {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-[#1E3A5F]" aria-labelledby="final-cta-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={ref} className="text-center max-w-3xl mx-auto">
          <motion.h2
            id="final-cta-heading"
            variants={fadeUp}
            initial="hidden"
            animate={prefersReduced || isInView ? 'visible' : 'hidden'}
            className="font-jakarta text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-snug mb-6"
          >
            Your story deserves to be told the way it deserves to be told.
          </motion.h2>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate={prefersReduced || isInView ? 'visible' : 'hidden'}
            transition={{ delay: prefersReduced ? 0 : 0.15 }}
            className="font-inter text-lg text-blue-200 leading-relaxed mb-10"
          >
            Join RoleBoost free. Build your profile in under an hour. Share one link that gives
            hiring managers everything they need.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate={prefersReduced || isInView ? 'visible' : 'hidden'}
            transition={{ delay: prefersReduced ? 0 : 0.25 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E3A5F] transition-colors min-h-[44px]"
            >
              Build My Profile Free
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center px-8 py-3 rounded-lg border-2 border-white text-white font-jakarta text-[15px] font-semibold hover:bg-white hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E3A5F] transition-colors min-h-[44px]"
            >
              I&apos;m Hiring
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
