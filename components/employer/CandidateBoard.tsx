'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink, ChevronDown, Columns3 } from 'lucide-react';
import { updateCandidateStage } from '@/app/(employer)/dashboard/board/actions';

type Stage = 'saved' | 'screening' | 'interview' | 'offer' | 'passed';

interface Candidate {
  savedId: string;
  stage: string;
  notes: string | null;
  savedAt: string;
  profile: {
    id: string;
    slug: string;
    fullName: string;
    targetRole: string | null;
    headline: string | null;
  } | null;
}

interface Props {
  candidates: Candidate[];
}

const STAGES: { key: Stage; label: string; accent: string; header: string }[] = [
  { key: 'saved',     label: 'Saved',     accent: 'bg-[--color-stage-saved-bg]',     header: 'border-t-2 border-t-[--color-stage-saved]' },
  { key: 'screening', label: 'Screening', accent: 'bg-[--color-stage-screening-bg]', header: 'border-t-2 border-t-[--color-stage-screening]' },
  { key: 'interview', label: 'Interview', accent: 'bg-[--color-stage-interview-bg]', header: 'border-t-2 border-t-[--color-stage-interview]' },
  { key: 'offer',     label: 'Offer',     accent: 'bg-[--color-stage-offer-bg]',     header: 'border-t-2 border-t-[--color-stage-offer]' },
  { key: 'passed',    label: 'Passed',    accent: 'bg-[--color-stage-passed-bg]',    header: 'border-t-2 border-t-[--color-stage-passed]' },
];

const STAGE_LABELS: Record<Stage, string> = {
  saved: 'Saved', screening: 'Screening', interview: 'Interview', offer: 'Offer', passed: 'Passed',
};

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join('');
}

function BoardCard({ candidate, onStageChange }: { candidate: Candidate; onStageChange: (savedId: string, stage: Stage) => void }) {
  const { profile, savedId, stage } = candidate;
  if (!profile) return null;

  return (
    <div className="rb-card p-3 text-sm">
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="size-8 shrink-0 rounded-full bg-[--rb-brand] flex items-center justify-center text-white text-xs font-bold">
          {getInitials(profile.fullName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[--rb-text] truncate text-xs">{profile.fullName}</div>
          <div className="text-[--rb-text-muted] truncate text-xs">
            {profile.targetRole ?? profile.headline ?? '—'}
          </div>
        </div>
        <Link
          href={`/c/${profile.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[--rb-text-muted] hover:text-[--rb-brand] transition-colors"
          aria-label="View profile"
        >
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {/* Stage dropdown */}
      <div className="relative">
        <select
          value={stage}
          onChange={(e) => onStageChange(savedId, e.target.value as Stage)}
          className="w-full appearance-none rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-surface-raised] pr-6 pl-2 py-1 text-xs text-[--rb-text] focus:outline-none focus:border-[--rb-border-focus] cursor-pointer"
        >
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-[--rb-text-muted]" />
      </div>
    </div>
  );
}

export default function CandidateBoard({ candidates: initialCandidates }: Props) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [isPending, startTransition] = useTransition();

  const handleStageChange = (savedId: string, newStage: Stage) => {
    // Optimistic update
    setCandidates((prev) =>
      prev.map((c) => (c.savedId === savedId ? { ...c, stage: newStage } : c))
    );

    startTransition(async () => {
      const result = await updateCandidateStage(savedId, newStage);
      if (!result.ok) {
        // Revert on failure — refetch would require router.refresh()
        // For now just log; the revalidatePath in the action will sync on next nav
        console.error('Stage update failed:', result.error);
      }
    });
  };

  const totalCandidates = candidates.filter((c) => c.profile).length;

  if (totalCandidates === 0) {
    return (
      <div className="min-h-full bg-[--rb-bg-page]">
        <div className="border-b border-[--rb-border] bg-[--rb-bg-surface] px-6 py-4">
          <h1 className="text-xl font-bold text-[--rb-text]">Board</h1>
          <p className="mt-1 text-sm text-[--rb-text-muted]">Stage-based candidate pipeline.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="size-16 rounded-full bg-[--rb-brand-subtle] flex items-center justify-center mb-4">
            <Columns3 className="size-8 text-[--rb-brand]" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold text-[--rb-text] mb-2">No candidates on your board</h2>
          <p className="text-sm text-[--rb-text-muted] max-w-sm">
            Save candidates from the Candidates page to move them through your pipeline here.
          </p>
          <Link
            href="/dashboard/candidates"
            className="mt-4 text-sm font-medium text-[--rb-brand] hover:underline"
          >
            Go to Candidates →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[--rb-bg-page] flex flex-col">
      {/* Header */}
      <div className="border-b border-[--rb-border] bg-[--rb-bg-surface] px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold text-[--rb-text]">Board</h1>
        <p className="mt-1 text-sm text-[--rb-text-muted]">
          Move candidates through your pipeline.{' '}
          <span className={isPending ? 'text-[--rb-text-muted] italic' : 'hidden'}>Saving…</span>
        </p>
      </div>

      {/* Board columns — horizontal scroll */}
      <div className="flex-1 overflow-x-auto px-6 py-6">
        <div className="flex gap-4 min-w-max h-full">
          {STAGES.map(({ key, label, header, accent }) => {
            const stageCandidates = candidates.filter(
              (c) => c.stage === key && c.profile
            );
            return (
              <div
                key={key}
                className={`w-56 flex flex-col rounded-[--radius-xl] border border-[--rb-border] bg-[--rb-bg-surface] ${header} overflow-hidden`}
              >
                {/* Column header */}
                <div className={`px-3 py-2.5 ${accent} flex items-center justify-between`}>
                  <span className="text-xs font-semibold text-[--rb-text]">{label}</span>
                  <span className="text-xs font-data font-medium text-[--rb-text-secondary]">
                    {stageCandidates.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto">
                  {stageCandidates.map((c) => (
                    <BoardCard
                      key={c.savedId}
                      candidate={c}
                      onStageChange={handleStageChange}
                    />
                  ))}
                  {stageCandidates.length === 0 && (
                    <div className="flex-1 flex items-center justify-center py-8">
                      <span className="text-xs text-[--rb-text-muted]">Empty</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
