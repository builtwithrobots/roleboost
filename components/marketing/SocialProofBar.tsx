'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { staggerContainer, fadeUp } from '@/lib/motion'

const stats = [
  {
    number: '20+ Years',
    description: 'Operations & logistics expertise behind every profile',
  },
  {
    number: '99.99%',
    description: 'Order accuracy, the standard we hold our candidates to',
  },
  {
    number: 'Both sides',
    description: 'Built by someone who has sat on both sides of the hiring table',
  },
]

export default function SocialProofBar() {
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-16 bg-[#F5F0E8]" aria-label="By the numbers">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={prefersReduced || isInView ? 'visible' : 'hidden'}
          className="flex flex-col md:flex-row items-center justify-center divide-y md:divide-y-0 md:divide-x divide-[#E8E0D0] gap-0"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.number}
              variants={fadeUp}
              className="flex-1 text-center px-8 py-6 md:py-0"
            >
              <p className="font-jakarta text-4xl font-bold text-[#1E3A5F] mb-2">{stat.number}</p>
              <p className="font-inter text-sm text-gray-600 max-w-[200px] mx-auto leading-relaxed">
                {stat.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
