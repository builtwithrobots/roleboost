'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp, staggerContainer, scaleIn } from '@/lib/motion'

const candidateItems = [
  'Who viewed your profile and what they asked',
  'The full AI conversation transcript',
  'Pattern insights: which questions come up most',
  'A direct link to refine your AI answers',
]

const employerItems = [
  'Full transcript of every question asked',
  'Direct link to the candidate\'s full profile',
  'One-click save to their candidate pipeline',
  'Option to send direct feedback',
]

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-shrink-0 text-[#D97706] mt-0.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function TranscriptLoop() {
  const prefersReduced = useReducedMotion()
  const headingRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  const headingInView = useInView(headingRef, { once: true, margin: '-80px' })
  const cardsInView = useInView(cardsRef, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-[#FFFBF5]" aria-labelledby="transcript-heading">
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
            id="transcript-heading"
            className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug mb-4"
          >
            The first feedback loop in hiring history.
          </h2>
          <p className="font-inter text-lg text-gray-600 leading-relaxed">
            Every recruiter conversation is logged and delivered by email to both sides,
            immediately. Candidates learn exactly what recruiters are curious about. Recruiters get a
            full transcript with a direct link to save the candidate or send feedback.
          </p>
        </motion.div>

        {/* Two cards */}
        <motion.div
          ref={cardsRef}
          variants={staggerContainer}
          initial="hidden"
          animate={prefersReduced || cardsInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
        >
          {/* Candidate card, navy left border */}
          <motion.div
            variants={scaleIn}
            className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] border-l-4 border-l-[#1E3A5F] shadow-sm p-8"
          >
            <h3 className="font-jakarta text-xl font-semibold text-[#1E3A5F] mb-6">You receive</h3>
            <ul className="space-y-4">
              {candidateItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckIcon />
                  <span className="font-inter text-base text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Employer card, amber left border */}
          <motion.div
            variants={scaleIn}
            className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] border-l-4 border-l-[#D97706] shadow-sm p-8"
          >
            <h3 className="font-jakarta text-xl font-semibold text-[#1E3A5F] mb-6">They receive</h3>
            <ul className="space-y-4">
              {employerItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckIcon />
                  <span className="font-inter text-base text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
