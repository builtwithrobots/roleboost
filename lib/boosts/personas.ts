// Example personas for the public /boosts page.
//
// One entry per showcased candidate. The /boosts index features Jordan Mills
// inline; every persona with `featured: true` also appears in the examples
// banner and gets its own shareable page at /boosts/[slug].
//
// Assets follow the same drop-in pattern as Jordan's: a null path renders an
// on-brand "coming soon" placeholder, and the Boost goes live the moment the
// file lands in /public/boosts and its path is filled in here. Audio must be
// progressive mp3 (converted from NotebookLM's DASH m4a per CLAUDE.md).

import type { BoostShowcaseSectionProps } from '@/components/marketing/boosts/BoostShowcaseSection'

export interface PersonaAssets {
  /** Visual Boost infographic (image). */
  visual: string | null
  /** Short Boost Audio, single host (mp3). */
  short: string | null
  /** Podcast Style Boost, two hosts (mp3). */
  podcast: string | null
  /** ATS resume image shown in the resume modal. */
  resume: string | null
}

export interface Persona {
  slug: string
  name: string
  /** Monogram shown in the avatar tile. */
  initials: string
  /** Avatar background; white text sits on it, so keep it dark enough for AA. */
  avatarColor: string
  /** Current role. */
  role: string
  /** What they are targeting next. */
  targetRole: string
  location: string
  /** Pill under the "The example" label on the persona page. */
  categoryTag: string
  /** Short career-state label shown on the banner card. */
  careerStage: string
  /** Intro paragraph on the persona page and the banner card summary. */
  blurb: string
  /** When true, appears in the /boosts examples banner and gets its own page. */
  featured: boolean
  assets: PersonaAssets
}

// The three Boost formats are the same for every candidate; only the assets and
// the candidate framing change. Copy is intentionally format-level, not
// persona-level, so it reads consistently across every example.
export interface BoostFormat {
  key: keyof Omit<PersonaAssets, 'resume'>
  kind: 'image' | 'audio'
  name: string
  kicker: string
  description: string
  why: string
}

export const BOOST_FORMATS: BoostFormat[] = [
  {
    key: 'visual',
    kind: 'image',
    name: 'Visual Boost',
    kicker: 'The career at a glance',
    description:
      'A single career infographic that shows the whole story in one look: the numbers, the trajectory, and the case for the next role.',
    why: 'For the hiring manager who skims first. In a few seconds they see where a candidate is heading and the proof behind it, before they read a single line of a resume.',
  },
  {
    key: 'short',
    kind: 'audio',
    name: 'Short Boost Audio',
    kicker: 'A colleague briefs the hiring manager',
    description:
      'A single-host audio overview, under two minutes, that sounds like a trusted colleague explaining why this candidate is worth a conversation.',
    why: 'For the recruiter between meetings. They press play, and by the time the coffee is poured they know who the candidate is and what they are ready for.',
  },
  {
    key: 'podcast',
    kind: 'audio',
    name: 'Podcast Style Boost',
    kicker: 'Two voices talk you through the candidate',
    description:
      'A two-host conversation, in the familiar podcast format, where two people discuss the candidate and what they would bring to a hiring team.',
    why: 'For the team that decides together. The back and forth surfaces the questions a panel would ask, and answers them, so the candidate walks in already understood.',
  },
]

