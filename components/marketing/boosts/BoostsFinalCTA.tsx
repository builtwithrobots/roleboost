'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { fadeUp } from '@/lib/motion'

export default function BoostsFinalCTA() {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-[#FFFBF5]" aria-labelledby="boosts-cta-heading">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          variants={fadeUp}
          initial="hidden"
          animate={prefersReduced || inView ? 'visible' : 'hidden'}
          className="text-center"
        >
          <h2
            id="boosts-cta-heading"
            className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug mb-6"
          >
            Ready for Boosts of your own?
          </h2>

          <div className="max-w-xl mx-auto space-y-3 mb-10">
            <p className="font-inter text-lg text-gray-700 leading-relaxed">
              If you are job hunting: upload your resume and get Boosts that make hiring managers stop
              and pay attention.
            </p>
            <p className="font-inter text-lg text-gray-700 leading-relaxed">
              If you are hiring: send one link and let every Boost do the briefing for you.
            </p>
          </div>

          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
          >
            Get Started Free
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
