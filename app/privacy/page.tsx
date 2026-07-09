import type { Metadata } from 'next'
import Nav from '@/components/marketing/Nav'
import Footer from '@/components/marketing/Footer'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How RoleBoost collects, uses, and protects your information. We never sell your data, the AI never trains on it, and you can export or delete it anytime.',
  alternates: { canonical: '/privacy' },
  openGraph: { url: '/privacy', title: 'Privacy Policy | RoleBoost' },
}

const EFFECTIVE_DATE = 'July 9, 2026'
const CONTACT_EMAIL = 'privacy@roleboost.app'

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

export default function PrivacyPage() {
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
            Privacy
          </p>
          <h1 className="mt-3 font-jakarta text-4xl font-extrabold leading-tight text-[#1E3A5F] md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 font-inter text-sm text-gray-500">Last updated: {EFFECTIVE_DATE}</p>

          {/* The short version */}
          <div className="mt-8 rounded-2xl border border-[#E8E0D0] bg-white p-6 shadow-sm">
            <h2 className="font-jakarta text-base font-bold text-[#1E3A5F]">The short version</h2>
            <ul className="mt-3 space-y-2 font-inter text-[15px] leading-relaxed text-gray-700">
              <li>We never sell your information, and we never share it for advertising.</li>
              <li>The AI never trains on your data. It is used only to answer questions in the moment.</li>
              <li>Your assistant answers only from what you provide. Guardrails keep it from making things up.</li>
              <li>Your data is isolated per account, encrypted in transit, and served over private, expiring links.</li>
              <li>You can export everything, or permanently delete it, at any time.</li>
              <li>We keep your information only to run your profile and AI, and we do not mine it.</li>
            </ul>
          </div>

          <p className="mt-8 font-inter text-[15px] leading-relaxed text-gray-700">
            This policy explains what RoleBoost (&ldquo;RoleBoost&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
            collects, how we use it, and the choices you have. It covers candidates who build a profile,
            employers and recruiters who use the platform, and visitors who chat with a candidate&rsquo;s
            assistant. By using RoleBoost you agree to this policy.
          </p>

          <Section id="collect" title="Information we collect">
            <p>We collect only what we need to build and run your career profile and AI:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>Account information</strong>, such as your name and email, handled through our
                authentication provider when you sign up.
              </li>
              <li>
                <strong>Career materials you give us</strong>, such as your resume, career context,
                recommendations, custom answers, and any audio, video, images, or documents you upload
                to your profile.
              </li>
              <li>
                <strong>Conversations</strong> between recruiters and your assistant, which we log so we
                can email a transcript to both sides and help you improve your assistant over time.
              </li>
              <li>
                <strong>Usage information</strong>, such as basic, aggregated activity and diagnostics
                that help us keep the service running and improve it.
              </li>
              <li>
                <strong>Payment information</strong>, processed by our payment provider. We never see or
                store full card numbers.
              </li>
            </ul>
          </Section>

          <Section id="use" title="How we use your information">
            <ul className="ml-5 list-disc space-y-2">
              <li>To build your profile, generate your Boosts, and run your personal career AI.</li>
              <li>To deliver conversation transcripts to you and to the recruiters you speak with.</li>
              <li>To communicate with you about your account and the service.</li>
              <li>
                To improve RoleBoost using only generic, aggregated patterns, never the content of your
                career materials or conversations.
              </li>
              <li>To keep the platform secure and to prevent abuse and spam.</li>
            </ul>
            <p>
              We do not sell your information, and we do not use it for third-party advertising. We do
              not mine your career materials or conversations for any purpose beyond providing the
              service to you.
            </p>
          </Section>

          <Section id="assistant" title="Your AI assistant, and how it stays honest">
            <p>
              You train your assistant from your own information: your resume, career context,
              recommendations, and the answers you refine. Your assistant answers{' '}
              <strong>only</strong> from what you have provided.
            </p>
            <p>
              Guardrails are built in to prevent the assistant from making things up. It is restricted
              to what you have verified through your training input and uploads, and when a question
              cannot be answered from your information, it says so honestly and offers to connect the
              recruiter with you directly rather than guessing.
            </p>
          </Section>

          <Section id="recruiters" title="Recruiters and visitors">
            <p>
              When someone chats with a candidate&rsquo;s assistant, we log the conversation so we can
              email a transcript to both the visitor and the candidate. A visitor may optionally share
              their name, company, and email so the candidate knows who reached out and can follow up;
              this is never required to use the assistant.
            </p>
            <p>
              To protect candidates from abuse, the public assistant is rate-limited and screened for
              automated traffic. We do not build advertising profiles of visitors.
            </p>
          </Section>

          <Section id="sharing" title="How we share information">
            <p>
              We never sell your data. We share it only with a short list of trusted service providers
              (&ldquo;sub-processors&rdquo;) that we rely on to run RoleBoost. They process your data
              only on our instructions, only to provide their part of the service, and never for their
              own purposes:
            </p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>Clerk</strong>, sign-in and account authentication.
              </li>
              <li>
                <strong>Supabase</strong>, database and file storage.
              </li>
              <li>
                <strong>Anthropic</strong>, the AI that powers your assistant and content generation.
              </li>
              <li>
                <strong>Resend</strong>, delivery of transcript and notification emails.
              </li>
              <li>
                <strong>Paddle</strong>, payment processing.
              </li>
              <li>
                <strong>Vercel</strong>, secure hosting of the application.
              </li>
            </ul>
            <p>
              We may also disclose information if required by law, or to protect the rights, safety, and
              security of our users and the service.
            </p>
          </Section>

          <Section id="ai-training" title="AI providers do not train on your data">
            <p>
              Your assistant runs on Anthropic&rsquo;s API. Your information is used only to generate
              responses in the moment. Neither Anthropic nor any other AI provider uses your data to
              train or improve their models.
            </p>
          </Section>

          <Section id="security" title="How we protect your information">
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>Isolation by default.</strong> Every account&rsquo;s data is separated at the
                database level with Row-Level Security, so one user can never see another&rsquo;s data.
              </li>
              <li>
                <strong>Encryption in transit</strong> for data moving between you and RoleBoost.
              </li>
              <li>
                <strong>Private storage.</strong> Your uploaded files are stored privately and served
                only through short-lived, expiring links.
              </li>
              <li>
                <strong>Limited internal access.</strong> Access to your information is restricted to
                what is necessary to operate and support the service, and is not used for anything else.
              </li>
              <li>
                <strong>AI guardrails</strong> that keep your public assistant grounded strictly in the
                information you have provided.
              </li>
            </ul>
            <p>
              No system can be guaranteed perfectly secure, but we work hard to protect your
              information. If a data breach ever affects your personal information, we will notify you
              and the appropriate authorities as required by law.
            </p>
          </Section>

          <Section id="retention" title="Data retention and deletion">
            <p>
              We keep your information only for as long as your account is active or as needed to
              provide the service. When you delete your data, or your account, we remove it from our
              systems.
            </p>
            <p>
              Some material is short-lived by design. For example, when you sharpen your assistant with
              an external interview transcript, it is analyzed in the moment and then discarded; only
              the resulting improvements are kept.
            </p>
          </Section>

          <Section id="rights" title="Your rights and choices">
            <p>You stay in control of your information at all times. From your account you can:</p>
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <strong>Export</strong> everything we hold for you, as a data file or a full archive
                including your media, at any time.
              </li>
              <li>
                <strong>Correct or update</strong> your profile and career information.
              </li>
              <li>
                <strong>Delete</strong> your data, or your entire account, permanently.
              </li>
              <li>
                <strong>Take your profile private</strong> or turn your AI assistant off.
              </li>
              <li>
                <strong>Control search visibility.</strong> Your profile is kept out of search engines
                unless you choose to make it discoverable.
              </li>
            </ul>
            <p>
              Depending on where you live, you may have additional rights over your personal
              information, such as the right to access, correct, or delete it. To exercise any of these,
              contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#B45309] hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section id="cookies" title="Cookies">
            <p>
              We use only the essential cookies needed to keep you signed in and to keep the service
              secure. We do not use advertising or cross-site tracking cookies.
            </p>
          </Section>

          <Section id="children" title="Children">
            <p>
              RoleBoost is intended for working professionals and is not directed to anyone under 16. We
              do not knowingly collect information from children. If you believe a child has provided us
              information, contact us and we will delete it.
            </p>
          </Section>

          <Section id="international" title="International users">
            <p>
              RoleBoost is operated from the United States, and your information may be processed there
              and in the regions where our service providers operate. By using RoleBoost, you understand
              your information may be transferred to and processed in these locations.
            </p>
          </Section>

          <Section id="changes" title="Changes to this policy">
            <p>
              We may update this policy from time to time. When we make material changes, we will update
              the date above and, where appropriate, let you know. Your continued use of RoleBoost after
              an update means you accept the revised policy.
            </p>
          </Section>

          <Section id="contact" title="Contact us">
            <p>
              If you have any questions about this policy or your information, reach us at{' '}
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
