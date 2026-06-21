'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp, staggerContainer } from '@/lib/motion'

export default function ProblemSection() {
  const prefersReduced = useReducedMotion()
  const headingRef = useRef<HTMLDivElement>(null)
  const columnsRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef<HTMLDivElement>(null)

  const headingInView = useInView(headingRef, { once: true, margin: '-80px' })
  const columnsInView = useInView(columnsRef, { once: true, margin: '-80px' })
  const closingInView = useInView(closingRef, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-[#FFFBF5]" aria-labelledby="problem-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          ref={headingRef}
          variants={fadeUp}
          initial="hidden"
          animate={prefersReduced || headingInView ? 'visible' : 'hidden'}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2
            id="problem-heading"
            className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug"
          >
            AI broke hiring. For everyone.
          </h2>
        </motion.div>

        {/* Two-column problem copy */}
        <motion.div
          ref={columnsRef}
          variants={staggerContainer}
          initial="hidden"
          animate={prefersReduced || columnsInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto mb-16"
        >
          <motion.div variants={fadeUp}>
            <h3 className="font-jakarta text-lg font-semibold text-[#1E3A5F] mb-4">
              For candidates
            </h3>
            <p className="font-inter text-lg text-gray-700 leading-relaxed">
              Candidates use AI to write resumes. Every resume sounds the same. The best people get
              filtered out by keyword algorithms before a human ever sees their name.
            </p>
          </motion.div>

          <motion.div variants={fadeUp}>
            <h3 className="font-jakarta text-lg font-semibold text-[#1E3A5F] mb-4">
              For employers
            </h3>
            <p className="font-inter text-lg text-gray-700 leading-relaxed">
              Hiring managers are buried under thousands of identical applications. LinkedIn sees
              11,000 submissions every minute. The signal is gone. The screening call backlog never
              ends.
            </p>
          </motion.div>
        </motion.div>

        {/* Closing statement */}
        <motion.div
          ref={closingRef}
          variants={fadeUp}
          initial="hidden"
          animate={prefersReduced || closingInView ? 'visible' : 'hidden'}
          className="text-center"
        >
          <p className="font-jakarta text-2xl md:text-3xl font-bold text-[#1E3A5F]">
            The resume is dead. We built what comes next.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
