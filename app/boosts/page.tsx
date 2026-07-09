import type { Metadata } from 'next'
import Nav from '@/components/marketing/Nav'
import Footer from '@/components/marketing/Footer'
import BoostsHero from '@/components/marketing/boosts/BoostsHero'
import BoostExampleIntro from '@/components/marketing/boosts/BoostExampleIntro'
import BoostShowcaseSection from '@/components/marketing/boosts/BoostShowcaseSection'
import BoostsExamplesBanner from '@/components/marketing/boosts/BoostsExamplesBanner'
import BoostsFinalCTA from '@/components/marketing/boosts/BoostsFinalCTA'
import { DEFAULT_PERSONA, buildBoostSections } from '@/lib/boosts/personas'

export const metadata: Metadata = {
  title: 'Boosts | RoleBoost',
  description:
    'See the three Boosts RoleBoost makes: the Visual Boost, the Short Boost Audio, and the Podcast Style Boost, shown through real candidates across every kind of career.',
}

// Jordan Mills is the featured example; his Boost sections are built from the
// shared persona/format model. Other example candidates live in the examples
// banner below and on their own pages at /boosts/[slug].
const jordanSections = buildBoostSections(DEFAULT_PERSONA)

export default function BoostsPage() {
  return (
    <div className="min-h-screen bg-[#FFFBF5]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#1E3A5F] focus:text-white focus:font-jakarta focus:font-semibold"
      >
        Skip to main content
      </a>
      <Nav />
      <main id="main-content">
        <BoostsHero />
        <BoostExampleIntro />
        {jordanSections.map((section) => (
          <BoostShowcaseSection key={section.name} {...section} />
        ))}
        <BoostsExamplesBanner />
        <BoostsFinalCTA />
      </main>
      <Footer />
    </div>
  )
}
