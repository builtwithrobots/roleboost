'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@clerk/nextjs/server';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { adminClient } from '@/lib/supabase/admin';
import type { CandidateProfile } from '@/lib/types';

const PROFILE_COLUMNS =
  'id, clerk_user_id, slug, full_name, headline, target_role, location, linkedin_url, summary_bullets, additional_context, is_published, created_at, updated_at';

const ProfileInput = z.object({
  full_name: z.string().min(1).max(200),
  headline: z.string().max(200).optional(),
  target_role: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  // Accept any string here and normalize below. A strict .url() check rejected
  // common bare URLs ("www.linkedin.com/in/me") and failed the whole save -- the
  // résumé pre-fill stores them bare, so that broke saving for many candidates.
  linkedin_url: z.string().max(500).optional(),
  summary_bullets: z.array(z.string().max(300)).max(7),
  additional_context: z.string().max(2000).optional(),
  is_published: z.boolean(),
});

/**
 * Coerces a user- or résumé-supplied LinkedIn URL into a stored value. Adds a
 * missing scheme, and drops anything that still isn't a plausible URL (returns
 * null) rather than failing the entire profile save.
 */
function normalizeLinkedinUrl(value: string | undefined): string | null {
  const s = value?.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function updateCandidateProfile(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const parsed = ProfileInput.parse(input);

    const { error } = await supabase
      .from('candidate_profiles')
      .update({
        full_name: parsed.full_name,
        headline: parsed.headline || null,
        target_role: parsed.target_role || null,
        location: parsed.location || null,
        linkedin_url: normalizeLinkedinUrl(parsed.linkedin_url),
        summary_bullets: parsed.summary_bullets.filter(Boolean),
        additional_context: parsed.additional_context || null,
        is_published: parsed.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId);

    if (error) {
      console.error('updateCandidateProfile: failed', userId, error);
      return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    }

    revalidatePath('/dashboard/profile');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

// Bootstraps the candidate's profile row on first dashboard visit and returns
// the created row. The caller must use the returned row directly, re-querying
// candidate_profiles in the same render would hit Next.js fetch memoization and
// return the pre-insert (empty) result, leaving the page thinking no profile
// exists. Returning the row here avoids that second read entirely.
export async function ensureCandidateProfile(): Promise<CandidateProfile> {
  const clerkUser = await currentUser();
  if (!clerkUser) throw new AuthError('UNAUTHENTICATED');

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
    clerkUser.emailAddresses[0]?.emailAddress.split('@')[0] ||
    'My Profile';

  const slugBase = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const suffix = Math.random().toString(36).slice(2, 8);
  const slug = `${slugBase}-${suffix}`;

  // adminClient: bootstrapping the initial profile row before RLS row exists
  const { data, error } = await (adminClient.from('candidate_profiles') as any)
    .insert({
      clerk_user_id: clerkUser.id,
      slug,
      full_name: fullName,
      summary_bullets: [],
      is_published: false,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    // A concurrent first-load request may have already inserted the row
    // (unique violation on clerk_user_id). Fetch and return the existing one.
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await (adminClient.from('candidate_profiles') as any)
        .select(PROFILE_COLUMNS)
        .eq('clerk_user_id', clerkUser.id)
        .single();
      if (existing) return existing as CandidateProfile;
    }
    console.error('ensureCandidateProfile: insert failed', clerkUser.id, error);
    throw new Error(error.message);
  }

  return data as CandidateProfile;
}
