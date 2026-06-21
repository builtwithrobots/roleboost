import Link from 'next/link';
import RoleBoostLogo from '@/components/layout/RoleBoostLogo';
import { Mic2, Bot, BarChart3, Share2, CheckCircle, ArrowRight, Zap } from 'lucide-react';

function Header() {
  return (
    <header className="sticky top-0 z-[--z-sticky] border-b border-[--rb-border] bg-[--rb-bg-surface]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <RoleBoostLogo />
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="#features" className="text-sm font-medium text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">
            Features
          </Link>
          <Link href="#how-it-works" className="text-sm font-medium text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">
            How it works
          </Link>
          <Link href="#pricing" className="text-sm font-medium text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-[--radius-md] px-4 py-2 text-sm font-semibold text-[--rb-text-secondary] transition-colors hover:text-[--rb-text] hover:bg-[--rb-bg-surface-raised]"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 rounded-[--radius-md] bg-[--rb-brand] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[--rb-brand-hover] hover:shadow-md active:scale-[0.98]"
          >
            Get started
            <ArrowRight className="size-3.5" strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-80px] h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[--rb-brand-subtle] opacity-70 blur-[120px]" />
        <div className="absolute right-[-100px] top-[100px] h-[300px] w-[400px] rounded-full bg-violet-100 opacity-40 blur-[80px]" />
      </div>

      <div className="mx-auto max-w-4xl px-6 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[--rb-border-brand] bg-[--rb-brand-subtle] px-4 py-1.5">
          <Zap className="size-3.5 text-[--rb-brand]" strokeWidth={2.5} />
          <span className="text-xs font-semibold tracking-wide text-[--rb-text-brand] uppercase">AI-powered candidate intelligence</span>
        </div>

        {/* Headline */}
        <h1 className="mb-6 font-display text-5xl font-extrabold tracking-tight text-[--rb-text] sm:text-6xl lg:text-7xl">
          Your career.{' '}
          <span className="gradient-text">Your AI.</span>
          <br />
          Finally heard.
        </h1>

        {/* Subtext */}
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[--rb-text-secondary] sm:text-xl">
          Upload your career story once. Get a personal AI that represents you 24/7 to every hiring manager — audio, video, deck, resume, and a live chatbot they can interrogate anytime.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[--radius-md] bg-[--rb-brand] px-8 py-3.5 text-base font-semibold text-white shadow-[0_2px_12px_rgb(79_70_229_/_0.35)] transition-all hover:bg-[--rb-brand-hover] hover:shadow-[0_4px_20px_rgb(79_70_229_/_0.45)] active:scale-[0.98] sm:w-auto"
          >
            Get started for free
            <ArrowRight className="size-4" strokeWidth={2.5} />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex w-full items-center justify-center rounded-[--radius-md] border border-[--rb-border-strong] bg-[--rb-bg-surface] px-8 py-3.5 text-base font-semibold text-[--rb-text] transition-all hover:bg-[--rb-bg-surface-raised] hover:border-[--rb-text-muted] sm:w-auto"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-sm text-[--rb-text-muted]">Free for candidates · No credit card required</p>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Mic2,
    title: 'Multi-format career narrative',
    description: 'Audio overview, debate clips, video intro, slide deck, infographic, and ATS resume — all living behind one shareable link.',
  },
  {
    icon: Bot,
    title: 'Your personal career AI',
    description: 'A Claude-powered chatbot trained on your career data answers recruiter questions around the clock, with every conversation emailed to both sides.',
  },
  {
    icon: Share2,
    title: 'One link, everything',
    description: 'Share a single URL or QR code. Hiring managers get your full career story in the format they prefer — no attachments, no scheduling friction.',
  },
  {
    icon: BarChart3,
    title: "Know who's interested",
    description: 'See who viewed your profile, how long they stayed, and which assets they engaged with. Fine-tune your AI based on what recruiters actually ask.',
  },
];

