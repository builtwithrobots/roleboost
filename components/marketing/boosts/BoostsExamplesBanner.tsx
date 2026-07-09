'use client'

import { useRef } from 'react'
import type { CSSProperties } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { fadeUp } from '@/lib/motion'
import { FEATURED_PERSONAS, type Persona } from '@/lib/boosts/personas'

// Section background; the edge-fade masks blend the moving strip into it.
const SECTION_BG = '#F5F0E8'

/** A single persona card. Duplicated (aria-hidden) copies feed the marquee loop. */
function PersonaCard({ persona, duplicate = false }: { persona: Persona; duplicate?: boolean }) {
  return (
    <li className="mr-5 w-72 shrink-0" aria-hidden={duplicate || undefined}>
      <Link
        href={`/boosts/${persona.slug}`}
        tabIndex={duplicate ? -1 : undefined}
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
    </li>
  )
}

/**
 * "More examples" banner on /boosts. The persona cards ride a slow, continuous
 * marquee, low-key motion that draws the eye without demanding attention.
 *
 * - The track holds two identical halves and animates to translateX(-50%), so
 *   it loops seamlessly (each card carries its own trailing margin, not a flex
 *   gap, so the wrap point is gap-perfect).
 * - It pauses on hover and on keyboard focus, so a visitor can read and click.
 * - The duplicate half is aria-hidden with untabbable links, so assistive tech
 *   and keyboard users see each persona once.
 * - Under prefers-reduced-motion it becomes a plain, manually scrollable row,
 *   so every card stays reachable without any movement.
 */
export default function BoostsExamplesBanner() {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-20 bg-[#F5F0E8] overflow-hidden" aria-labelledby="boosts-examples-banner-heading">
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
      </div>

      {prefersReduced ? (
        // Reduced motion: a plain, manually scrollable row. No movement.
        <ul className="flex overflow-x-auto py-3 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          {FEATURED_PERSONAS.map((persona) => (
            <PersonaCard key={persona.slug} persona={persona} />
          ))}
        </ul>
      ) : (
        // Continuous marquee. Edge fades blend the strip into the section.
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-24"
            style={{ backgroundImage: `linear-gradient(to right, ${SECTION_BG}, transparent)` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-24"
            style={{ backgroundImage: `linear-gradient(to left, ${SECTION_BG}, transparent)` }}
          />
          <ul
            className="rb-marquee flex w-max py-3 pl-4 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
            style={{ '--rb-marquee-duration': '60s' } as CSSProperties}
          >
            {FEATURED_PERSONAS.map((persona) => (
              <PersonaCard key={persona.slug} persona={persona} />
            ))}
            {FEATURED_PERSONAS.map((persona) => (
              <PersonaCard key={`dup-${persona.slug}`} persona={persona} duplicate />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
