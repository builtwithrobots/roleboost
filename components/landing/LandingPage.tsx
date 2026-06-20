import Link from 'next/link';
import RoleBoostLogo from '@/components/layout/RoleBoostLogo';
import { Mic2, Bot, BarChart3, Share2, CheckCircle } from 'lucide-react';

function Header() {
  return (
    <header className="sticky top-0 z-[--z-sticky] border-b border-[--rb-border] bg-[--rb-bg-surface]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <RoleBoostLogo />
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="#features" className="text-sm font-medium text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">
            Features
          </Link>
          <Link href="#how-it-works" className="text-sm font-medium text-[--rb-text-secondary] transition-colors hover:text-[--rb-text]">
            How it works
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-[--radius-md] px-4 py-2 text-sm font-semibold text-[--rb-text] transition-colors hover:bg-[--rb-bg-surface-raised]"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-[--radius-md] bg-[--rb-brand] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[--rb-brand-hover]"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[--rb-brand-subtle] opacity-60 blur-3xl" />
      </div>
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[--rb-border-brand] bg-[--rb-brand-subtle] px-4 py-1.5 text-sm font-medium text-[--rb-text-brand]">
          <span className="size-1.5 rounded-full bg-[--rb-brand]" aria-hidden="true" />
          AI-powered candidate intelligence
        </div>
        <h1 className="mb-6 font-display text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
          Your career.{' '}
          <span className="gradient-text">Your AI.</span>
          <br />
          Finally heard.
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-[--rb-text-secondary] sm:text-xl">
          Upload your career story once. Get a personal AI that represents you 24/7 to every hiring manager — audio, video, deck, resume, and a live chatbot they can interrogate anytime.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className="w-full rounded-[--radius-md] bg-[--rb-brand] px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[--rb-brand-hover] sm:w-auto"
          >
            Get started for free
          </Link>
          <Link
            href="/sign-in"
            className="w-full rounded-[--radius-md] border border-[--rb-border-strong] bg-[--rb-bg-surface] px-8 py-3.5 text-base font-semibold text-[--rb-text] transition-colors hover:bg-[--rb-bg-surface-raised] sm:w-auto"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-sm text-[--rb-text-muted]">Free for candidates. No credit card required.</p>
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
    title: 'Know who\'s interested',
    description: 'See who viewed your profile, how long they stayed, and which assets they engaged with. Fine-tune your AI based on what recruiters actually ask.',
  },
];

function Features() {
  return (
    <section id="features" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything hiring managers need — instantly
          </h2>
          <p className="mx-auto max-w-2xl text-[--rb-text-secondary]">
            When everyone sounds the same on paper, RoleBoost makes sure you&apos;re heard.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rb-card p-6">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-[--radius-lg] bg-[--rb-brand-subtle]">
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
    <section id="how-it-works" className="border-t border-[--rb-border] bg-[--rb-bg-surface] py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="text-[--rb-text-secondary]">Up and running in under an hour.</p>
        </div>
        <div className="space-y-8">
          {steps.map((s, i) => (
            <div key={s.step} className="flex gap-6">
              <div className="flex shrink-0 flex-col items-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-[--rb-brand] font-data text-sm font-bold text-white">
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className="mt-2 w-px grow bg-[--rb-border]" />
                )}
              </div>
              <div className="pb-8">
                <p className="mb-0.5 font-data text-xs font-semibold tracking-widest text-[--rb-text-muted] uppercase">{s.step}</p>
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

const candidateFeatures = ['Free for candidates, forever', 'Personal AI chatbot', 'Profile analytics', 'QR code & shareable link', 'Email transcripts after every conversation'];
const employerFeatures = ['Saved candidate pool', 'Candidate stage board', 'AI chat with any candidate', 'Team collaboration', 'Feedback to candidates'];

function Pricing() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">Simple pricing</h2>
          <p className="text-[--rb-text-secondary]">Candidates are always free. Employers get powerful hiring tools.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rb-card p-8">
            <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[--rb-text-muted]">Candidate</p>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-extrabold text-[--rb-text]">$0</span>
              <span className="text-[--rb-text-secondary]">/ forever</span>
            </div>
            <ul className="mb-8 space-y-3">
              {candidateFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-[--rb-text-secondary]">
                  <CheckCircle className="size-4 shrink-0 text-[--color-success]" strokeWidth={1.5} />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className="block w-full rounded-[--radius-md] border border-[--rb-border-strong] px-6 py-3 text-center text-sm font-semibold text-[--rb-text] transition-colors hover:bg-[--rb-bg-surface-raised]">
              Create your profile
            </Link>
          </div>
          <div className="rb-card relative overflow-hidden p-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-[--rb-brand-gradient]" />
            <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[--rb-text-muted]">Employer</p>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-extrabold text-[--rb-text]">$49</span>
              <span className="text-[--rb-text-secondary]">/ month</span>
            </div>
            <ul className="mb-8 space-y-3">
              {employerFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-[--rb-text-secondary]">
                  <CheckCircle className="size-4 shrink-0 text-[--color-success]" strokeWidth={1.5} />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className="block w-full rounded-[--radius-md] bg-[--rb-brand] px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[--rb-brand-hover]">
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
    <section className="border-t border-[--rb-border] py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to be heard?
        </h2>
        <p className="mb-8 text-lg text-[--rb-text-secondary]">
          Join candidates who are giving hiring managers everything they need — in minutes.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex rounded-[--radius-md] bg-[--rb-brand] px-10 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[--rb-brand-hover]"
        >
          Get started for free
        </Link>
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
            <Link href="/sign-in" className="text-sm text-[--rb-text-secondary] hover:text-[--rb-text]">Sign in</Link>
            <Link href="/sign-up" className="text-sm text-[--rb-text-secondary] hover:text-[--rb-text]">Get started</Link>
            <Link href="#features" className="text-sm text-[--rb-text-secondary] hover:text-[--rb-text]">Features</Link>
            <Link href="#how-it-works" className="text-sm text-[--rb-text-secondary] hover:text-[--rb-text]">How it works</Link>
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