function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[--rb-text-brand]">Everything you need</p>
          <h2 className="mb-4 font-display text-3xl font-bold tracking-tight text-[--rb-text] sm:text-4xl">
            Stand out before the first interview
          </h2>
          <p className="mx-auto max-w-2xl text-[--rb-text-secondary]">
            When everyone sounds the same on paper, RoleBoost makes sure you&apos;re heard.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rb-card group p-6 transition-all hover:-translate-y-0.5"
            >
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-[--radius-lg] bg-[--rb-brand-subtle] ring-1 ring-[--rb-border-brand]/40">
                <f.icon className="size-5 text-[--rb-brand]" strokeWidth={1.5} />
              </div>
              <h3 className="mb-2 font-display text-base font-semibold text-[--rb-text]">{f.title}</h3>
              <p className="text-sm leading-relaxed text-[--rb-text-secondary]">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  { step: '01', title: 'Create your profile', body: 'Add your career context, upload your NotebookLM-produced audio, video, deck, and resume.' },
  { step: '02', title: 'Get your link', body: 'Share one URL or QR code with any hiring manager or paste it into job applications.' },
  { step: '03', title: 'Your AI does the work', body: 'Recruiters chat with your personal AI anytime. You receive a full transcript of every conversation.' },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-[--rb-border] bg-[--rb-bg-surface] py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[--rb-text-brand]">Simple process</p>
          <h2 className="mb-4 font-display text-3xl font-bold tracking-tight text-[--rb-text] sm:text-4xl">How it works</h2>
          <p className="text-[--rb-text-secondary]">Up and running in under an hour.</p>
        </div>
        <div className="space-y-0">
          {steps.map((s, i) => (
            <div key={s.step} className="flex gap-6">
              <div className="flex shrink-0 flex-col items-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-[--rb-brand] font-data text-sm font-bold text-white shadow-[0_2px_8px_rgb(79_70_229_/_0.30)]">
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className="my-1 w-px grow bg-gradient-to-b from-[--rb-brand]/40 to-[--rb-border]" />
                )}
              </div>
              <div className="pb-10">
                <p className="mb-0.5 font-data text-[10px] font-bold tracking-[0.15em] text-[--rb-text-muted] uppercase">{s.step}</p>
                <h3 className="mb-2 font-display text-lg font-semibold text-[--rb-text]">{s.title}</h3>
                <p className="text-[--rb-text-secondary]">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const candidateFeatures = [
  'Free for candidates, forever',
  'Personal AI chatbot',
  'Profile analytics',
  'QR code & shareable link',
  'Email transcripts after every conversation',
];
const employerFeatures = [
  'Saved candidate pool',
  'Candidate stage board',
  'AI chat with any candidate',
  'Team collaboration',
  'Feedback to candidates',
];

function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[--rb-text-brand]">Pricing</p>
          <h2 className="mb-4 font-display text-3xl font-bold tracking-tight text-[--rb-text] sm:text-4xl">Simple, transparent pricing</h2>
          <p className="text-[--rb-text-secondary]">Candidates are always free. Employers get powerful hiring tools.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Candidate card */}
          <div className="rb-card flex flex-col p-8">
            <div className="mb-6">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[--rb-text-muted]">Candidate</p>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold text-[--rb-text]">$0</span>
                <span className="text-[--rb-text-muted]">/ forever</span>
              </div>
              <p className="mt-2 text-sm text-[--rb-text-secondary]">Everything you need to get hired.</p>
            </div>
            <ul className="mb-8 grow space-y-3">
              {candidateFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-[--rb-text-secondary]">
                  <CheckCircle className="size-4 shrink-0 text-[--color-success]" strokeWidth={2} />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="block w-full rounded-[--radius-md] border border-[--rb-border-strong] px-6 py-3 text-center text-sm font-semibold text-[--rb-text] transition-all hover:bg-[--rb-bg-surface-raised] hover:border-[--rb-text-muted] active:scale-[0.98]"
            >
              Create your profile
            </Link>
          </div>

          {/* Employer card — featured */}
          <div className="rb-card relative flex flex-col overflow-hidden p-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-[--rb-brand-gradient]" />
            <div className="absolute inset-0 bg-gradient-to-br from-[--rb-brand-subtle]/60 to-transparent pointer-events-none" />

            <div className="relative mb-6">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[--rb-brand] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Most popular
              </div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[--rb-text-muted]">Employer</p>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold text-[--rb-text]">$49</span>
                <span className="text-[--rb-text-muted]">/ month</span>
              </div>
              <p className="mt-2 text-sm text-[--rb-text-secondary]">Hire smarter with AI-powered candidate profiles.</p>
            </div>
            <ul className="relative mb-8 grow space-y-3">
              {employerFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-[--rb-text-secondary]">
                  <CheckCircle className="size-4 shrink-0 text-[--rb-brand]" strokeWidth={2} />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="relative block w-full rounded-[--radius-md] bg-[--rb-brand] px-6 py-3 text-center text-sm font-semibold text-white shadow-[0_2px_12px_rgb(79_70_229_/_0.30)] transition-all hover:bg-[--rb-brand-hover] hover:shadow-[0_4px_16px_rgb(79_70_229_/_0.40)] active:scale-[0.98]"
            >
              Start hiring smarter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative overflow-hidden border-t border-[--rb-border] py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[--rb-brand-subtle] opacity-60 blur-[100px]" />
      </div>
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="mb-4 font-display text-3xl font-bold tracking-tight text-[--rb-text] sm:text-4xl lg:text-5xl">
          Ready to be heard?
        </h2>
        <p className="mb-10 text-lg text-[--rb-text-secondary]">
          Join candidates who are giving hiring managers everything they need — in minutes.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 rounded-[--radius-md] bg-[--rb-brand] px-10 py-4 text-base font-semibold text-white shadow-[0_2px_16px_rgb(79_70_229_/_0.35)] transition-all hover:bg-[--rb-brand-hover] hover:shadow-[0_4px_24px_rgb(79_70_229_/_0.45)] active:scale-[0.98]"
        >
          Get started for free
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </Link>
        <p className="mt-4 text-sm text-[--rb-text-muted]">No credit card required · Takes less than 5 minutes</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[--rb-border] bg-[--rb-bg-surface]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <RoleBoostLogo />
            <p className="mt-2 max-w-xs text-sm text-[--rb-text-muted]">
              When everyone sounds the same on paper — be heard.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            <Link href="/sign-in" className="text-sm text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">Sign in</Link>
            <Link href="/sign-up" className="text-sm text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">Get started</Link>
            <Link href="#features" className="text-sm text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">Features</Link>
            <Link href="#how-it-works" className="text-sm text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">How it works</Link>
            <Link href="#pricing" className="text-sm text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">Pricing</Link>
          </nav>
        </div>
        <div className="mt-10 border-t border-[--rb-border] pt-6 text-sm text-[--rb-text-muted]">
          © {new Date().getFullYear()} RoleBoost. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[--rb-bg-page]">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
