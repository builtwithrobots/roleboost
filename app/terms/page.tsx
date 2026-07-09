import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/marketing/Nav'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms for using RoleBoost: your account and content, acceptable use, how your AI assistant works, payments, and the usual legal basics, in plain English.',
  alternates: { canonical: '/terms' },
  openGraph: { url: '/terms', title: 'Terms of Service | RoleBoost' },
}

const EFFECTIVE_DATE = 'July 9, 2026'
const CONTACT_EMAIL = 'legal@roleboost.app'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="font-jakarta text-2xl font-bold text-[#1E3A5F]">
        {title}
      </h2>
      <div className="mt-3 space-y-4 font-inter text-[15px] leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  )
}

export default function TermsPage() {
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
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.12em] text-[#D97706]">
            Legal
          </p>
          <h1 className="mt-3 font-jakarta text-4xl font-extrabold leading-tight text-[#1E3A5F] md:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-3 font-inter text-sm text-gray-500">Last updated: {EFFECTIVE_DATE}</p>

          {/* The short version */}
          <div className="mt-8 rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="font-jakarta text-base font-bold text-[#1E3A5F]">The short version</h2>
            <ul className="mt-3 space-y-2 font-inter text-[15px] leading-relaxed text-gray-700">
              <li>Use RoleBoost honestly. Only upload information that is true and yours to share.</li>
              <li>You own your content. You let us host and process it so we can run your profile and AI.</li>
              <li>Your assistant represents the information you give it. It is a tool, not a guarantee of a job.</li>
              <li>Do not misuse the platform, other people&rsquo;s data, or the AI.</li>
              <li>Some features are paid. You can cancel anytime.</li>
              <li>You can stop and delete your account whenever you want.</li>
            </ul>
          </div>

          <p className="mt-8 font-inter text-[15px] leading-relaxed text-gray-700">
            These Terms of Service (&ldquo;Terms&rdquo;) are an agreement between you and RoleBoost
            (&ldquo;RoleBoost&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). They cover your use of our
            website, apps, and services (the &ldquo;Service&rdquo;). By creating an account or using the
            Service, you agree to these Terms and to our{' '}
            <Link href="/privacy" className="font-medium text-[#B45309] hover:underline">
              Privacy Policy
            </Link>
            . If you do not agree, please do not use the Service.
          </p>

          <Section id="who" title="Who can use RoleBoost">
            <p>
              You must be at least 16 years old and able to form a binding agreement to use RoleBoost.
              If you use the Service on behalf of a company, you confirm you are authorized to accept
              these Terms for that company.
            </p>
          </Section>

          <Section id="accounts" title="Your account">
            <p>
              You are responsible for your account and for keeping your login secure. Provide accurate
              information, keep it up to date, and let us know if you suspect unauthorized use. One
              person or entity per account; do not share your login.
            </p>
          </Section>

          <Section id="content" title="Your content">
            <p>
              You keep ownership of everything you provide, including your resume, career context,
              recommendations, uploads, and the answers you write to train your assistant (&ldquo;Your
              Content&rdquo;).
            </p>
            <p>
              You grant us a limited license to store, process, display, and transmit Your Content only
              as needed to operate the Service for you, such as building your profile, generating your
              Boosts, running your assistant, and delivering transcripts. This license ends when you
              delete Your Content or your account, except for copies kept briefly in backups or as
              required by law.
            </p>
            <p>
              You are responsible for Your Content. You confirm it is accurate, that it is yours to
              share, and that sharing it through RoleBoost does not break any law or agreement or
              infringe anyone&rsquo;s rights. If you include information about other people, such as
              references or recommendations, you confirm you have the right to do so.
            </p>
          </Section>

          <Section id="acceptable-use" title="Acceptable use">
            <p>When using RoleBoost, you agree not to:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>Provide false, misleading, or fraudulent information, or impersonate anyone.</li>
              <li>Upload content you do not have the right to share, or that infringes others&rsquo; rights.</li>
              <li>Break the law, or use the Service to harass, harm, or defraud others.</li>
              <li>Abuse, overload, scrape, or attempt to game the AI or the platform.</li>
              <li>Send spam, or use the Service to send unsolicited or deceptive messages.</li>
              <li>Reverse engineer, copy, or resell the Service, or bypass its security or usage limits.</li>
              <li>Interfere with the Service or access data that is not yours.</li>
            </ul>
          </Section>

          <Section id="assistant" title="Your AI assistant">
            <p>
              Your assistant answers only from the information you provide and train it with, and it is
              built with guardrails to keep it grounded in that information rather than making things up.
              Because you control what it learns, you are responsible for the accuracy of the
              information you give it.
            </p>
            <p>
              The assistant, and RoleBoost generally, is a tool to help you present your experience and
              connect with employers. It is not a guarantee of an interview, an offer, or any hiring
              outcome, and we are not a party to any hiring decision between you and an employer.
            </p>
          </Section>

          <Section id="employers" title="For employers and recruiters">
            <p>
              If you use RoleBoost to evaluate candidates, you agree to use the Service and any candidate
              information only for legitimate hiring purposes, to respect candidates&rsquo; privacy, and
              to comply with all laws that apply to your hiring, including equal-opportunity and
              anti-discrimination laws. Candidate assistants reflect information provided by the
              candidate and may not be complete or perfectly accurate.
            </p>
          </Section>

          <Section id="payments" title="Payments and subscriptions">
            <p>
              Some features are free and others require a paid subscription, which may include a free
              trial. Paid plans are billed through our payment provider on a recurring basis until you
              cancel. Prices and features may change; we will give notice of material changes to paid
              plans.
            </p>
            <p>
              You can cancel anytime, and cancellation takes effect at the end of your current billing
              period. Except where required by law, payments are non-refundable. You are responsible for
              any taxes that apply to your purchase.
            </p>
          </Section>

          <Section id="ip" title="Our intellectual property">
            <p>
              The Service, including its software, design, and the RoleBoost name and logo, belongs to
              us and is protected by law. These Terms do not give you any right to our intellectual
              property beyond using the Service as intended.
            </p>
          </Section>

          <Section id="third-parties" title="Third-party services">
            <p>
              RoleBoost relies on third-party providers to operate, and the Service may link to or work
              with other services. We are not responsible for third-party services, and your use of them
              may be subject to their own terms.
            </p>
          </Section>

          <Section id="disclaimers" title="Disclaimers">
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
              warranties of any kind, whether express or implied, to the fullest extent permitted by
              law. We do not warrant that the Service will be uninterrupted or error-free, or that AI
              output will be complete or accurate. AI-generated content can contain mistakes; use your
              own judgment.
            </p>
          </Section>

          <Section id="liability" title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, RoleBoost will not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or for any lost profits, data, or
              goodwill. Our total liability for any claim relating to the Service will not exceed the
              greater of the amount you paid us in the twelve months before the claim, or one hundred US
              dollars.
            </p>
          </Section>

          <Section id="indemnity" title="Indemnification">
            <p>
              You agree to indemnify and hold RoleBoost harmless from claims, losses, and expenses
              arising out of Your Content, your use of the Service, or your violation of these Terms or
              of any law or the rights of others.
            </p>
          </Section>

          <Section id="termination" title="Suspension and termination">
            <p>
              You can stop using RoleBoost and delete your account at any time. We may suspend or end
              your access if you violate these Terms, misuse the Service, or create risk or legal
              exposure for us or others. When your account ends, your right to use the Service stops, and
              we will handle your data as described in our Privacy Policy.
            </p>
          </Section>

          <Section id="changes" title="Changes to these Terms">
            <p>
              We may update these Terms from time to time. When we make material changes, we will update
              the date above and, where appropriate, let you know. Your continued use of the Service
              after an update means you accept the revised Terms.
            </p>
          </Section>

          <Section id="law" title="Governing law">
            <p>
              These Terms are governed by the laws of the United States and the state in which RoleBoost
              is established, without regard to conflict-of-laws rules. Any dispute will be handled in
              the courts located there, unless the law that applies to you provides otherwise.
            </p>
          </Section>

          <Section id="contact" title="Contact us">
            <p>
              Questions about these Terms? Reach us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#B45309] hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