export const PERSONAS: Persona[] = [
  {
    slug: 'jordan-mills',
    name: 'Jordan Mills',
    initials: 'JM',
    avatarColor: '#0F6E56',
    role: 'Customer Service Representative',
    targetRole: 'Customer Service Team Lead',
    location: 'Phoenix, AZ',
    categoryTag: 'Retail Banking | Early Career',
    careerStage: 'Early career',
    blurb:
      'Entry-level retail banking, two years in, strong performance numbers, no degree. Jordan is exactly the kind of candidate a resume flattens. Here is what Jordan looks and sounds like through three Boosts.',
    // Jordan is the featured example inline on /boosts, so he is not repeated in
    // the banner or given a duplicate standalone page.
    featured: false,
    assets: {
      visual: '/boosts/jordan-mills-visual-boost.png',
      short: '/boosts/jordan-mills-short-boost.mp3',
      podcast: '/boosts/jordan-mills-podcast-boost.mp3',
      resume: '/boosts/jordan-mills-resume.jpg',
    },
  },
  {
    slug: 'michelle-foster',
    name: 'Michelle Foster',
    initials: 'MF',
    avatarColor: '#1E3A5F',
    role: 'Chief Marketing Officer',
    targetRole: 'CMO / Marketing Executive',
    location: 'New York, NY',
    categoryTag: 'Consumer Goods | Executive',
    careerStage: 'Executive',
    blurb:
      'An 18-year CMO whose most recent company was acquired by private equity. Two brand relaunches, an acquisition integration, a full P&L; the kind of senior impact a one-page resume cannot hold. Here is what Michelle looks and sounds like through three Boosts.',
    featured: true,
    assets: { visual: null, short: null, podcast: null, resume: null },
  },
  {
    slug: 'ray-castillo',
    name: 'Ray Castillo',
    initials: 'RC',
    avatarColor: '#B45309',
    role: 'Journeyman Electrician',
    targetRole: 'Foreman',
    location: 'Denver, CO',
    categoryTag: 'Skilled Trades | Field Leadership',
    careerStage: 'Skilled trades',
    blurb:
      'Twelve years in the field, zero OSHA recordables, already leading crews of up to eight. A journeyman electrician stepping up to foreman, with proof that lives on the job site, not a resume. Here is Ray through three Boosts.',
    featured: true,
    assets: { visual: null, short: null, podcast: null, resume: null },
  },
  {
    slug: 'claire-hutchins',
    name: 'Claire Hutchins',
    initials: 'CH',
    avatarColor: '#334155',
    role: 'Retail Store Manager',
    targetRole: 'Store Manager',
    location: 'Nashville, TN',
    categoryTag: 'Specialty Retail | Returning to Work',
    careerStage: 'Returning to work',
    blurb:
      'Nine years in specialty retail, a $4.2M store, three assistant managers promoted under her, and an 18-month pause for family caregiving. Claire is ready to return, and a gap on a resume says nothing about that. Here is Claire through three Boosts.',
    featured: true,
    assets: { visual: null, short: null, podcast: null, resume: null },
  },
  {
    slug: 'ryan-kowalski',
    name: 'Ryan Kowalski',
    initials: 'RK',
    avatarColor: '#0F6E56',
    role: 'Senior Data Analyst',
    targetRole: 'Senior / Lead Data Analyst',
    location: 'Austin, TX',
    categoryTag: 'Data & Analytics | Open to Work',
    careerStage: 'Open to work',
    blurb:
      'Six years turning data into decisions, sole analyst behind a $12M ARR product line, until the role was cut in a company-wide RIF. Ryan is between roles, not between results. Here is Ryan through three Boosts.',
    featured: true,
    assets: { visual: null, short: null, podcast: null, resume: null },
  },
]

/** The Jordan Mills entry, used as the default persona for the /boosts index. */
export const DEFAULT_PERSONA: Persona = PERSONAS[0]

/** Personas shown in the examples banner and given their own shareable page. */
export const FEATURED_PERSONAS: Persona[] = PERSONAS.filter((p) => p.featured)

export function getPersona(slug: string): Persona | undefined {
  return PERSONAS.find((p) => p.slug === slug)
}

/**
 * Builds the three showcase-section props for a persona from the shared Boost
 * formats, wiring each format to that persona's asset (or null placeholder).
 */
export function buildBoostSections(persona: Persona): BoostShowcaseSectionProps[] {
  return BOOST_FORMATS.map((format, index) => ({
    index,
    kind: format.kind,
    name: format.name,
    kicker: format.kicker,
    description: format.description,
    why: format.why,
    assetSrc: persona.assets[format.key],
    assetAlt:
      format.kind === 'image' ? `${format.name} career infographic for ${persona.name}` : undefined,
    audioLabel: format.kind === 'audio' ? `${format.name} for ${persona.name}` : undefined,
    candidateName: persona.name,
    avatarInitials: persona.initials,
    avatarColor: persona.avatarColor,
  }))
}
