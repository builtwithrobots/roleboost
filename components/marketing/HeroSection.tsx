'use client'

import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'

export default function HeroSection() {
  const prefersReduced = useReducedMotion()

  const baseDelay = prefersReduced ? 0 : undefined

  return (
    <section className="py-24 bg-[#FFFBF5]" aria-labelledby="hero-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <motion.h1
            id="hero-heading"
            className="font-jakarta text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#1E3A5F] leading-tight mb-6"
            initial={prefersReduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: baseDelay ?? 0 }}
          >
            Your career, finally heard.{' '}
            <br className="hidden sm:block" />
            Your next hire, finally found.
          </motion.h1>

          <motion.p
            className="font-inter text-lg text-gray-700 leading-relaxed max-w-2xl mx-auto mb-12"
            initial={prefersReduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: baseDelay ?? 0.15 }}
          >
            RoleBoost replaces the resume with a rich AI-powered candidate profile — audio, video,
            infographic, slide deck, and a personal career AI that answers recruiter questions 24/7.
          </motion.p>

          {/* Dual-path cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Candidate card */}
            <motion.div
              className="bg-[#FFFBF5] rounded-2xl border-2 border-[#1E3A5F] shadow-sm hover:shadow-md transition-shadow p-8 text-left flex flex-col"
              initial={prefersReduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: baseDelay ?? 0.25 }}
            >
              <div className="mb-4 text-[#1E3A5F]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              <h2 className="font-jakarta text-xl font-semibold text-[#1E3A5F] mb-3">
                I&apos;m looking for my next role
              </h2>
              <p className="font-inter text-base text-gray-600 leading-relaxed mb-6 flex-1">
                Upload your resume. Get a complete AI-powered career profile. Share one link.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center w-full px-6 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
              >
                Build My Profile Free
              </Link>
            </motion.div>

            {/* Employer card */}
            <motion.div
              className="bg-[#FFFBF5] rounded-2xl border-2 border-[#1E3A5F] shadow-sm hover:shadow-md transition-shadow p-8 text-left flex flex-col"
              initial={prefersReduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: baseDelay ?? 0.35 }}
            >
              <div className="mb-4 text-[#1E3A5F]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <h2 className="font-jakarta text-xl font-semibold text-[#1E3A5F] mb-3">
                I&apos;m hiring for my team
              </h2>
              <p className="font-inter text-base text-gray-600 leading-relaxed mb-6 flex-1">
                Find candidates, chat with their career AI, and manage your pipeline — all in one
                place.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center w-full px-6 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
              >
                Start Hiring Free
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
