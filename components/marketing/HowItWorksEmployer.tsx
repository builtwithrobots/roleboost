'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp, scaleIn, fadeIn, staggerContainer } from '@/lib/motion'
import Link from 'next/link'

const steps = [
  {
    number: '1',
    heading: 'Receive a candidate\'s RoleBoost link',
    body: 'Candidates share their link in applications, email signatures, and LinkedIn. Click it and a rich profile modal opens instantly.',
  },
  {
    number: '2',
    heading: 'Explore their full career narrative',
    body: 'Listen to their audio overview, watch their video, review their infographic and slide deck, in the format that works for you.',
  },
  {
    number: '3',
    heading: 'Chat with their career AI',
    body: 'Ask the candidate\'s AI anything, their leadership style, why they left their last role, how they handled their toughest challenge. Get instant answers, 24/7.',
  },
]

export default function HowItWorksEmployer() {
  const prefersReduced = useReducedMotion()
  const headingRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)

  const headingInView = useInView(headingRef, { once: true, margin: '-80px' })
  const stepsInView = useInView(stepsRef, { once: true, margin: '-80px' })
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' })

  return (
    <section
      id="for-employers"
      className="py-24 bg-[#F5F0E8]"
      aria-labelledby="employer-how-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          ref={headingRef}
          variants={fadeUp}
          initial="hidden"
          animate={prefersReduced || headingInView ? 'visible' : 'hidden'}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2
            id="employer-how-heading"
            className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug"
          >
            For hiring teams: know your candidates before the first call.
          </h2>
        </motion.div>

        {/* Steps */}
        <motion.div
          ref={stepsRef}
          variants={staggerContainer}
          initial="hidden"
          animate={prefersReduced || stepsInView ? 'visible' : 'hidden'}
          className="relative max-w-4xl mx-auto mb-16"
        >
          {/* Connecting line (desktop) */}
          <motion.div
            variants={fadeIn}
            className="hidden md:block absolute top-6 left-[calc(16.67%-1px)] right-[calc(16.67%-1px)] h-px bg-[#E8E0D0]"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col md:items-center md:text-center">
                <motion.div
                  variants={scaleIn}
                  className="flex-shrink-0 w-12 h-12 rounded-full bg-[#1E3A5F] flex items-center justify-center mb-4 z-10"
                  aria-hidden="true"
                >
                  <span className="font-jakarta text-base font-bold text-white">{step.number}</span>
                </motion.div>
                <motion.div variants={fadeUp}>
                  <h3 className="font-jakarta text-lg font-semibold text-[#1E3A5F] mb-2">
                    {step.heading}
                  </h3>
                  <p className="font-inter text-base text-gray-600 leading-relaxed">{step.body}</p>
                </motion.div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          ref={ctaRef}
          variants={fadeUp}
          initial="hidden"
          animate={prefersReduced || ctaInView ? 'visible' : 'hidden'}
          className="text-center"
        >
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F0E8] transition-colors min-h-[44px]"
          >
            Start Hiring Free
          </Link>
          <p className="font-inter text-sm text-gray-500 mt-3">
            Free tier available. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
