'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { cardStagger, cardEnter } from '@/lib/motion-dashboard';
import {
  Headphones,
  MessageSquare,
  Video,
  Layout,
  Image as ImageIcon,
  FileText,
  MapPin,
  Search,
  Users,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

type Stage = 'saved' | 'screening' | 'interview' | 'offer' | 'passed';

interface Candidate {
  savedId: string;
  stage: string;
  savedAt: string;
  profile: {
    id: string;
    slug: string;
    fullName: string;
    headline: string | null;
    targetRole: string | null;
    location: string | null;
  } | null;
  assetTypes: string[];
}

interface Props {
  candidates: Candidate[];
}

const STAGE_CONFIG: Record<Stage, { label: string; bg: string; text: string }> = {
  saved:      { label: 'Saved',      bg: 'bg-[var(--color-stage-saved-bg)]',      text: 'text-[var(--color-stage-saved)]' },
  screening:  { label: 'Screening',  bg: 'bg-[var(--color-stage-screening-bg)]',  text: 'text-[var(--color-stage-screening)]' },
  interview:  { label: 'Interview',  bg: 'bg-[var(--color-stage-interview-bg)]',  text: 'text-[var(--color-stage-interview)]' },
  offer:      { label: 'Offer',      bg: 'bg-[var(--color-stage-offer-bg)]',      text: 'text-[var(--color-stage-offer)]' },
  passed:     { label: 'Passed',     bg: 'bg-[var(--color-stage-passed-bg)]',     text: 'text-[var(--color-stage-passed)]' },
};

const ASSET_ICONS: Record<string, { Icon: React.ElementType; title: string }> = {
  audio:        { Icon: Headphones,    title: 'Audio Overview' },
  debate_audio: { Icon: MessageSquare, title: 'Debate Audio' },
  video:        { Icon: Video,         title: 'Video' },
  deck:         { Icon: Layout,        title: 'Slide Deck' },
  infographic:  { Icon: ImageIcon,     title: 'Infographic' },
  resume:       { Icon: FileText,      title: 'Resume' },
};

const ALL_ASSET_TYPES = ['audio', 'debate_audio', 'video', 'deck', 'infographic', 'resume'];
const STAGES: Stage[] = ['saved', 'screening', 'interview', 'offer', 'passed'];

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join('');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const { profile, stage, savedAt, assetTypes } = candidate;
  if (!profile) return null;

  const stageCfg = STAGE_CONFIG[stage as Stage] ?? STAGE_CONFIG.saved;
  const initials = getInitials(profile.fullName);

  return (
    <div className="rb-card hover:-translate-y-0.5 transition-transform duration-[var(--duration-fast)] flex flex-col">
      <div className="p-4 flex-1">
        {/* Avatar + name row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="size-10 shrink-0 rounded-full bg-[var(--rb-brand)] flex items-center justify-center text-white text-sm font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-[var(--rb-text)] truncate">{profile.fullName}</div>
            <div className="text-xs text-[var(--rb-text-secondary)] truncate">
              {profile.targetRole ?? profile.headline ?? '—'}
            </div>
            {profile.location && (
              <div className="flex items-center gap-0.5 text-xs text-[var(--rb-text-muted)] mt-0.5">
                <MapPin className="size-3" />
                {profile.location}
              </div>
            )}
          </div>
        </div>

        {/* Asset icons */}
        <div className="flex items-center gap-1.5 mb-3">
          {ALL_ASSET_TYPES.map((type) => {
            const { Icon, title } = ASSET_ICONS[type];
            const has = assetTypes.includes(type);
            return (
              <span
                key={type}
                title={has ? title : `No ${title}`}
                className={`${has ? 'text-[var(--rb-brand)]' : 'text-[var(--rb-border-strong)]'}`}
              >
                <Icon className="size-3.5" strokeWidth={has ? 2 : 1.5} />
              </span>
            );
          })}
        </div>

        {/* Stage badge */}
        <div className="flex items-center justify-between">
          <span
            className={`stage-badge ${stageCfg.bg} ${stageCfg.text}`}
          >
            {stageCfg.label}
          </span>
          <span className="text-xs text-[var(--rb-text-muted)]">{formatDate(savedAt)}</span>
        </div>
      </div>

      {/* View profile link */}
      <div className="border-t border-[var(--rb-border)] px-4 py-2.5">
        <Link
          href={`/c/${profile.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--rb-brand)] hover:underline"
        >
          <ExternalLink className="size-3" />
          View profile
        </Link>
      </div>
    </div>
  );
}

export default function CandidateGrid({ candidates }: Props) {
  const prefersReduced = useReducedMotion();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (!c.profile) return false;
      const matchesSearch =
        !search ||
        c.profile.fullName.toLowerCase().includes(search.toLowerCase()) ||
        (c.profile.targetRole ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.profile.headline ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesStage = stageFilter === 'all' || c.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [candidates, search, stageFilter]);

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-bold text-[var(--rb-text)]">Candidates</h1>
          <p className="mt-1 text-sm text-[var(--rb-text-muted)]">
            Your saved candidate pool.{' '}
            <span className="font-data text-[var(--rb-text-secondary)]">{candidates.length}</span> total.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface)]/90 backdrop-blur px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--rb-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or role…"
              className="w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] pl-8 pr-3 py-1.5 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:outline-none focus:border-[var(--rb-border-focus)]"
            />
          </div>

          {/* Stage filter */}
          <div className="relative">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as Stage | 'all')}
              className="appearance-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] pr-8 pl-3 py-1.5 text-sm text-[var(--rb-text)] focus:outline-none focus:border-[var(--rb-border-focus)] cursor-pointer"
            >
              <option value="all">All stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--rb-text-muted)]" />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-16 rounded-full bg-[var(--rb-brand-subtle)] flex items-center justify-center mb-4">
              <Users className="size-8 text-[var(--rb-brand)]" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--rb-text)] mb-2">No candidates yet</h2>
            <p className="text-sm text-[var(--rb-text-muted)] max-w-sm mb-6">
              Ask candidates to share their RoleBoost profile link with you. When you open their profile, you&apos;ll be able to save them here.
            </p>
            <div className="rounded-[var(--radius-xl)] border border-[var(--rb-border-brand)]/30 bg-[var(--rb-brand-subtle)] px-5 py-4 max-w-sm text-left">
              <p className="text-sm text-[var(--rb-text-secondary)]">
                <span className="font-semibold text-[var(--rb-text-brand)]">How it works:</span>{' '}
                Candidates share a link like{' '}
                <code className="text-xs bg-white/60 rounded px-1 py-0.5">roleboost.app/c/jane-smith</code>.
                You open it, listen to their career story, and save them to your pool.
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[var(--rb-text-muted)]">No candidates match your filters.</p>
            <button
              onClick={() => { setSearch(''); setStageFilter('all'); }}
              className="mt-2 text-xs text-[var(--rb-brand)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            variants={cardStagger}
            initial={prefersReduced ? false : 'hidden'}
            animate="visible"
          >
            {filtered.map((c) => (
              <motion.div key={c.savedId} variants={cardEnter}>
                <CandidateCard candidate={c} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
