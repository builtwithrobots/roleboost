'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Mic, BarChart2, Bot, Calendar, Mail, MessageCircle, Play, Send } from 'lucide-react'

/* Waveform bar heights in px, varying within the 8-28px band */
const WAVE_BARS = [12, 22, 28, 18, 8]

/* Tiles stagger in 150ms apart; the chat loop starts 600ms after the last
   tile settles. */
const TILE_DELAYS = [0, 0.15, 0.3]
const TILE_DURATION = 0.45
const CHAT_START_MS = (TILE_DELAYS[2] + TILE_DURATION + 0.6) * 1000

/* Per-pair rhythm: recruiter question lands, the AI "types", the answer
   replaces the dots, then the exchange holds before the next one fades in. */
const QUESTION_MS = 1000
const TYPING_MS = 1400
const ANSWER_HOLD_MS = 5200

export interface QaPair {
  question: string
  answer: string
}

/* Default candidate-POV exchanges (Jordan Mills persona) */
const QA_PAIRS: QaPair[] = [
  {
    question: 'Jordan doesn’t have a degree. Is that a concern?',
    answer:
      'Jordan’s results speak for themselves. 97% CSAT, promoted ahead of timeline, Employee of the Quarter, competing against colleagues with 5-10 years of experience.',
  },
  {
    question: 'How does Jordan perform under pressure?',
    answer:
      'During last year’s product launch, ticket volume tripled. Jordan held CSAT at 97% and coached two new hires through the surge at the same time.',
  },
  {
    question: 'What is Jordan looking for in the next role?',
    answer:
      'A team where ownership grows fast. Jordan was promoted ahead of timeline once already and wants a seat where the bar keeps rising.',
  },
]

type ChatPhase = 'question' | 'typing' | 'answer' | 'booking'

/* Mock audio player: play control, pulsing waveform, progress bar, and a
   countdown that winds from 1:30 to 0:00 and loops. Purely illustrative. */
const AUDIO_DURATION_S = 90

