'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import { updateCandidateProfile } from '@/app/(candidate)/dashboard/profile/actions';
import RoleSuggestions from '@/components/candidate/RoleSuggestions';
import type { CandidateProfile } from '@/lib/types';
import {
  User,
  MapPin,
  Briefcase,
  Link2,
  FileText,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  CheckCircle2,
  MessageSquare,
  Globe,
  ExternalLink,
  Check,
  Loader2,
} from 'lucide-react';

interface Props {
  profile: CandidateProfile;
}

type Section = 'basic' | 'headline' | 'snapshot' | 'context';
type Status = 'idle' | 'saving' | 'saved' | 'error';

const ALL_CLEAN: Record<Section, boolean> = {
  basic: false,
  headline: false,
  snapshot: false,
  context: false,
};

export default function ProfileEditor({ profile }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [headline, setHeadline] = useState(profile.headline ?? '');
  const [targetRole, setTargetRole] = useState(profile.target_role ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url ?? '');
  const [additionalContext, setAdditionalContext] = useState(profile.additional_context ?? '');
  const [bullets, setBullets] = useState<string[]>(
    profile.summary_bullets?.length ? profile.summary_bullets : ['']
  );
  const [isPublished, setIsPublished] = useState(profile.is_published);

  const [status, setStatus] = useState<Record<Section, Status>>({
    basic: 'idle',
    headline: 'idle',
    snapshot: 'idle',
    context: 'idle',
  });
  const [dirty, setDirty] = useState<Record<Section, boolean>>(ALL_CLEAN);
  const [publishStatus, setPublishStatus] = useState<Status>('idle');
  const [isPending, startTransition] = useTransition();

  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const markDirty = useCallback((section: Section) => {
    setDirty((prev) => (prev[section] ? prev : { ...prev, [section]: true }));
    setStatus((prev) => (prev[section] === 'idle' ? prev : { ...prev, [section]: 'idle' }));
  }, []);

  const currentData = useCallback(
    () => ({
      full_name: fullName,
      headline,
      target_role: targetRole,
      location,
      linkedin_url: linkedinUrl,
      summary_bullets: bullets.filter((b) => b.trim()),
      additional_context: additionalContext,
      is_published: isPublished,
    }),
    [fullName, headline, targetRole, location, linkedinUrl, bullets, additionalContext, isPublished]
  );

  // Each section's Save persists the whole profile (one row), so a successful
  // save clears every section's dirty flag; the confirmation shows on the
  // section the candidate clicked.
  const saveSection = useCallback(
    (section: Section) => {
      setStatus((prev) => ({ ...prev, [section]: 'saving' }));
      startTransition(async () => {
        const result = await updateCandidateProfile(currentData());
        if (result.ok) {
          setDirty(ALL_CLEAN);
          setStatus((prev) => ({ ...prev, [section]: 'saved' }));
          const t = setTimeout(
            () => setStatus((prev) => ({ ...prev, [section]: 'idle' })),
            2500
          );
          timeouts.current.push(t);
        } else {
          setStatus((prev) => ({ ...prev, [section]: 'error' }));
        }
      });
    },
    [currentData]
  );

  const handlePublishToggle = () => {
    const next = !isPublished;
    setIsPublished(next);
    setPublishStatus('saving');
    startTransition(async () => {
      const result = await updateCandidateProfile({ ...currentData(), is_published: next });
      if (result.ok) {
        setDirty(ALL_CLEAN);
        setPublishStatus('saved');
        const t = setTimeout(() => setPublishStatus('idle'), 2500);
        timeouts.current.push(t);
      } else {
        setIsPublished(!next); // revert the optimistic toggle
        setPublishStatus('error');
      }
    });
  };

  const addBullet = () => {
    if (bullets.length < 7) setBullets((prev) => [...prev, '']);
  };
  const removeBullet = (i: number) => {
    setBullets((prev) => prev.filter((_, idx) => idx !== i));
    markDirty('snapshot');
  };
  const updateBullet = (i: number, value: string) => {
    setBullets((prev) => prev.map((b, idx) => (idx === i ? value : b)));
    markDirty('snapshot');
  };

  const profileUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/c/${profile.slug}`;
  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-input)] px-3 py-2 text-sm text-[var(--rb-text)] placeholder:text-[var(--rb-text-muted)] focus:outline-none focus:border-[var(--rb-border-focus)] focus:shadow-[var(--shadow-focus)] transition-shadow duration-[var(--duration-fast)]';

  return (
    <div className="min-h-full">
      {/* Top bar */}
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight text-[var(--rb-text)]">Profile</h1>
            <p className="mt-1 text-sm text-[var(--rb-text-secondary)]">
              Your public career page · roleboost.com/c/{profile.slug}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Publish save status */}
            <span aria-live="polite" className="text-xs">
              {publishStatus === 'saving' && <span className="text-[var(--rb-text-muted)]">Saving…</span>}
              {publishStatus === 'saved' && <span className="text-[var(--color-success)]">✓ Saved</span>}
              {publishStatus === 'error' && <span className="text-[var(--color-error)]">Save failed</span>}
            </span>

            {/* Publish toggle */}
            <button
              onClick={handlePublishToggle}
              disabled={isPending}
              className={`flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold transition-all duration-[var(--duration-base)] disabled:opacity-50 ${
                isPublished
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] hover:bg-emerald-200'
                  : 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-secondary)] hover:bg-[var(--rb-border)]'
              }`}
            >
              {isPublished ? (
                <>
                  <Eye className="size-3" />
                  Published
                </>
              ) : (
                <>
                  <EyeOff className="size-3" />
                  Draft
                </>
              )}
            </button>

            {/* View live */}
            {isPublished && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--rb-text-brand)] hover:underline"
              >
                View live
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: form (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Basic Info */}
          <section className="rb-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)] mb-5">
              <User className="size-4 text-[var(--rb-brand)]" />
              Basic Info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--rb-text-secondary)] mb-1.5">
                  Full name <span className="text-[var(--color-error)]">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    markDirty('basic');
                  }}
                  placeholder="Jane Smith"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--rb-text-secondary)] mb-1.5">
                  <Briefcase className="inline size-3 mr-1" />
                  Target role
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => {
                    setTargetRole(e.target.value);
                    markDirty('basic');
                  }}
                  placeholder="Director of Operations"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--rb-text-secondary)] mb-1.5">
                  <MapPin className="inline size-3 mr-1" />
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    markDirty('basic');
                  }}
                  placeholder="New York, NY (Remote)"
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--rb-text-secondary)] mb-1.5">
                  <Link2 className="inline size-3 mr-1" />
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => {
                    setLinkedinUrl(e.target.value);
                    markDirty('basic');
                  }}
                  placeholder="https://linkedin.com/in/janesmithsmith"
                  className={inputClass}
                />
              </div>
            </div>
            <SaveBar state={status.basic} dirty={dirty.basic} onSave={() => saveSection('basic')} />
          </section>

          {/* AI role suggestions — fills the Target role field above */}
          <RoleSuggestions
            onUseRole={(title) => {
              setTargetRole(title);
              markDirty('basic');
            }}
          />

          {/* Headline */}
          <section className="rb-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)] mb-1">
              <FileText className="size-4 text-[var(--rb-brand)]" />
              Headline
            </h2>
            <p className="text-xs text-[var(--rb-text-muted)] mb-4">
              One punchy sentence a recruiter reads in 5 seconds. What makes you different?
            </p>
            <div>
              <textarea
                value={headline}
                onChange={(e) => {
                  setHeadline(e.target.value);
                  markDirty('headline');
                }}
                placeholder="Ops leader who scaled two companies from Series A to $200M ARR, built the teams that run them, and still answers Slack on weekends."
                rows={3}
                maxLength={200}
                className={`${inputClass} resize-none`}
              />
              <div className="flex justify-end mt-1">
                <span
                  className={`text-xs font-data ${
                    headline.length >= 180 ? 'text-[var(--color-warning)]' : 'text-[var(--rb-text-muted)]'
                  }`}
                >
                  {headline.length} / 200
                </span>
              </div>
            </div>
            <SaveBar state={status.headline} dirty={dirty.headline} onSave={() => saveSection('headline')} />
          </section>

          {/* Career Snapshot */}
          <section className="rb-card p-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)]">
                <CheckCircle2 className="size-4 text-[var(--rb-brand)]" />
                Career Snapshot
              </h2>
              <span className="text-xs text-[var(--rb-text-muted)] font-data">
                {bullets.filter((b) => b.trim()).length} / 7
              </span>
            </div>
            <p className="text-xs text-[var(--rb-text-muted)] mb-4">
              Your top 3–7 career highlights. What would you put on a one-page summary?
            </p>

            <div className="flex flex-col gap-2">
              {bullets.map((bullet, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="text-[var(--rb-brand)] text-sm font-bold shrink-0">·</span>
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => updateBullet(i, e.target.value)}
                    placeholder={`Career highlight ${i + 1}…`}
                    className={`flex-1 ${inputClass}`}
                  />
                  {bullets.length > 1 && (
                    <button
                      onClick={() => removeBullet(i)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--rb-text-muted)] hover:text-[var(--color-error)] transition-all duration-[var(--duration-fast)]"
                      aria-label="Remove bullet"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {bullets.length < 7 && (
              <button
                onClick={addBullet}
                className="mt-3 flex items-center gap-1.5 text-xs text-[var(--rb-text-muted)] hover:text-[var(--rb-brand)] transition-colors duration-[var(--duration-fast)]"
              >
                <Plus className="size-3.5" />
                Add highlight
              </button>
            )}
            <SaveBar state={status.snapshot} dirty={dirty.snapshot} onSave={() => saveSection('snapshot')} />
          </section>

          {/* Additional Context */}
          <section className="rb-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)] mb-1">
              <MessageSquare className="size-4 text-[var(--rb-brand)]" />
              Additional Context
              <span className="ml-1 text-xs font-normal text-[var(--rb-text-muted)]">(optional)</span>
            </h2>
            <p className="text-xs text-[var(--rb-text-muted)] mb-4">
              Your freeform pitch — anything that makes you unique that the rest of your profile doesn&apos;t capture.
            </p>
            <div>
              <textarea
                value={additionalContext}
                onChange={(e) => {
                  setAdditionalContext(e.target.value);
                  markDirty('context');
                }}
                placeholder="Share anything else recruiters should know — your story, what you're looking for, what you care about…"
                rows={4}
                maxLength={2000}
                className={`${inputClass} resize-none`}
              />
              <div className="flex justify-end mt-1">
                <span
                  className={`text-xs font-data ${
                    additionalContext.length >= 1800 ? 'text-[var(--color-warning)]' : 'text-[var(--rb-text-muted)]'
                  }`}
                >
                  {additionalContext.length} / 2000
                </span>
              </div>
            </div>
            <SaveBar state={status.context} dirty={dirty.context} onSave={() => saveSection('context')} />
          </section>

          {/* Profile Link */}
          <section className="rb-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--rb-text)] mb-4">
              <Globe className="size-4 text-[var(--rb-brand)]" />
              Your Profile Link
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface-raised)] px-3 py-2 text-sm text-[var(--rb-text-secondary)] font-data truncate">
                getroleboost.com/c/{profile.slug}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(`https://getroleboost.com/c/${profile.slug}`)}
                className="shrink-0 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--rb-brand-hover)] transition-colors duration-[var(--duration-fast)]"
              >
                Copy
              </button>
            </div>
            {!isPublished && (
              <p className="mt-2 text-xs text-[var(--rb-text-muted)]">
                Publish your profile so employers can view it at this link.
              </p>
            )}
          </section>
        </div>

        {/* Right: live preview card (1/3) */}
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <p className="text-xs font-medium text-[var(--rb-text-muted)] uppercase tracking-wide mb-3">
              Preview
            </p>
            <ProfilePreviewCard
              fullName={fullName}
              headline={headline}
              targetRole={targetRole}
              location={location}
              isPublished={isPublished}
              bullets={bullets.filter(Boolean)}
            />
            <p className="mt-3 text-xs text-[var(--rb-text-muted)] text-center">
              This is how your modal header appears to employers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Per-section save control with inline confirmation. */
