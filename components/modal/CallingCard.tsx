'use client';

import { motion, useReducedMotion } from 'motion/react';
import { MapPin, ExternalLink, MessageCircle, ChevronDown } from 'lucide-react';
import { staggerContainer, fadeUp } from '@/lib/motion';
import ChatPanel from '@/components/chat/ChatPanel';
import ShareButton from '@/components/ui/ShareButton';
import AssetGallery from './AssetGallery';

type AssetType = 'audio' | 'debate_audio' | 'video' | 'deck' | 'infographic' | 'resume';

interface Asset {
  asset_type: AssetType;
  file_name: string;
  signed_url: string;
}

interface Props {
  slug: string;
  fullName: string;
  headline: string | null;
  targetRole: string | null;
  location: string | null;
  linkedinUrl: string | null;
  summaryBullets: string[];
  aiEnabled: boolean;
  avatarUrl?: string | null;
  assets: Asset[];
}

const OPENERS = [
  'Why are you exploring new roles?',
  'Walk me through your most recent role.',
  "What's a win you're proud of?",
  'What are you looking for next?',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}

/**
 * The public calling card, a two-pane recruiter cockpit that fits above the fold:
 * the live conversation on the left, the candidate dossier on the right (career
 * snapshot open at top, then each asset as its own collapsible bar, rolled up by
 * default and loaded lazily when opened). Columns stack on mobile.
 */
export default function CallingCard({
  slug,
  fullName,
  headline,
  targetRole,
  location,
  linkedinUrl,
  summaryBullets,
  aiEnabled,
  avatarUrl,
  assets,
}: Props) {
  const prefersReduced = useReducedMotion();
  const firstName = fullName.split(' ')[0] || fullName;
  const hasAssets = assets.length > 0;
  const hasBullets = summaryBullets.length > 0;
  const hasRight = hasAssets || hasBullets;

  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      <div className="rb-dot-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/4 top-24 size-72 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'var(--rb-brand-gradient)' }}
        aria-hidden="true"
      />

      <div className="absolute right-4 top-4 z-10">
        <ShareButton
          title={`${fullName} on RoleBoost`}
          text={`Ask ${firstName}'s Personal Assistant anything about their career`}
          iconOnly
          className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] text-[var(--rb-text-secondary)] shadow-[var(--shadow-card)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
        />
      </div>

      <motion.div
        variants={staggerContainer}
        initial={prefersReduced ? false : 'hidden'}
        animate="visible"
        className={`relative mx-auto grid gap-6 px-4 py-6 sm:px-6 lg:h-[100svh] lg:items-stretch lg:gap-8 lg:py-8 ${
          hasRight ? 'max-w-7xl lg:grid-cols-2' : 'max-w-2xl'
        }`}
      >
        {/* ── Left, profile + live chat ─────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex min-h-0 flex-col">
          <div className="flex items-center gap-4">
            <div
              className="rb-glow flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-white"
              style={{ background: 'var(--rb-brand-gradient)' }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName} className="size-full object-cover" />
              ) : (
                getInitials(fullName)
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--rb-text)] sm:text-3xl">
                {fullName}
              </h1>
              {targetRole && (
                <p className="text-sm font-semibold text-[var(--rb-text-brand)]">{targetRole}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--rb-text-muted)]">
                {location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {location}
                  </span>
                )}
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[var(--rb-text-brand)] hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>

          {headline && (
            <p className="mt-4 text-sm leading-relaxed text-[var(--rb-text-secondary)]">{headline}</p>
          )}

          {aiEnabled ? (
            <div className="mt-5 h-[60vh] min-h-0 overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--rb-border)] shadow-[var(--shadow-card)] lg:mt-6 lg:h-auto lg:flex-1">
              <ChatPanel
                candidateSlug={slug}
                candidateName={fullName}
                mode="live"
                suggestedQuestions={OPENERS}
                fill
              />
            </div>
          ) : (
            <div className="mt-6 rounded-[var(--radius-2xl)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-6">
              <MessageCircle className="mb-2 size-6 text-[var(--rb-text-muted)]" />
              <p className="text-sm text-[var(--rb-text-secondary)]">
                {firstName}&apos;s Personal Assistant is offline right now.
                {linkedinUrl ? ' Reach out directly:' : ' Check back soon.'}
              </p>
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--rb-text-brand)] hover:underline"
                >
                  Connect on LinkedIn
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Right, the dossier: snapshot rolled up + assets ────────────── */}
        {hasRight && (
          <motion.div variants={fadeUp} className="flex min-h-0 flex-col gap-4">
            {hasBullets && (
              <details open className="rb-card group [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
                  <span className="rb-section-label">Career snapshot</span>
                  <ChevronDown className="size-4 text-[var(--rb-text-muted)] transition-transform group-open:rotate-180" />
                </summary>
                <ul className="flex flex-col gap-2 px-4 pb-4">
                  {summaryBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--rb-text-secondary)]">
                      <span className="mt-0.5 shrink-0 font-bold text-[var(--rb-brand)]">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {hasAssets && (
              <div className="h-[60vh] min-h-0 lg:h-auto lg:flex-1">
                <AssetGallery firstName={firstName} assets={assets} fill />
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
