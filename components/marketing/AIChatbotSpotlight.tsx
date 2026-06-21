'use client'

import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp, staggerContainer } from '@/lib/motion'
import Link from 'next/link'

const chatMessages = [
  {
    role: 'user' as const,
    content: 'How did you scale operations 3X in 90 days at Complemar?',
  },
  {
    role: 'ai' as const,
    content:
      'That expansion required moving fast without breaking what was working. I started by mapping every constraint in the current flow, then built parallel processes for the incoming volume before the cutover. We hired and trained 14 people in 3 weeks and ran dual operations for 10 days to validate. The key was having the SOPs written before the first new hire showed up.',
  },
  {
    role: 'user' as const,
    content: 'Why did you leave that role?',
  },
  {
    role: 'ai' as const,
    content:
      "The expansion I was brought in to execute was complete. The site was stable, the team was self-managing, and my value was in building — not maintaining. I look for environments where the next hard thing is waiting.",
  },
]

export default function AIChatbotSpotlight() {
  const prefersReduced = useReducedMotion()
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const leftInView = useInView(leftRef, { once: true, margin: '-80px' })
  const rightInView = useInView(rightRef, { once: true, margin: '-80px' })
  const messagesInView = useInView(messagesRef, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-[#1E3A5F]" aria-labelledby="ai-spotlight-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left column — copy */}
          <motion.div
            ref={leftRef}
            variants={fadeUp}
            initial="hidden"
            animate={prefersReduced || leftInView ? 'visible' : 'hidden'}
          >
            <span className="inline-flex items-center px-3 py-1 rounded-full border border-[#D97706] font-jakarta text-[13px] font-semibold text-[#D97706] mb-6">
              The Game Changer
            </span>

            <h2
              id="ai-spotlight-heading"
              className="font-jakarta text-3xl md:text-4xl font-bold text-white leading-snug mb-6"
            >
              A personal career AI, available to recruiters 24/7.
            </h2>

            <p className="font-inter text-lg text-blue-100 leading-relaxed mb-8">
              Every RoleBoost candidate gets a career AI trained on their specific data. Recruiters
              chat with it directly from the candidate&apos;s profile — no scheduling, no waiting, no
              screening call required.
            </p>

            <ul className="space-y-4 mb-10">
              {[
                'Answers questions in the candidate\'s voice, from their real career data',
                'Full conversation transcript delivered by email to both sides',
                'Candidates fine-tune their AI based on what recruiters actually ask',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="text-[#D97706] flex-shrink-0 mt-0.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="font-inter text-base text-blue-100 leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>

            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-white text-white font-jakarta text-[15px] font-semibold hover:bg-white hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E3A5F] transition-colors min-h-[44px]"
            >
              See How It Works
            </Link>
          </motion.div>

          {/* Right column — mock chat UI */}
          <motion.div
            ref={rightRef}
            variants={fadeUp}
            initial="hidden"
            animate={prefersReduced || rightInView ? 'visible' : 'hidden'}
            transition={{ delay: prefersReduced ? 0 : 0.2 }}
          >
            <div
              className="bg-white rounded-2xl shadow-xl overflow-hidden"
              role="img"
              aria-label="Example conversation with Marcus Wheeler's career AI"
            >
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E8E0D0]">
                <div
                  className="w-9 h-9 rounded-full bg-[#1E3A5F] flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  <span className="font-jakarta text-xs font-bold text-white">MW</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-jakarta text-sm font-semibold text-[#1E3A5F]">
                    Marcus Wheeler&apos;s Career AI
                  </p>
                </div>
                <div className="flex items-center gap-1.5" aria-label="Online">
                  <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                  <span className="font-inter text-xs text-gray-500">Online</span>
                </div>
              </div>

              {/* Chat messages */}
              <motion.div
                ref={messagesRef}
                variants={staggerContainer}
                initial="hidden"
                animate={prefersReduced || messagesInView ? 'visible' : 'hidden'}
                className="px-5 py-5 space-y-4 bg-[#FFFBF5] min-h-[320px]"
              >
                {chatMessages.map((msg, index) => (
                  <motion.div
                    key={index}
                    variants={fadeUp}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-[#E8E0D0] text-[#111827] rounded-br-sm'
                          : 'bg-[#1E3A5F] text-white rounded-bl-sm'
                      }`}
                    >
                      <p className="font-inter text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-[#E8E0D0] bg-white">
                <p className="font-inter text-xs text-gray-400 text-center">
                  Powered by RoleBoost AI
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
