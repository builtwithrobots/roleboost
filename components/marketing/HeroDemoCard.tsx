'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Mic, BarChart2, Bot } from 'lucide-react'

/* Waveform bar heights in px, varying within the 8-28px band */
const WAVE_BARS = [12, 22, 28, 18, 8]

/* Tiles stagger in 150ms apart; chat messages follow 600ms after the last
   tile settles, with the AI reply 800ms after the recruiter question. */
const TILE_DELAYS = [0, 0.15, 0.3]
const TILE_DURATION = 0.45
const MSG_1_DELAY = TILE_DELAYS[2] + TILE_DURATION + 0.6
const MSG_2_DELAY = MSG_1_DELAY + 0.8

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#059669]" />
    </span>
  )
}

export default function HeroDemoCard() {
  const prefersReduced = useReducedMotion()

  const tileMotion = (index: number) => ({
    initial: prefersReduced ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: TILE_DURATION, delay: prefersReduced ? 0 : TILE_DELAYS[index] },
  })

  const messageMotion = (delay: number) => ({
    initial: prefersReduced ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: prefersReduced ? 0 : delay },
  })

  return (
    <div
      className="bg-[#FFFBF5] border border-[rgba(30,58,95,0.1)] rounded-xl shadow-md p-4 sm:p-6"
      aria-label="Preview of a RoleBoost candidate profile: career Boost assets and an AI chat"
    >
      {/* Boost asset stack, three tiles in a slight cascade */}
      <div className="space-y-3">
        <motion.div
          {...tileMotion(0)}
          className="flex items-center gap-3 bg-white border border-[rgba(30,58,95,0.08)] rounded-xl shadow-sm px-4 py-3 mr-6 sm:mr-10"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(217,119,6,0.1)] text-[#D97706]"
            aria-hidden="true"
          >
            <Mic size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-jakarta text-[13px] font-semibold text-[#1E3A5F] leading-tight">
              Podcast Style Boost
            </p>
            <p className="font-inter text-[11px] text-[#1E3A5F]/70 leading-tight mt-0.5">
              Jordan Mills &middot; 90 sec
            </p>
          </div>
          <div className="flex items-end gap-[3px] h-7" aria-hidden="true">
            {WAVE_BARS.map((height, i) => (
              <span
                key={i}
                className="rb-wave-bar w-[3px] rounded-full bg-[#D97706]"
                style={{ height: `${height}px`, animationDelay: `${i * 0.14}s` }}
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          {...tileMotion(1)}
          className="flex items-center gap-3 bg-white border border-[rgba(30,58,95,0.08)] rounded-xl shadow-sm px-4 py-3 ml-3 sm:ml-5 mr-3 sm:mr-5"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F0E8] text-[#1E3A5F]"
            aria-hidden="true"
          >
            <BarChart2 size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-jakarta text-[13px] font-semibold text-[#1E3A5F] leading-tight">
              Visual Boost
            </p>
            <p className="font-inter text-[11px] text-[#1E3A5F]/70 leading-tight mt-0.5">
              Career Timeline &middot; 2023-2025
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
            <span className="whitespace-nowrap rounded-full bg-[#F5F0E8] px-2 py-0.5 font-jakarta text-[10px] font-semibold text-[#1E3A5F]">
              97% CSAT
            </span>
            <span className="whitespace-nowrap rounded-full bg-[rgba(217,119,6,0.1)] px-2 py-0.5 font-jakarta text-[10px] font-semibold text-[#92400E]">
              Top 10%
            </span>
          </div>
        </motion.div>

        <motion.div
          {...tileMotion(2)}
          className="flex items-center gap-3 bg-white border border-[rgba(30,58,95,0.08)] rounded-xl shadow-sm px-4 py-3 ml-6 sm:ml-10"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(217,119,6,0.1)] text-[#D97706]"
            aria-hidden="true"
          >
            <Bot size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-jakarta text-[13px] font-semibold text-[#1E3A5F] leading-tight">
              Career AI
            </p>
            <p className="font-inter text-[11px] text-[#1E3A5F]/70 leading-tight mt-0.5">
              Available 24/7
            </p>
          </div>
          <LiveDot />
        </motion.div>
      </div>

      {/* AI chat preview */}
      <div className="mt-4 bg-[#F5F0E8] rounded-lg p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[#1E3A5F]">
            <Bot size={14} strokeWidth={2} aria-hidden="true" />
            <span className="font-jakarta text-[12px] font-semibold">Jordan&apos;s Career AI</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D1FAE5] px-2 py-0.5 font-jakarta text-[10px] font-semibold text-[#065F46]">
            <LiveDot />
            Live
          </span>
        </div>

        <div className="space-y-3">
          <motion.div {...messageMotion(MSG_1_DELAY)} className="max-w-[85%]">
            <p className="font-inter text-[10px] font-medium text-[#1E3A5F]/70 mb-1">Recruiter</p>
            <div className="bg-white border border-[rgba(30,58,95,0.08)] text-[#1E3A5F] rounded-lg rounded-tl-none px-3 py-2 font-inter text-[12px] leading-relaxed">
              &ldquo;Jordan doesn&apos;t have a degree. Is that a concern?&rdquo;
            </div>
          </motion.div>

          <motion.div {...messageMotion(MSG_2_DELAY)} className="max-w-[85%] ml-auto text-right">
            <p className="font-inter text-[10px] font-medium text-[#92400E] mb-1">
              Jordan&apos;s AI
            </p>
            <div className="bg-[#1E3A5F] text-white rounded-lg rounded-tr-none px-3 py-2 font-inter text-[12px] leading-relaxed text-left">
              &ldquo;Jordan&apos;s results speak for themselves. 97% CSAT, promoted ahead of
              timeline, Employee of the Quarter, competing against colleagues with 5-10 years of
              experience.&rdquo;
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
