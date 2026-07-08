import type { Metadata } from 'next'
import Nav from '@/components/marketing/Nav'
import Footer from '@/components/marketing/Footer'
import BoostsHero from '@/components/marketing/boosts/BoostsHero'
import BoostExampleIntro from '@/components/marketing/boosts/BoostExampleIntro'
import BoostShowcaseSection, {
  type BoostShowcaseSectionProps,
} from '@/components/marketing/boosts/BoostShowcaseSection'
import BoostsFinalCTA from '@/components/marketing/boosts/BoostsFinalCTA'

export const metadata: Metadata = {
  title: 'Boosts | RoleBoost',
  description:
    'See the three Boosts RoleBoost makes: the Visual Boost, the Short Boost Audio, and the Podcast Style Boost, shown through one real candidate.',
}

// Real Jordan Mills assets are supplied later. Drop the files in /public/boosts
// and set the matching path below to swap each placeholder for the live asset:
//   visual:  '/boosts/jordan-mills-visual-boost.png'
//   short:   '/boosts/jordan-mills-short-boost-audio.mp3'
//   podcast: '/boosts/jordan-mills-podcast-boost.mp3'
const ASSET_SRC = {
  visual: null,
  short: null,
  podcast: null,
} satisfies Record<string, string | null>

const boosts: BoostShowcaseSectionProps[] = [
  {
    index: 0,
    kind: 'image',
    name: 'Visual Boost',
    kicker: 'The career at a glance',
    description:
      'A single career infographic that shows the whole story in one look: the numbers, the trajectory, and the case for the next role.',
    why: 'For the hiring manager who skims first. In a few seconds they see where a candidate is heading and the proof behind it, before they read a single line of a resume.',
    assetSrc: ASSET_SRC.visual,
    assetAlt: 'Visual Boost career infographic for Jordan Mills',
  },
  {
    index: 1,
    kind: 'audio',
    name: 'Short Boost Audio',
    kicker: 'A colleague briefs the hiring manager',
    description:
      'A single-host audio overview, under two minutes, that sounds like a trusted colleague explaining why this candidate is worth a conversation.',
    why: 'For the recruiter between meetings. They press play, and by the time the coffee is poured they know who the candidate is and what they are ready for.',
    assetSrc: ASSET_SRC.short,
    audioLabel: 'Short Boost Audio for Jordan Mills',
  },
  {
    index: 2,
    kind: 'audio',
    name: 'Podcast Style Boost',
    kicker: 'Two voices talk you through the candidate',
    description:
      'A two-host conversation, in the familiar podcast format, where two people discuss the candidate and what they would bring to a hiring team.',
    why: 'For the team that decides together. The back and forth surfaces the questions a panel would ask, and answers them, so the candidate walks in already understood.',
    assetSrc: ASSET_SRC.podcast,
    audioLabel: 'Podcast Style Boost for Jordan Mills',
  },
]

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
        {boosts.map((boost) => (
          <BoostShowcaseSection key={boost.name} {...boost} />
        ))}
        <BoostsFinalCTA />
      </main>
      <Footer />
    </div>
  )
}
