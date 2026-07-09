'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { fadeUp } from '@/lib/motion'
import { FEATURED_PERSONAS } from '@/lib/boosts/personas'

/**
 * "More examples" banner on /boosts. A row of persona cards spanning a range of
 * careers and career states, each linking to that candidate's own shareable
 * Boosts page (/boosts/[slug]). Jordan Mills is the featured example inline on
 * the page itself, so he is not repeated here.
 */
export default function BoostsExamplesBanner() {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-20 bg-[#F5F0E8]" aria-labelledby="boosts-examples-banner-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          variants={fadeUp}
          initial="hidden"
          animate={prefersReduced || inView ? 'visible' : 'hidden'}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.12em] text-[#D97706] mb-3">
            More examples
          </p>
          <h2
            id="boosts-examples-banner-heading"
            className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug mb-4"
          >
            A Boost for every kind of career
          </h2>
          <p className="font-inter text-lg text-gray-700 leading-relaxed">
            From the shop floor to the C-suite, and every turn in between. See how Boosts tell the
            story a resume flattens, whatever the career and wherever it stands.
          </p>
        </motion.div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURED_PERSONAS.map((persona, i) => (
            <motion.li
              key={persona.slug}
              variants={fadeUp}
              initial="hidden"
              animate={prefersReduced || inView ? 'visible' : 'hidden'}
              transition={{ delay: prefersReduced ? 0 : 0.05 * (i + 1) }}
            >
              <Link
                href={`/boosts/${persona.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-[#E8E0D0] bg-[#FFFBF5] p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D4C8B8] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F0E8]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="flex items-center justify-center w-12 h-12 rounded-full text-white font-jakarta text-base font-bold shrink-0"
                    style={{ backgroundColor: persona.avatarColor }}
                    aria-hidden="true"
                  >
                    {persona.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="font-jakarta text-base font-bold text-[#1E3A5F] leading-tight truncate">
                      {persona.name}
                    </p>
                    <p className="font-inter text-sm text-gray-600 truncate">{persona.role}</p>
                  </div>
                </div>

                <span className="mb-4 flex w-fit items-center rounded-full bg-[#FEF3C7] px-3 py-1 font-jakarta text-xs font-semibold text-[#92400E]">
                  {persona.careerStage}
                </span>

                <span className="mt-auto inline-flex items-center gap-1.5 font-jakarta text-sm font-semibold text-[#B45309]">
                  View example
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
