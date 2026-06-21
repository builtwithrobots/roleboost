'use client';

import { useState, useTransition, useRef, useCallback } from 'react';
import { updateCandidateProfile } from '@/app/(candidate)/dashboard/profile/actions';
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
  Globe,
  ExternalLink,
} from 'lucide-react';

interface Props {
  profile: CandidateProfile;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function ProfileEditor({ profile }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [headline, setHeadline] = useState(profile.headline ?? '');
  const [targetRole, setTargetRole] = useState(profile.target_role ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedin_url ?? '');
  const [bullets, setBullets] = useState<string[]>(
    profile.summary_bullets?.length ? profile.summary_bullets : ['']
  );
  const [isPublished, setIsPublished] = useState(profile.is_published);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isPending, startTransition] = useTransition();

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentData = useCallback(
    () => ({
      full_name: fullName,
      headline,
      target_role: targetRole,
      location,
      linkedin_url: linkedinUrl,
      summary_bullets: bullets.filter((b) => b.trim()),
      is_published: isPublished,
    }),
    [fullName, headline, targetRole, location, linkedinUrl, bullets, isPublished]
  );

  const save = useCallback(
    (overrides?: Partial<ReturnType<typeof currentData>>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus('saving');
      startTransition(async () => {
        const result = await updateCandidateProfile({ ...currentData(), ...overrides });
        setSaveStatus(result.ok ? 'saved' : 'error');
        if (result.ok) {
          saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
        }
      });
    },
    [currentData]
  );

  const handlePublishToggle = () => {
    const next = !isPublished;
    setIsPublished(next);
    save({ is_published: next });
  };

  const addBullet = () => {
    if (bullets.length < 7) setBullets((prev) => [...prev, '']);
  };