function SaveBar({ state, dirty, onSave }: { state: Status; dirty: boolean; onSave: () => void }) {
  const disabled = state === 'saving' || (!dirty && state !== 'error');
  return (
    <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--rb-border)] pt-3">
      <span aria-live="polite" className="text-xs">
        {state === 'saved' && (
          <span className="flex items-center gap-1 text-[var(--color-success)]">
            <Check className="size-3.5" /> Saved
          </span>
        )}
        {state === 'error' && (
          <span className="text-[var(--color-error)]">Couldn&apos;t save — check the fields and retry</span>
        )}
        {state === 'idle' && dirty && <span className="text-[var(--rb-text-muted)]">Unsaved changes</span>}
      </span>
      <button
        onClick={onSave}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === 'saving' ? (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </>
        ) : (
          'Save'
        )}
      </button>
    </div>
  );
}

function ProfilePreviewCard({
  fullName,
  headline,
  targetRole,
  location,
  isPublished,
  bullets,
}: {
  fullName: string;
  headline: string;
  targetRole: string;
  location: string;
  isPublished: boolean;
  bullets: string[];
}) {
  const initials = fullName
    .split(' ')
    .map((n) => n[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  return (
    <div className="rb-card overflow-hidden">
      {/* Draft banner */}
      {!isPublished && (
        <div className="bg-[var(--color-warning-bg)] border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <EyeOff className="size-3 text-[var(--color-warning)]" />
          <span className="text-xs font-medium text-[var(--color-warning)]">Draft — not visible to employers</span>
        </div>
      )}

      {/* Profile header */}
      <div className="p-5">
        {/* Avatar + name */}
        <div className="flex items-start gap-3 mb-3">
          <div className="size-12 rounded-full bg-[var(--rb-brand)] flex items-center justify-center text-white font-bold text-lg shrink-0">
            {initials || '?'}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[var(--rb-text)] truncate">
              {fullName || <span className="text-[var(--rb-text-muted)]">Your Name</span>}
            </div>
            <div className="text-sm text-[var(--rb-text-secondary)] truncate">
              {targetRole || <span className="text-[var(--rb-text-muted)] italic">Target role</span>}
            </div>
            {location && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-[var(--rb-text-muted)]">
                <MapPin className="size-3" />
                {location}
              </div>
            )}
          </div>
        </div>

        {/* Headline */}
        {headline ? (
          <p className="text-sm text-[var(--rb-text-secondary)] leading-relaxed mb-3 line-clamp-3">
            {headline}
          </p>
        ) : (
          <p className="text-sm text-[var(--rb-text-muted)] italic mb-3">Headline will appear here…</p>
        )}

        {/* Asset tab placeholders */}
        <div className="flex gap-1.5 mb-3">
          {['Audio', 'Video', 'Deck', 'Resume'].map((tab) => (
            <span
              key={tab}
              className="px-2 py-0.5 rounded text-xs bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-muted)] border border-[var(--rb-border)]"
            >
              {tab}
            </span>
          ))}
        </div>

        {/* Snapshot bullets */}
        {bullets.length > 0 && (
          <ul className="space-y-1">
            {bullets.slice(0, 3).map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--rb-text-secondary)]">
                <span className="text-[var(--rb-brand)] font-bold mt-0.5 shrink-0">·</span>
                <span className="line-clamp-1">{b}</span>
              </li>
            ))}
            {bullets.length > 3 && (
              <li className="text-xs text-[var(--rb-text-muted)] pl-3">+{bullets.length - 3} more…</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
