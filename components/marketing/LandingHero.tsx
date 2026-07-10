'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import HeroDemoCard from './HeroDemoCard'

export default function LandingHero() {
  const prefersReduced = useReducedMotion()

  const copyMotion = (delay: number) => ({
    initial: prefersReduced ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const, delay: prefersReduced ? 0 : delay },
  })

  return (
    <section className="bg-[#FFFBF5] py-16 md:py-24" aria-labelledby="hero-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Copy column */}
          <div>
            <motion.p
              {...copyMotion(0)}
              className="inline-flex items-center rounded-full bg-[rgba(217,119,6,0.1)] px-3 py-1 font-jakarta text-[11px] font-semibold tracking-wide text-[#92400E]"
            >
              Your career. Your AI.
            </motion.p>

            <motion.h1
              {...copyMotion(0.1)}
              id="hero-heading"
              className="mt-5 font-jakarta text-[36px] md:text-[52px] font-extrabold text-[#1E3A5F] tracking-[-0.02em] leading-[1.05]"
            >
              Finally, a r&eacute;sum&eacute;
              <br />
              that <span className="text-[#D97706]">talks back.</span>
            </motion.h1>

            <motion.p
              {...copyMotion(0.2)}
              className="mt-6 max-w-[440px] font-inter text-[17px] leading-[1.6] text-[rgba(30,58,95,0.75)]"
            >
              Upload your resume once. RoleBoost builds a personal career AI that answers recruiter
              questions around the clock, plus audio, video, infographic, and slide-deck Boosts,
              all behind one link.
            </motion.p>

            <motion.div {...copyMotion(0.3)} className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center min-h-[44px] rounded-lg bg-[#D97706] px-6 py-3 font-jakarta text-[13.5px] font-semibold text-white hover:bg-[#B45309] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]"
              >
                Build My Profile Free
              </Link>
              <Link
                href="/boosts"
                className="inline-flex items-center justify-center min-h-[44px] rounded-lg border border-[rgba(30,58,95,0.2)] bg-transparent px-6 py-3 font-jakarta text-[13.5px] font-semibold text-[#1E3A5F] hover:bg-[#F5F0E8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]"
              >
                See a live example
              </Link>
            </motion.div>

            <motion.p
              {...copyMotion(0.4)}
              className="mt-2 pt-2 font-inter text-[12px] font-medium text-[rgba(30,58,95,0.7)]"
            >
              Always advocating for you. 24/7/365.
            </motion.p>
          </div>

          {/* Visual demo column */}
          <div className="w-full max-w-[520px] mx-auto lg:mx-0 lg:justify-self-end">
            <HeroDemoCard />
          </div>
        </div>
      </div>
    </section>
  )
}
