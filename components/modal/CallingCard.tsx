'use client';

import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, MapPin, ExternalLink, Sparkles, MessageCircle } from 'lucide-react';
import { staggerContainer, fadeUp } from '@/lib/motion';
import ChatOverlay from '@/components/chat/ChatOverlay';
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

// Universal openers, work for any candidate and need no sensitive brain fields
// (the anon client cannot read those anyway).
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
 * The public calling card. A two-column hero that fits above the fold: profile
 * and the chat launcher on the left, the asset suite on the right. The
 * conversation is still the hero (tapping the launcher or a chip opens it). On
 * narrow screens the columns stack. The career snapshot sits just below when
 * assets already occupy the right column.
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
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<{ text: string; nonce: number }>();
  const nonceRef = useRef(0);

  const firstName = fullName.split(' ')[0] || fullName;
  const hasAssets = assets.length > 0;
  const hasBullets = summaryBullets.length > 0;
  const twoCol = hasAssets || hasBullets;
  // The snapshot drops below the hero only when assets already hold the right column.
  const snapshotBelow = hasAssets && hasBullets;

  const openBlank = () => {
    setSeed(undefined);
    setOpen(true);
  };
  const openWith = (q: string) => {
    nonceRef.current += 1;
    setSeed({ text: q, nonce: nonceRef.current });
    setOpen(true);
  };

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="rb-dot-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div
          className="pointer-events-none absolute left-1/4 top-24 size-72 -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--rb-brand-gradient)' }}
          aria-hidden="true"
        />

        <div className="absolute right-4 top-4 z-10">
          <ShareButton
            title={`${fullName} on RoleBoost`}
            text={`Ask ${firstName}'s career AI anything about their career`}
            iconOnly
            className="inline-flex size-11 items-center justify-center rounded-full border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] text-[var(--rb-text-secondary)] shadow-[var(--shadow-card)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
          />
        </div>

        <motion.div
          variants={staggerContainer}
          initial={prefersReduced ? false : 'hidden'}
          animate="visible"
          className={`relative mx-auto grid min-h-[100svh] items-center gap-10 px-6 py-14 ${
            twoCol ? 'max-w-6xl lg:grid-cols-[1.05fr_0.95fr]' : 'max-w-2xl'
          }`}
        >
          {/* ── Left, profile + chat ──────────────────────────────────────── */}
          {/* motion.div with its own stagger: it is a direct child of the outer
              staggerContainer (so it sequences with the right panel) and it
              re-staggers its own fadeUp children. A plain div here would break
              Framer Motion's variant propagation and the entrance animation. */}
          <motion.div
            variants={staggerContainer}
            className={`flex flex-col ${
              twoCol ? 'items-center text-center lg:items-start lg:text-left' : 'items-center text-center'
            }`}
          >
            <motion.div
              variants={fadeUp}
              className="rb-glow mb-6 flex size-20 items-center justify-center overflow-hidden rounded-full text-2xl font-bold text-white"
              style={{ background: 'var(--rb-brand-gradient)' }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName} className="size-full object-cover" />
              ) : (
                getInitials(fullName)
              )}
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-display text-4xl font-bold tracking-tight text-[var(--rb-text)] sm:text-5xl"
            >
              {fullName}
            </motion.h1>

            {targetRole && (
              <motion.p variants={fadeUp} className="mt-2 text-base font-semibold text-[var(--rb-text-brand)]">
                {targetRole}
              </motion.p>
            )}

            <motion.div
              variants={fadeUp}
              className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--rb-text-muted)] ${
                twoCol ? 'justify-center lg:justify-start' : 'justify-center'
              }`}
            >
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
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
                  <ExternalLink className="size-3.5" />
                  LinkedIn
                </a>
              )}
            </motion.div>

            {headline && (
              <motion.p
                variants={fadeUp}
                className="mt-5 max-w-xl text-base leading-relaxed text-[var(--rb-text-secondary)]"
              >
                {headline}
              </motion.p>
            )}

            {aiEnabled ? (
              <>
                <motion.button
                  variants={fadeUp}
                  onClick={openBlank}
                  className="group mt-8 flex w-full max-w-xl items-center justify-between gap-3 rounded-full border border-[var(--rb-border-strong)] bg-[var(--rb-bg-surface)] px-5 py-4 text-left shadow-[var(--shadow-card)] transition-all duration-[var(--duration-base)] hover:border-[var(--rb-brand)] hover:shadow-[var(--shadow-card-hover)]"
                >
                  <span className="flex items-center gap-2 text-[var(--rb-text-muted)]">
                    <Sparkles className="size-4 text-[var(--rb-brand)]" />
                    Ask {firstName} anything about their career
                  </span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand)] text-white transition-transform duration-[var(--duration-base)] group-hover:translate-x-0.5">
                    <ArrowRight className="size-4" />
                  </span>
                </motion.button>

                <motion.div
                  variants={fadeUp}
                  className={`mt-4 flex max-w-xl flex-wrap gap-2 ${twoCol ? 'justify-center lg:justify-start' : 'justify-center'}`}
                >
                  {OPENERS.map((q) => (
                    <button
                      key={q}
                      onClick={() => openWith(q)}
                      className="rounded-full border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3.5 py-2 text-xs text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
                    >
                      {q}
                    </button>
                  ))}
                </motion.div>

                <motion.p
                  variants={fadeUp}
                  className="mt-6 flex items-center gap-1.5 text-xs text-[var(--rb-text-muted)]"
                >
                  <Sparkles className="size-3" />
                  Powered by RoleBoost AI · honest by design
                </motion.p>
              </>
            ) : (
              <motion.div
                variants={fadeUp}
                className="mt-8 w-full max-w-md rounded-[var(--radius-2xl)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-6 text-center lg:text-left"
              >
                <MessageCircle className="mb-2 size-6 text-[var(--rb-text-muted)]" />
                <p className="text-sm text-[var(--rb-text-secondary)]">
                  {firstName}&apos;s career AI is offline right now.
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
              </motion.div>
            )}
          </motion.div>

          {/* ── Right, assets (or the snapshot when there are no assets) ───── */}
          {twoCol && (
            <motion.div variants={fadeUp} className="w-full">
              {hasAssets ? (
                <div className="rb-card flex h-[58vh] max-h-[660px] flex-col overflow-hidden p-4 lg:h-[74vh]">
                  <AssetGallery firstName={firstName} assets={assets} fill />
                </div>
              ) : (
                <div className="rb-card max-h-[74vh] overflow-y-auto p-6">
                  <p className="rb-section-label mb-3">Career snapshot</p>
                  <ul className="flex flex-col gap-2">
                    {summaryBullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--rb-text-secondary)]">
                        <span className="mt-0.5 shrink-0 font-bold text-[var(--rb-brand)]">·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ── Career snapshot, below the fold only when assets hold the right column ── */}
      {snapshotBelow && (
        <section className="border-t border-[var(--rb-border)] bg-[var(--rb-bg-surface)] py-12">
          <div className="mx-auto max-w-3xl px-6">
            <p className="rb-section-label mb-3">Career snapshot</p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {summaryBullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--rb-text-secondary)]">
                  <span className="mt-0.5 shrink-0 font-bold text-[var(--rb-brand)]">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Conversation ─────────────────────────────────────────────────── */}
      {aiEnabled && (
        <ChatOverlay
          open={open}
          onClose={() => setOpen(false)}
          candidateSlug={slug}
          candidateName={fullName}
          suggestedQuestions={OPENERS}
          seed={seed}
        />
      )}
    </>
  );
}
