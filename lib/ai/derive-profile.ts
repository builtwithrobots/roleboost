import type { CanonicalResume } from './canonical-resume';

// Derives sensible public-profile defaults from a freshly parsed résumé. These
// pre-fill empty profile fields on résumé upload so a new candidate isn't staring
// at a blank profile -- they always remain editable, and the parse hook only
// applies a derived value to a field the candidate has not already filled.

export interface DerivedProfileFields {
  headline: string | null;
  target_role: string | null;
  summary_bullets: string[];
  location: string | null;
  linkedin_url: string | null;
}

// Profile column caps (mirror the Zod schema in profile/actions.ts).
const HEADLINE_MAX = 200;
const TARGET_ROLE_MAX = 100;
const LOCATION_MAX = 100;
const BULLET_MAX = 300;
const MAX_BULLETS = 5;

function clean(value: string | null | undefined, max: number): string | null {
  const v = value?.trim();
  return v ? v.slice(0, max) : null;
}

/**
 * Public-profile bullets from the résumé: the strongest accomplishment highlights
 * from the most recent roles, falling back to the summary split into sentences.
 */
function deriveBullets(resume: CanonicalResume): string[] {
  const highlights = resume.experience
    .slice(0, 2)
    .flatMap((e) => e.highlights ?? [])
    .map((h) => h.trim())
    .filter(Boolean);

  if (highlights.length) {
    return dedupe(highlights).slice(0, MAX_BULLETS).map((h) => h.slice(0, BULLET_MAX));
  }

  const summary = resume.summary?.trim();
  if (!summary) return [];
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
    .slice(0, MAX_BULLETS)
    .map((s) => s.slice(0, BULLET_MAX));
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function deriveProfileFromResume(resume: CanonicalResume): DerivedProfileFields {
  return {
    headline: clean(resume.headline, HEADLINE_MAX),
    // Best résumé signal for an intended role is the most recent job title.
    target_role: clean(resume.experience[0]?.title, TARGET_ROLE_MAX),
    summary_bullets: deriveBullets(resume),
    location: clean(resume.contact.location, LOCATION_MAX),
    linkedin_url: clean(resume.contact.linkedin_url, 500),
  };
}
