import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/marketing/Nav'
import Footer from '@/components/marketing/Footer'
import BoostExampleIntro from '@/components/marketing/boosts/BoostExampleIntro'
import BoostShowcaseSection from '@/components/marketing/boosts/BoostShowcaseSection'
import BoostsFinalCTA from '@/components/marketing/boosts/BoostsFinalCTA'
import { FEATURED_PERSONAS, buildBoostSections, getPersona } from '@/lib/boosts/personas'

// Only the known featured personas have pages; anything else 404s.
export const dynamicParams = false

export function generateStaticParams() {
  return FEATURED_PERSONAS.map((persona) => ({ slug: persona.slug }))
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const persona = getPersona(slug)
  if (!persona) return { title: 'Boosts | RoleBoost' }
  const first = persona.name.split(' ')[0]
  const description = `See ${persona.name}, ${persona.role} (${persona.careerStage}), through three Boosts: the Visual Boost, the Short Boost Audio, and the Podcast Style Boost.`
  return {
    title: `${first}'s Boosts | RoleBoost`,
    description,
    openGraph: { title: `${persona.name} on RoleBoost`, description },
  }
}

export default async function PersonaBoostsPage({ params }: Props) {
  const { slug } = await params
  const persona = getPersona(slug)
  if (!persona || !persona.featured) notFound()

  const first = persona.name.split(' ')[0]
  const sections = buildBoostSections(persona)

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
        {/* Persona hero */}
        <section className="pt-16 pb-12 bg-[#FFFBF5]" aria-labelledby="persona-hero-heading">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Link
              href="/boosts"
              className="inline-flex items-center gap-1.5 font-jakarta text-sm font-semibold text-[#B45309] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] rounded"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              All Boost examples
            </Link>

            <div className="mt-8 max-w-3xl">
              <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.12em] text-[#D97706] mb-3">
                Boosts
              </p>
              <h1
                id="persona-hero-heading"
                className="font-jakarta text-4xl md:text-5xl font-extrabold text-[#1E3A5F] leading-tight mb-4"
              >
                {first}&apos;s Boosts
              </h1>
              <p className="font-inter text-lg text-gray-700 leading-relaxed">
                {persona.role} · {persona.location}. Three Boosts, built from a real career, that
                give a hiring manager three fast ways in: see {first}, hear {first}, and hear {first}
                {' '}discussed.
              </p>
            </div>
          </div>
        </section>

        <BoostExampleIntro persona={persona} />

        {sections.map((section) => (
          <BoostShowcaseSection key={section.name} {...section} />
        ))}

        <BoostsFinalCTA />
      </main>
      <Footer />
    </div>
  )
}
