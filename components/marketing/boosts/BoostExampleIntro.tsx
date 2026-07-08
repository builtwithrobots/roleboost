'use client'

import { useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp } from '@/lib/motion'
import ResumeModal from './ResumeModal'

export default function BoostExampleIntro() {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [resumeOpen, setResumeOpen] = useState(false)

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
          {/* Top row: section label + ATS Resume trigger */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.12em] text-[#D97706]">
              The example
            </p>
            <button
              type="button"
              onClick={() => setResumeOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-2 rounded-lg border border-[#D97706] bg-transparent px-4 py-2 font-jakarta text-sm font-semibold text-[#B45309] hover:bg-[#FEF3C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              ATS Resume
            </button>
          </div>

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
              <span className="mt-2 inline-flex items-center rounded-full bg-[#FEF3C7] px-3 py-1 font-jakarta text-xs font-semibold text-[#92400E]">
                Retail Banking | Early Career
              </span>
            </div>
          </div>

          <p className="font-inter text-base text-gray-700 leading-relaxed">
            Entry-level retail banking, two years in, strong performance numbers, no degree. Jordan is
            exactly the kind of candidate a resume flattens. Here is what Jordan looks and sounds like
            through three Boosts.
          </p>
        </motion.div>
      </div>

      <ResumeModal open={resumeOpen} onClose={() => setResumeOpen(false)} />
    </section>
  )
}
