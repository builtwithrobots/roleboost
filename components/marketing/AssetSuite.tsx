'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { staggerContainer, scaleIn, fadeUp } from '@/lib/motion'

type Asset = {
  name: string
  description: string
  icon: React.ReactNode
  featured?: boolean
}

const assets: Asset[] = [
  {
    name: 'Audio Overview',
    description: '2-3 min podcast-style career narrative. Perfect for commuters.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    name: 'Debate Audio',
    description: 'A hiring committee debates your candidacy. Handles objections before they\'re asked.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    name: 'Video Overview',
    description: '90-second cinematic career story for visual reviewers.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    name: 'Slide Deck',
    description: 'Structured career presentation for detail-oriented hiring managers.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    name: 'Career Infographic',
    description: 'Visual timeline and key stats. Built for skimmers.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    name: 'ATS Resume',
    description: 'Clean, keyword-optimized resume that clears applicant tracking systems.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    name: 'AI Bullet Summary',
    description: '5-7 career highlights for the 10-second first impression.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    name: 'Personal Career AI',
    description: 'A 24/7 chatbot trained on your career data. Recruiters ask it anything.',
    featured: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07" />
      </svg>
    ),
  },
]

export default function AssetSuite() {
  const prefersReduced = useReducedMotion()
  const headingRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const headingInView = useInView(headingRef, { once: true, margin: '-80px' })
  const gridInView = useInView(gridRef, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-[#F5F0E8]" aria-labelledby="asset-suite-heading">
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
            id="asset-suite-heading"
            className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug mb-4"
          >
            One link. Every version of you.
          </h2>
          <p className="font-inter text-lg text-gray-600 leading-relaxed">
            Upload your resume and career context. RoleBoost produces a complete professional asset
            suite — then gives you a personal career AI that works for you around the clock.
          </p>
        </motion.div>

        {/* Card grid */}
        <motion.div
          ref={gridRef}
          variants={staggerContainer}
          initial="hidden"
          animate={prefersReduced || gridInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {assets.map((asset) => (
            <motion.div
              key={asset.name}
              variants={scaleIn}
              whileHover={prefersReduced ? undefined : { scale: 1.03, transition: { duration: 0.2 } }}
              className={
                asset.featured
                  ? 'bg-[#FFFBF5] rounded-2xl border-2 border-[#D97706] shadow-sm p-6 flex flex-col gap-4'
                  : 'bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-6 flex flex-col gap-4'
              }
            >
              <div className="text-[#1E3A5F]">{asset.icon}</div>
              <div>
                <h3 className="font-jakarta text-base font-semibold text-[#1E3A5F] mb-1">
                  {asset.name}
                  {asset.featured && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full border border-[#D97706] font-jakarta text-[11px] font-semibold text-[#D97706]">
                      Featured
                    </span>
                  )}
                </h3>
                <p className="font-inter text-sm text-gray-600 leading-relaxed">
                  {asset.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
