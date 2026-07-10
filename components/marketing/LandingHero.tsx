'use client'

import { useHeroVariant } from '@/lib/hooks/use-hero-variant'
import { AnimatedHeroText, type HeroContent } from '@/components/marketing/animated-hero-text'
import HeroDemoCard from './HeroDemoCard'

const CANDIDATE_VARIANTS: HeroContent[] = [
  // Variant 0 -- emotional (first-time visitors, social)
  {
    kicker: 'Your career. Your AI.',
    headlineLine1: 'Finally, a resume',
    headlineLine2: 'that talks back.',
    subheadline:
      'Upload your resume once. RoleBoost builds a personal career AI that answers recruiter questions around the clock, plus audio, video, infographic, and slide-deck Boosts, all behind one link.',
    primaryCTA: 'Build My Profile Free',
    primaryHref: '/sign-up',
    secondaryCTA: 'See a live example',
    secondaryHref: '/boosts',
    proofLine: 'Always advocating for you. 24/7/365.',
  },
  // Variant 1 -- direct, mechanic-first (paid traffic, SEO)
  {
    kicker: 'Stop losing to less qualified candidates.',
    headlineLine1: 'Recruiters have questions.',
    headlineLine2: 'Your AI has answers, 24/7.',
    subheadline:
      'RoleBoost turns your career into a personal AI that fields recruiter questions any hour, backed by audio, video, infographic, and slide-deck Boosts behind one shareable link.',
    primaryCTA: 'Build My Profile Free',
    primaryHref: '/sign-up',
    secondaryCTA: 'See a live example',
    secondaryHref: '/boosts',
    proofLine: "No resume black hole. No 2am screen calls you can't take.",
  },
  // Variant 2 -- candidate pain (job seeker communities, referral)
  {
    kicker: 'Built for candidates who are done being overlooked.',
    headlineLine1: 'Your results deserve',
    headlineLine2: 'more than a keyword match.',
    subheadline:
      'Stop letting a one-page resume speak for years of results. RoleBoost builds your complete career profile and gives you a personal AI that represents you to recruiters around the clock.',
    primaryCTA: 'Get started free',
    primaryHref: '/sign-up',
    secondaryCTA: 'Watch how it works',
    secondaryHref: '/boosts',
    proofLine: 'One link. Every version of you. Your AI. Finally heard.',
  },
]

export default function LandingHero() {
  const variant = useHeroVariant()
  const content = CANDIDATE_VARIANTS[variant] ?? CANDIDATE_VARIANTS[0]

  return (
    <section className="bg-[#FFFBF5] py-16 md:py-24" aria-labelledby="hero-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Copy column */}
          <div>
            <AnimatedHeroText content={content} variantIndex={variant} headingId="hero-heading" />
          </div>

          {/* Visual demo column, static across variants */}
          <div className="w-full max-w-[520px] mx-auto lg:mx-0 lg:justify-self-end">
            <HeroDemoCard />
          </div>
        </div>
      </div>
    </section>
  )
}
