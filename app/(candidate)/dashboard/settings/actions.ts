'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { getAdminClient } from '@/lib/supabase/admin';
import { deleteAllCandidateFiles } from '@/lib/storage/delete-candidate-files';

// ── Visibility & AI toggles ─────────────────────────────────────────────────
// Two account-level switches that write the canonical candidate_profiles
// columns (the same ones surfaced in Profile / AI Studio), so there is one
// source of truth no matter which page flips them.

const VisibilityInput = z.object({
  is_published: z.boolean().optional(),
  ai_enabled: z.boolean().optional(),
});

export async function updateVisibilitySettings(input: unknown) {
  try {
    const { supabase, userId } = await getUserContext('candidate');
    const parsed = VisibilityInput.parse(input);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.is_published !== undefined) patch.is_published = parsed.is_published;
    if (parsed.ai_enabled !== undefined) patch.ai_enabled = parsed.ai_enabled;

    const { error } = await supabase
      .from('candidate_profiles')
      .update(patch)
      .eq('clerk_user_id', userId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/ai');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

// ── Fresh start, mode A: reset AI training ──────────────────────────────────
// Wipes everything the AI learned and everything the candidate taught it (brain
// fields, custom Q&A, redirect topics, intake answers, sandbox self-tests,
// transcript gaps, hardening runs, and recruiter chat history) and resets
// readiness, then leaves the candidate to rebuild through the getting-started
// flow. Keeps the account, the public link and slug, profile identity, the
// résumé, career sources, and every uploaded/generated media asset.
//
// The admin (RLS bypass) client is used so each child-table delete is
// guaranteed to complete in one server operation; every query is strictly
// scoped to the authenticated candidate's own profile id / clerk_user_id.

export async function resetAiLearning() {
  try {
    const { supabase, userId } = await getUserContext('candidate');

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();
    if (!profile) return { ok: false as const, error: { code: 'NOT_FOUND' } };
    const profileId = (profile as { id: string }).id;

    const admin = getAdminClient();

    // Delete the learned/taught child rows. Deleting chat_sessions cascades its
    // chat_messages and any transcript_gaps tied to a session; the explicit
    // transcript_gaps delete then clears gaps not linked to a session.
    const childTables = [
      'intake_answers',
      'sandbox_sessions',
      'brain_hardening_sessions',
      'chat_sessions',
      'transcript_gaps',
    ] as const;

    for (const table of childTables) {
      const { error } = await (admin.from(table) as any)
        .delete()
        .eq('candidate_profile_id', profileId);
      if (error) {
        console.error('resetAiLearning: delete failed', table, userId, error);
        return { ok: false as const, error: { code: 'INTERNAL', message: `${table}: ${error.message}` } };
      }
    }

    // Reset the brain columns on the profile row back to a blank slate. Identity
    // columns (slug, full_name, headline, target_role, ...) are left untouched.
    const { error: resetError } = await (admin.from('candidate_profiles') as any)
      .update({
        leadership_philosophy: null,
        key_wins: null,
        departure_reasons: null,
        biggest_challenge: null,
        ideal_environment: null,
        manager_needs: null,
        honest_weaknesses: null,
        wish_questions: null,
        custom_qa_pairs: [],
        redirect_topics: [],
        ai_enabled: false,
        intake_completed: false,
        brain_readiness_score: 0,
        inconsistencies_found: [],
        inconsistencies_resolved: [],
        context_package_md: null,
        context_package_updated_at: null,
        career_context_drafts: null,
        // asset_package is deliberately NOT cleared: it is the founder-produced
        // deliverable record (superadmin tool), not candidate learning.
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId);

    if (resetError) {
      console.error('resetAiLearning: profile reset failed', userId, resetError);
      return { ok: false as const, error: { code: 'INTERNAL', message: resetError.message } };
    }

    revalidatePath('/dashboard/ai');
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/settings');
    return { ok: true as const, redirectTo: '/dashboard/profile' };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

// ── Fresh start, mode B: delete everything & start over ─────────────────────
// The full nuke. Deletes the candidate_profiles row (Postgres ON DELETE CASCADE
// removes every child table: assets, résumé, sources, chat, intake, sandbox,
// gaps, hardening, meeting requests, and any saved-candidate references), clears
// all stored files (Storage is not cascaded), then nulls users.role so both the
// root router and the candidate layout send the account back through
// /onboarding as a brand-new user. The users row itself (Clerk link, email,
// subscription) is preserved.
//
// This mirrors the Clerk user.deleted webhook, which relies on the same cascade.
// Every operation is scoped to the authenticated candidate's own clerk_user_id.

export async function deleteEverythingAndRestart() {
  try {
    const { userId } = await getUserContext('candidate');
    const admin = getAdminClient();

    // 1. Remove stored media first (not covered by the DB cascade).
    await deleteAllCandidateFiles(userId);

    // 2. Delete the profile row, which cascades all candidate child tables.
    const { error: delError } = await (admin.from('candidate_profiles') as any)
      .delete()
      .eq('clerk_user_id', userId);
    if (delError) {
      console.error('deleteEverythingAndRestart: profile delete failed', userId, delError);
      return { ok: false as const, error: { code: 'INTERNAL', message: delError.message } };
    }

    // 3. Reset the role so the routers treat the account as new.
    const { error: roleError } = await (admin.from('users') as any)
      .update({ role: null, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', userId);
    if (roleError) {
      console.error('deleteEverythingAndRestart: role reset failed', userId, roleError);
      return { ok: false as const, error: { code: 'INTERNAL', message: roleError.message } };
    }

    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard/settings');
    return { ok: true as const, redirectTo: '/onboarding' };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
