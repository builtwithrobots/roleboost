'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp, scaleIn, fadeIn, staggerContainer } from '@/lib/motion'
import Link from 'next/link'

const steps = [
  {
    number: '1',
    heading: 'Upload your resume and career context',
    body: 'Answer a few deep questions about your wins, your leadership style, and what makes you different. Takes about 20 minutes.',
  },
  {
    number: '2',
    heading: 'Get your complete asset suite',
    body: 'RoleBoost produces your audio overview, video, infographic, slide deck, AI summary, and ATS resume — all from one upload.',
  },
  {
    number: '3',
    heading: 'Share one link. Let your AI do the talking.',
    body: 'Paste your RoleBoost link anywhere. Employers click it, explore your assets, and chat with your career AI — before they ever schedule a call.',
  },
]

export default function HowItWorksCandidate() {
  const prefersReduced = useReducedMotion()
  const headingRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)

  const headingInView = useInView(headingRef, { once: true, margin: '-80px' })
  const stepsInView = useInView(stepsRef, { once: true, margin: '-80px' })
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' })

  return (
    <section
      id="how-it-works"
      className="py-24 bg-[#FFFBF5]"
      aria-labelledby="candidate-how-heading"
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
            id="candidate-how-heading"
            className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug"
          >
            For job seekers: your story, told the way it deserves to be.
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
            {steps.map((step, index) => (
              <div key={step.number} className="flex flex-col md:items-center md:text-center">
                {/* Connecting line (mobile) */}
                {index < steps.length - 1 && (
                  <div
                    className="md:hidden absolute left-6 w-px bg-[#E8E0D0]"
                    style={{ top: `calc(${index * 33.33 + 4}% + 24px)`, height: '33.33%' }}
                    aria-hidden="true"
                  />
                )}
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
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
          >
            Build My Profile Free
          </Link>
          <p className="font-inter text-sm text-gray-500 mt-3">Free forever for candidates.</p>
        </motion.div>
      </div>
    </section>
  )
}