function AudioPlayerRow() {
  const prefersReduced = useReducedMotion()
  const [remaining, setRemaining] = useState(AUDIO_DURATION_S)

  useEffect(() => {
    if (prefersReduced) return
    const id = setInterval(
      () => setRemaining((r) => (r <= 1 ? AUDIO_DURATION_S : r - 1)),
      1000
    )
    return () => clearInterval(id)
  }, [prefersReduced])

  const progress = ((AUDIO_DURATION_S - remaining) / AUDIO_DURATION_S) * 100
  const timeLabel = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`

  return (
    <div className="mt-2.5 flex items-center gap-2.5" aria-hidden="true">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D97706] text-white">
        <Play size={11} strokeWidth={2} fill="currentColor" className="ml-0.5" />
      </span>
      <span className="flex items-end gap-[3px] h-6 shrink-0">
        {WAVE_BARS.map((height, i) => (
          <span
            key={i}
            className="rb-wave-bar w-[3px] rounded-full bg-[#D97706]"
            style={{ height: `${Math.round(height * 0.8)}px`, animationDelay: `${i * 0.14}s` }}
          />
        ))}
      </span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-[#F5F0E8]">
        <span
          className="block h-full rounded-full bg-[#D97706] transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </span>
      <span className="font-data shrink-0 text-[11px] font-medium text-[#1E3A5F]/70">
        {timeLabel}
      </span>
    </div>
  )
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#059669]" />
    </span>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-1" aria-label="Jordan's AI is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-white/70 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function RecruiterBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[85%]">
      <p className="font-inter text-[10px] font-medium text-[#1E3A5F]/70 mb-1">Recruiter</p>
      <div className="bg-white border border-[rgba(30,58,95,0.08)] text-[#1E3A5F] rounded-lg rounded-tl-none px-3 py-2 font-inter text-[12px] leading-relaxed shadow-sm">
        &ldquo;{text}&rdquo;
      </div>
    </div>
  )
}

function AiBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[85%] ml-auto text-right">
      <p className="font-inter text-[10px] font-medium text-[#92400E] mb-1">Jordan&apos;s AI</p>
      <div className="inline-block bg-[#1E3A5F] text-white rounded-lg rounded-tr-none px-3 py-2 font-inter text-[12px] leading-relaxed text-left shadow-sm">
        {children}
      </div>
    </div>
  )
}

/* One full exchange at its final size: question bubble + answered AI bubble */
function Exchange({ pair }: { pair: QaPair }) {
  return (
    <div className="space-y-3">
      <RecruiterBubble text={pair.question} />
      <AiBubble>&ldquo;{pair.answer}&rdquo;</AiBubble>
    </div>
  )
}

/* Terminal state after the exchanges: the AI offers a live conversation.
   The chips are illustrative parts of the mock UI, not real controls, so
   they are inert and hidden from assistive tech. */
function BookingPrompt({ animate }: { animate: boolean }) {
  const chipRow = (
    <div className="mt-3 flex flex-wrap justify-end gap-2" aria-hidden="true">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D97706] px-3 py-1.5 font-jakarta text-[11px] font-semibold text-white">
        <Calendar size={12} strokeWidth={2} />
        Book a meeting with Jordan
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(30,58,95,0.2)] bg-white px-3 py-1.5 font-jakarta text-[11px] font-semibold text-[#1E3A5F]">
        <MessageCircle size={12} strokeWidth={2} />
        Continue discussion
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(30,58,95,0.2)] bg-white px-3 py-1.5 font-jakarta text-[11px] font-semibold text-[#1E3A5F]">
        <Mail size={12} strokeWidth={2} />
        Email me the transcript
      </span>
    </div>
  )

  return (
    <div>
      <AiBubble>&ldquo;Want to keep going? Jordan is happy to talk live.&rdquo;</AiBubble>
      {animate ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
        >
          {chipRow}
        </motion.div>
      ) : (
        chipRow
      )}
    </div>
  )
}

function ChatPreview({ pairs }: { pairs: QaPair[] }) {
  const prefersReduced = useReducedMotion()
  const [started, setStarted] = useState(false)
  const [pairIndex, setPairIndex] = useState(0)
  const [phase, setPhase] = useState<ChatPhase>('question')

  useEffect(() => {
    if (prefersReduced) return
    const t = setTimeout(() => setStarted(true), CHAT_START_MS)
    return () => clearTimeout(t)
  }, [prefersReduced])

  useEffect(() => {
    if (!started || prefersReduced) return
    let t: ReturnType<typeof setTimeout> | undefined
    if (phase === 'question') {
      t = setTimeout(() => setPhase('typing'), QUESTION_MS)
    } else if (phase === 'typing') {
      t = setTimeout(() => setPhase('answer'), TYPING_MS)
    } else if (phase === 'answer') {
      // Play every exchange once, then end on the booking prompt
      t = setTimeout(() => {
        if (pairIndex < pairs.length - 1) {
          setPairIndex(pairIndex + 1)
          setPhase('question')
        } else {
          setPhase('booking')
        }
      }, ANSWER_HOLD_MS)
    }
    return () => clearTimeout(t)
  }, [started, phase, pairIndex, prefersReduced, pairs.length])

  const pair = pairs[pairIndex] ?? pairs[0]

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[rgba(30,58,95,0.08)] bg-white shadow-sm">
      {/* Chat header, styled like a live messenger widget */}
      <div className="flex items-center justify-between bg-[#1E3A5F] px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D97706] text-white"
            aria-hidden="true"
          >
            <Bot size={16} strokeWidth={2} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#059669] ring-2 ring-[#1E3A5F]" />
          </span>
          <div>
            <p className="font-jakarta text-[12px] font-semibold leading-tight text-white">
              Jordan&apos;s Career AI
            </p>
            <p className="mt-0.5 font-inter text-[10px] leading-tight text-white/70">
              Typically replies in seconds
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 font-jakarta text-[10px] font-semibold text-[#D1FAE5]">
          <LiveDot />
          Live
        </span>
      </div>

      {/* Every exchange is stacked invisibly in the same grid cell, so the box
          is permanently sized to the tallest one and never resizes while the
          visible conversation animates on top. */}
      <div className="grid bg-[#F5F0E8] px-3 py-3 sm:px-4">
        {pairs.map((p, i) => (
          <div key={i} className="col-start-1 row-start-1 invisible" aria-hidden="true">
            <Exchange pair={p} />
          </div>
        ))}
        <div className="col-start-1 row-start-1 invisible" aria-hidden="true">
          <BookingPrompt animate={false} />
        </div>

        <div className="col-start-1 row-start-1">
          {prefersReduced ? (
            <Exchange pair={pairs[0]} />
          ) : (
            started && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={phase === 'booking' ? 'booking' : pairIndex}
                  className="space-y-3"
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {phase === 'booking' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                    >
                      <BookingPrompt animate />
                    </motion.div>
                  ) : (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                      >
                        <RecruiterBubble text={pair.question} />
                      </motion.div>
                      {phase !== 'question' && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35 }}
                        >
                          <AiBubble>
                            {phase === 'typing' ? <TypingDots /> : <>&ldquo;{pair.answer}&rdquo;</>}
                          </AiBubble>
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            )
          )}
        </div>
      </div>

      {/* Mock composer, illustrative only */}
      <div
        className="flex items-center gap-2 border-t border-[rgba(30,58,95,0.08)] bg-white px-3 py-2.5"
        aria-hidden="true"
      >
        <span className="flex-1 truncate rounded-full bg-[#F5F0E8] px-3.5 py-2 font-inter text-[11px] text-[#1E3A5F]/60">
          Ask anything about Jordan&apos;s career...
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D97706] text-white">
          <Send size={13} strokeWidth={2} />
        </span>
      </div>
    </div>
  )
}

export default function HeroDemoCard({ chatPairs = QA_PAIRS }: { chatPairs?: QaPair[] }) {
  const prefersReduced = useReducedMotion()

  const tileMotion = (index: number) => ({
    initial: prefersReduced ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: TILE_DURATION, delay: prefersReduced ? 0 : TILE_DELAYS[index] },
  })

  return (
    <div
      className="bg-[#FFFBF5] border border-[rgba(30,58,95,0.1)] rounded-xl shadow-md p-4 sm:p-6"
      aria-label="Preview of a RoleBoost candidate profile: career Boost assets and an AI chat"
    >
      {/* Boost asset stack, full-width tiles matching the chat window */}
      <div className="space-y-3">
        <motion.div
          {...tileMotion(0)}
          className="bg-white border border-[rgba(30,58,95,0.08)] rounded-xl shadow-sm px-4 py-3"
        >
          <div className="flex items-center gap-3">
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
          </div>
          <AudioPlayerRow />
        </motion.div>

        <motion.div
          {...tileMotion(1)}
          className="flex items-center gap-3 bg-white border border-[rgba(30,58,95,0.08)] rounded-xl shadow-sm px-4 py-3"
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
              Career Infographic &middot; 2023-2025
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
          className="flex items-center gap-3 bg-white border border-[rgba(30,58,95,0.08)] rounded-xl shadow-sm px-4 py-3"
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

      <ChatPreview pairs={chatPairs} />
    </div>
  )
}
