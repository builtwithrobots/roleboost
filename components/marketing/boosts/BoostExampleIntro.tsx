'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp } from '@/lib/motion'

export default function BoostExampleIntro() {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-16 bg-[#F5F0E8]" aria-labelledby="boosts-example-heading">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          variants={fadeUp}
          initial="hidden"
          animate={prefersReduced || inView ? 'visible' : 'hidden'}
          className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-6 sm:p-8"
        >
          <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.12em] text-[#D97706] mb-4">
            The example
          </p>

          <div className="flex items-center gap-4 mb-5">
            {/* Avatar: Jordan Mills initials, teal per candidate brand */}
            <span
              className="flex items-center justify-center w-14 h-14 rounded-full bg-[#0F6E56] text-white font-jakarta text-lg font-bold shrink-0"
              aria-hidden="true"
            >
              JM
            </span>
            <div>
              <h2
                id="boosts-example-heading"
                className="font-jakarta text-xl font-bold text-[#1E3A5F] leading-snug"
              >
                Jordan Mills
              </h2>
              <p className="font-inter text-sm text-gray-600">
                Customer Service Representative, aiming for Customer Service Team Lead, Phoenix, AZ
              </p>
            </div>
          </div>

          <p className="font-inter text-base text-gray-700 leading-relaxed">
            Entry-level retail banking, two years in, strong performance numbers, no degree. Jordan is
            exactly the kind of candidate a resume flattens. Here is what Jordan looks and sounds like
            through three Boosts.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
