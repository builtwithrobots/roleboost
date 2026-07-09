'use client'

import { useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { fadeUp, scaleIn } from '@/lib/motion'
import type { PersonaIconKey } from '@/lib/boosts/personas'
import ImageLightbox from './ImageLightbox'
import PersonaIcon from './PersonaIcon'

export type BoostKind = 'image' | 'audio'

export interface BoostShowcaseSectionProps {
  /** Zero-based order on the page. Drives background alternation and asset side. */
  index: number
  kind: BoostKind
  name: string
  kicker: string
  description: string
  why: string
  /**
   * Public path or URL to the real asset. When null, an on-brand placeholder is
   * shown instead. To go live, drop the file in /public and pass its path here.
   */
  assetSrc: string | null
  /** Alt text for the image Boost. */
  assetAlt?: string
  /** Accessible label for the audio Boost's player. */
  audioLabel?: string
  /** Candidate name shown on the audio player header (audio Boosts). */
  candidateName?: string
  /** Monogram for the audio player avatar. Defaults to the candidate's initials. */
  avatarInitials?: string
  /** Industry icon for the audio player avatar; falls back to initials when absent. */
  avatarIcon?: PersonaIconKey
  /** Avatar background color. Defaults to the RoleBoost candidate teal. */
  avatarColor?: string
}

function ImageAsset({ src, alt, title }: { src: string | null; alt: string; title: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (src) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-haspopup="dialog"
          aria-label={`View larger: ${alt}`}
          className="group relative block w-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full rounded-2xl border border-[#E8E0D0] shadow-sm transition-transform duration-200 group-hover:scale-[1.01]"
          />
          {/* Affordance cue: icon + text, not color alone */}
          <span
            aria-hidden="true"
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-[#E8E0D0] bg-[#FFFBF5]/95 px-3 py-1.5 font-jakarta text-xs font-semibold text-[#1E3A5F] shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            Click to enlarge
          </span>
        </button>
        <ImageLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          src={src}
          alt={alt}
          title={title}
        />
      </>
    )
  }
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-[#D4C8B8] bg-[#FFFBF5] p-8 text-center"
      role="img"
      aria-label="Placeholder for the Visual Boost infographic. The real asset will appear here."
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D97706"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      <p className="font-jakarta text-sm font-semibold text-[#1E3A5F]">Visual Boost infographic</p>
      <p className="font-inter text-sm text-gray-500">Preview coming soon</p>
    </div>
  )
}

function DisabledSaveButton() {
  // Example-only affordance: previews the recruiter "save candidate" action that
  // exists in the real product. Disabled here since /boosts is a public demo.
  return (
    <button
      type="button"
      disabled
      title="Saving candidates is available inside RoleBoost"
      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#E8E0D0] bg-[#F5F0E8] px-3 py-2 font-jakarta text-sm font-semibold text-[#8FA3B8] cursor-not-allowed min-h-[44px]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      Save
    </button>
  )
}

function AudioAsset({
  src,
  label,
  formatName,
  candidateName,
  initials,
  icon,
  avatarColor,
}: {
  src: string | null
  label: string
  formatName: string
  candidateName: string
  initials: string
  icon?: PersonaIconKey
  avatarColor: string
}) {
  if (src) {
    return (
      <div className="w-full rounded-2xl border border-[#E8E0D0] bg-[#FFFBF5] shadow-sm p-6">
        {/* Candidate header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex items-center justify-center w-10 h-10 rounded-full text-white font-jakarta text-sm font-bold shrink-0"
              style={{ backgroundColor: avatarColor }}
              aria-hidden="true"
            >
              {icon ? <PersonaIcon icon={icon} className="size-5" /> : initials}
            </span>
            <div className="min-w-0">
              <p className="font-jakarta text-base font-bold text-[#1E3A5F] truncate">{candidateName}</p>
              <p className="font-inter text-xs text-gray-500 truncate">{formatName}</p>
            </div>
          </div>
          <DisabledSaveButton />
        </div>
        <audio controls preload="none" src={src} aria-label={label} className="w-full">
          Your browser does not support the audio element.
        </audio>
      </div>
    )
  }
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 w-full rounded-2xl border-2 border-dashed border-[#D4C8B8] bg-[#FFFBF5] p-8 text-center"
      role="img"
      aria-label={`Placeholder for the ${label}. The audio will play here once the asset is uploaded.`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D97706"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
      </svg>
      {/* Decorative faux waveform */}
      <div className="flex items-end gap-1 h-8" aria-hidden="true">
        {[10, 18, 28, 20, 32, 14, 24, 30, 16, 22, 12, 26].map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-[#E8E0D0]"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <p className="font-inter text-sm text-gray-500">Audio preview coming soon</p>
    </div>
  )
}

export default function BoostShowcaseSection({
  index,
  kind,
  name,
  kicker,
  description,
  why,
  assetSrc,
  assetAlt,
  audioLabel,
  candidateName = 'Jordan Mills',
  avatarInitials,
  avatarIcon,
  avatarColor = '#0F6E56',
}: BoostShowcaseSectionProps) {
  // Derive a monogram from the candidate name when one is not supplied.
  const initials =
    avatarInitials ??
    candidateName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  const prefersReduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const bg = index % 2 === 0 ? 'bg-[#FFFBF5]' : 'bg-[#F5F0E8]'
  const assetFirstOnDesktop = index % 2 === 1
  const headingId = `boost-${index}-heading`

  return (
    <section className={`py-20 ${bg}`} aria-labelledby={headingId}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        >
          {/* Copy */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate={prefersReduced || inView ? 'visible' : 'hidden'}
            className={assetFirstOnDesktop ? 'lg:order-2' : 'lg:order-1'}
          >
            <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.12em] text-[#D97706] mb-3">
              {kicker}
            </p>
            <h2
              id={headingId}
              className="font-jakarta text-3xl md:text-4xl font-bold text-[#1E3A5F] leading-snug mb-4"
            >
              {name}
            </h2>
            <p className="font-inter text-lg text-gray-700 leading-relaxed mb-6">{description}</p>
            <div className="border-l-2 border-[#D97706] pl-4">
              <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A5F] mb-1">
                Why it exists
              </p>
              <p className="font-inter text-base text-gray-600 leading-relaxed">{why}</p>
            </div>
          </motion.div>

          {/* Asset */}
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate={prefersReduced || inView ? 'visible' : 'hidden'}
            className={assetFirstOnDesktop ? 'lg:order-1' : 'lg:order-2'}
          >
            {kind === 'image' ? (
              <ImageAsset src={assetSrc} alt={assetAlt ?? `${name} for ${candidateName}`} title={name} />
            ) : (
              <AudioAsset
                src={assetSrc}
                label={audioLabel ?? `${name} for ${candidateName}`}
                formatName={name}
                candidateName={candidateName}
                initials={initials}
                icon={avatarIcon}
                avatarColor={avatarColor}
              />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
