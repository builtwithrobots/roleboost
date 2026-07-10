'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

export interface HeroContent {
  kicker: string
  headlineLine1: string
  headlineLine2: string
  /** If the amber accent is mid-line, pass the full line here and put only the accented words in headlineLine2 */
  headlineLine2Plain?: string
  subheadline: string
  primaryCTA: string
  primaryHref: string
  secondaryCTA: string
  secondaryHref: string
  proofLine: string
}

interface AnimatedHeroTextProps {
  content: HeroContent
  variantIndex: number
  /** id for the h1 so the parent section can reference it via aria-labelledby */
  headingId?: string
}

function AccentedLine({ content }: { content: HeroContent }) {
  const { headlineLine2, headlineLine2Plain } = content
  if (!headlineLine2Plain) {
    return <span className="text-[#D97706]">{headlineLine2}</span>
  }
  const at = headlineLine2Plain.indexOf(headlineLine2)
  if (at === -1) {
    return <span className="text-[#D97706]">{headlineLine2Plain}</span>
  }
  return (
    <>
      {headlineLine2Plain.slice(0, at)}
      <span className="text-[#D97706]">{headlineLine2}</span>
      {headlineLine2Plain.slice(at + headlineLine2.length)}
    </>
  )
}

/**
 * The hero's full copy unit (kicker, headline, subheadline, CTAs, proof line).
 * When the variant changes the outgoing copy slides up and out before the
 * incoming copy slides up and in (AnimatePresence mode="wait").
 */
export function AnimatedHeroText({ content, variantIndex, headingId }: AnimatedHeroTextProps) {
  const prefersReduced = useReducedMotion()

  return (
    <div aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={variantIndex}
          initial={prefersReduced ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={
            prefersReduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { y: -12, opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } }
          }
          transition={{ duration: prefersReduced ? 0 : 0.35, ease: 'easeOut' }}
        >
          <p className="inline-flex items-center rounded-full bg-[rgba(217,119,6,0.1)] px-3 py-1 font-jakarta text-[11px] font-semibold tracking-wide text-[#92400E]">
            {content.kicker}
          </p>

          <h1
            id={headingId}
            className="mt-5 font-jakarta text-[36px] md:text-[52px] font-extrabold text-[#1E3A5F] tracking-[-0.02em] leading-[1.05]"
          >
            {content.headlineLine1}
            <br />
            <AccentedLine content={content} />
          </h1>

          <p className="mt-6 max-w-[440px] font-inter text-[17px] leading-[1.6] text-[rgba(30,58,95,0.75)]">
            {content.subheadline}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={content.primaryHref}
              className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-[#D97706] px-6 py-3 font-jakarta text-[13.5px] font-semibold text-white hover:bg-[#B45309] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]"
            >
              {content.primaryCTA}
            </Link>
            <Link
              href={content.secondaryHref}
              className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-[rgba(30,58,95,0.2)] bg-transparent px-6 py-3 font-jakarta text-[13.5px] font-semibold text-[#1E3A5F] hover:bg-[#F5F0E8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]"
            >
              {content.secondaryCTA}
            </Link>
          </div>

          <p className="mt-2 pt-2 font-inter text-[12px] font-medium text-[rgba(30,58,95,0.7)]">
            {content.proofLine}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
