'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp, staggerContainer, fadeIn } from '@/lib/motion'
import Link from 'next/link'

const packages = [
  {
    name: 'Starter',
    price: '$49',
    included: 'ATS resume + AI summary + profile setup',
  },
  {
    name: 'Standard',
    price: '$99',
    included: 'Everything + audio overview + infographic',
  },
  {
    name: 'Pro',
    price: '$197',
    included: 'Full suite including debate audio',
  },
  {
    name: 'Elite',
    price: '$397',
    included: 'Everything + 30 min career interview + AI chatbot setup',
  },
]

export default function DoneForYouSection() {
  const prefersReduced = useReducedMotion()
  const headingRef = useRef<HTMLDivElement>(null)
  const pathsRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const headingInView = useInView(headingRef, { once: true, margin: '-80px' })
  const pathsInView = useInView(pathsRef, { once: true, margin: '-80px' })
  const tableInView = useInView(tableRef, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-[#FFFBF5]" aria-labelledby="done-for-you-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          ref={headingRef}
          variants={fadeUp}
          initial="hidden"
          animate={prefersReduced || headingInView ? 'visible' : 'hidden'}
          className="text-center max-w-3xl mx-auto mb-6"
        >
          <h2
            id="done-for-you-heading"
            className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug mb-4"
          >
            Want us to build it for you?
          </h2>
          <p className="font-inter text-lg text-gray-600 leading-relaxed">
            Not ready to DIY? We build RoleBoost profiles for candidates directly — the same way we
            built our own. Specialized in operations, logistics, and warehouse leadership. Available
            through Fiverr or direct.
          </p>
        </motion.div>

        {/* Two paths */}
        <motion.div
          ref={pathsRef}
          variants={staggerContainer}
          initial="hidden"
          animate={prefersReduced || pathsInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16"
        >
          {/* Fiverr path */}
          <motion.div
            variants={fadeUp}
            className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-8 flex flex-col"
          >
            <div className="mb-4 text-[#1E3A5F]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </div>
            <h3 className="font-jakarta text-xl font-semibold text-[#1E3A5F] mb-3">
              Order on Fiverr
            </h3>
            <p className="font-inter text-base text-gray-600 leading-relaxed mb-6 flex-1">
              Browse our packages, see examples, and order with Fiverr&apos;s built-in buyer
              protection.
            </p>
            <Link
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
            >
              View Fiverr Packages
            </Link>
          </motion.div>

          {/* Direct path */}
          <motion.div
            variants={fadeUp}
            className="bg-[#FFFBF5] rounded-2xl border border-[#E8E0D0] shadow-sm p-8 flex flex-col"
          >
            <div className="mb-4 text-[#1E3A5F]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <h3 className="font-jakarta text-xl font-semibold text-[#1E3A5F] mb-3">
              Work with us directly
            </h3>
            <p className="font-inter text-base text-gray-600 leading-relaxed mb-6 flex-1">
              Prefer to skip Fiverr? Reach out directly and we&apos;ll find the right package for
              your background.
            </p>
            <Link
              href="#"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-[#1E3A5F] text-[#1E3A5F] font-jakarta text-[15px] font-semibold hover:bg-[#1E3A5F] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
            >
              Contact Us
            </Link>
          </motion.div>
        </motion.div>

        {/* Package table */}
        <motion.div
          ref={tableRef}
          variants={staggerContainer}
          initial="hidden"
          animate={prefersReduced || tableInView ? 'visible' : 'hidden'}
          className="max-w-3xl mx-auto overflow-hidden rounded-2xl border border-[#E8E0D0] shadow-sm"
          role="table"
          aria-label="Done-for-you package pricing"
        >
          {/* Table header */}
          <div
            className="grid grid-cols-3 bg-[#1E3A5F] px-6 py-4"
            role="row"
          >
            <span className="font-jakarta text-[13px] font-semibold text-white" role="columnheader">Package</span>
            <span className="font-jakarta text-[13px] font-semibold text-white" role="columnheader">Price</span>
            <span className="font-jakarta text-[13px] font-semibold text-white" role="columnheader">What&apos;s Included</span>
          </div>

          {packages.map((pkg, index) => (
            <motion.div
              key={pkg.name}
              variants={fadeIn}
              role="row"
              className={`grid grid-cols-3 px-6 py-4 items-center ${
                index % 2 === 0 ? 'bg-[#FFFBF5]' : 'bg-[#F5F0E8]'
              } ${index < packages.length - 1 ? 'border-b border-[#E8E0D0]' : ''}`}
            >
              <span className="font-jakarta text-sm font-semibold text-[#1E3A5F]" role="cell">
                {pkg.name}
              </span>
              <span className="font-jakarta text-sm font-bold text-[#D97706]" role="cell">
                {pkg.price}
              </span>
              <span className="font-inter text-sm text-gray-600" role="cell">
                {pkg.included}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