  const removeBullet = (i: number) => {
    setBullets((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateBullet = (i: number, value: string) => {
    setBullets((prev) => prev.map((b, idx) => (idx === i ? value : b)));
  };

  const profileUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/c/${profile.slug}`;

  return (
    <div className="min-h-full bg-[--rb-bg-page]">
      {/* Top bar */}
      <div className="sticky top-0 z-[--z-sticky] bg-[--rb-bg-surface] border-b border-[--rb-border] px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-[--rb-text]">Profile</h1>
          <p className="text-xs text-[--rb-text-muted]">
            Your public career page · roleboost.com/c/{profile.slug}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status */}
          <span
            className={`text-xs transition-opacity duration-200 ${
              saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'
            } ${
              saveStatus === 'saving'
                ? 'text-[--rb-text-muted]'
                : saveStatus === 'saved'
                ? 'text-[--color-success]'
                : 'text-[--color-error]'
            }`}
          >
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && 'Save failed'}
          </span>

          {/* Publish toggle */}
          <button
            onClick={handlePublishToggle}
            disabled={isPending}
            className={`flex items-center gap-1.5 rounded-[--radius-md] px-3 py-1.5 text-xs font-semibold transition-all duration-[--duration-base] disabled:opacity-50 ${
              isPublished
                ? 'bg-[--color-success-bg] text-[--color-success] hover:bg-emerald-200'
                : 'bg-[--rb-bg-surface-raised] text-[--rb-text-secondary] hover:bg-[--rb-border]'
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
              className="flex items-center gap-1 text-xs text-[--rb-text-brand] hover:underline"
            >
              View live
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mx-auto max-w-6xl px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: form (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Basic Info */}
          <section className="rb-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[--rb-text] mb-5">
              <User className="size-4 text-[--rb-brand]" />
              Basic Info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[--rb-text-secondary] mb-1.5">
                  Full name <span className="text-[--color-error]">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => save()}
                  placeholder="Jane Smith"
                  className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus] focus:shadow-[--shadow-focus] transition-shadow duration-[--duration-fast]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[--rb-text-secondary] mb-1.5">
                  <Briefcase className="inline size-3 mr-1" />
                  Target role
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  onBlur={() => save()}
                  placeholder="Director of Operations"
                  className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus] focus:shadow-[--shadow-focus] transition-shadow duration-[--duration-fast]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[--rb-text-secondary] mb-1.5">
                  <MapPin className="inline size-3 mr-1" />
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onBlur={() => save()}
                  placeholder="New York, NY (Remote)"
                  className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus] focus:shadow-[--shadow-focus] transition-shadow duration-[--duration-fast]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[--rb-text-secondary] mb-1.5">
                  <Link2 className="inline size-3 mr-1" />
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  onBlur={() => save()}
                  placeholder="https://linkedin.com/in/janesmithsmith"
                  className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus] focus:shadow-[--shadow-focus] transition-shadow duration-[--duration-fast]"
                />
              </div>
            </div>
          </section>

          {/* Headline */}
          <section className="rb-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[--rb-text] mb-1">
              <FileText className="size-4 text-[--rb-brand]" />
              Headline
            </h2>
            <p className="text-xs text-[--rb-text-muted] mb-4">
              One punchy sentence a recruiter reads in 5 seconds. What makes you different?
            </p>
            <div>
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                onBlur={() => save()}
                placeholder="Ops leader who scaled two companies from Series A to $200M ARR, built the teams that run them, and still answers Slack on weekends."
                rows={3}
                maxLength={200}
                className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus] focus:shadow-[--shadow-focus] transition-shadow duration-[--duration-fast] resize-none"
              />
              <div className="flex justify-end mt-1">
                <span
                  className={`text-xs font-data ${
                    headline.length >= 180
                      ? 'text-[--color-warning]'
                      : 'text-[--rb-text-muted]'
                  }`}
                >
                  {headline.length} / 200
                </span>
              </div>
            </div>
          </section>

          {/* Career Snapshot */}
          <section className="rb-card p-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[--rb-text]">
                <CheckCircle2 className="size-4 text-[--rb-brand]" />
                Career Snapshot
              </h2>
              <span className="text-xs text-[--rb-text-muted] font-data">
                {bullets.filter((b) => b.trim()).length} / 7
              </span>
            </div>
            <p className="text-xs text-[--rb-text-muted] mb-4">
              Your top 3–7 career highlights. What would you put on a one-page summary?
            </p>

            <div className="flex flex-col gap-2">
              {bullets.map((bullet, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="text-[--rb-brand] text-sm font-bold shrink-0">·</span>
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => updateBullet(i, e.target.value)}
                    onBlur={() => save()}
                    placeholder={`Career highlight ${i + 1}…`}
                    className="flex-1 rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus] focus:shadow-[--shadow-focus] transition-shadow duration-[--duration-fast]"
                  />
                  {bullets.length > 1 && (
                    <button
                      onClick={() => {
                        removeBullet(i);
                        setTimeout(() => save(), 50);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-[--rb-text-muted] hover:text-[--color-error] transition-all duration-[--duration-fast]"
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
                className="mt-3 flex items-center gap-1.5 text-xs text-[--rb-text-muted] hover:text-[--rb-brand] transition-colors duration-[--duration-fast]"
              >
                <Plus className="size-3.5" />
                Add highlight
              </button>
            )}
          </section>

          {/* Profile Link */}
          <section className="rb-card p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[--rb-text] mb-4">
              <Globe className="size-4 text-[--rb-brand]" />
              Your Profile Link
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-surface-raised] px-3 py-2 text-sm text-[--rb-text-secondary] font-data truncate">
                getroleboost.com/c/{profile.slug}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(`https://getroleboost.com/c/${profile.slug}`)}
                className="shrink-0 rounded-[--radius-md] bg-[--rb-brand] px-3 py-2 text-xs font-semibold text-white hover:bg-[--rb-brand-hover] transition-colors duration-[--duration-fast]"
              >
                Copy
              </button>
            </div>
            {!isPublished && (
              <p className="mt-2 text-xs text-[--rb-text-muted]">
                Publish your profile so employers can view it at this link.
              </p>
            )}
          </section>
        </div>

        {/* Right: live preview card (1/3) */}
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <p className="text-xs font-medium text-[--rb-text-muted] uppercase tracking-wide mb-3">
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
            <p className="mt-3 text-xs text-[--rb-text-muted] text-center">
              This is how your modal header appears to employers.
            </p>
          </div>
        </div>
      </div>
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
        <div className="bg-[--color-warning-bg] border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <EyeOff className="size-3 text-[--color-warning]" />
          <span className="text-xs font-medium text-[--color-warning]">Draft — not visible to employers</span>
        </div>
      )}

      {/* Profile header */}
      <div className="p-5">
        {/* Avatar + name */}
        <div className="flex items-start gap-3 mb-3">
          <div className="size-12 rounded-full bg-[--rb-brand] flex items-center justify-center text-white font-bold text-lg shrink-0">
            {initials || '?'}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[--rb-text] truncate">
              {fullName || <span className="text-[--rb-text-muted]">Your Name</span>}
            </div>
            <div className="text-sm text-[--rb-text-secondary] truncate">
              {targetRole || <span className="text-[--rb-text-muted] italic">Target role</span>}
            </div>
            {location && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-[--rb-text-muted]">
                <MapPin className="size-3" />
                {location}
              </div>
            )}
          </div>
        </div>

        {/* Headline */}
        {headline ? (
          <p className="text-sm text-[--rb-text-secondary] leading-relaxed mb-3 line-clamp-3">
            {headline}
          </p>
        ) : (
          <p className="text-sm text-[--rb-text-muted] italic mb-3">Headline will appear here…</p>
        )}

        {/* Asset tab placeholders */}
        <div className="flex gap-1.5 mb-3">
          {['Audio', 'Video', 'Deck', 'Resume'].map((tab) => (
            <span
              key={tab}
              className="px-2 py-0.5 rounded text-xs bg-[--rb-bg-surface-raised] text-[--rb-text-muted] border border-[--rb-border]"
            >
              {tab}
            </span>
          ))}
        </div>

        {/* Snapshot bullets */}
        {bullets.length > 0 && (
          <ul className="space-y-1">
            {bullets.slice(0, 3).map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[--rb-text-secondary]">
                <span className="text-[--rb-brand] font-bold mt-0.5 shrink-0">·</span>
                <span className="line-clamp-1">{b}</span>
              </li>
            ))}
            {bullets.length > 3 && (
              <li className="text-xs text-[--rb-text-muted] pl-3">
                +{bullets.length - 3} more…
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
