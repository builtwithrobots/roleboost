'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { adminClient } from '@/lib/supabase/admin';
import { parseResumeText } from '@/lib/ai/parse-resume';
import { generateResumeDocuments } from '@/lib/resume/generate';

const IdInput = z.object({ id: z.string().uuid() });
const SaveInput = z.object({ id: z.string().uuid(), markdown: z.string().min(1).max(50000) });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ownedResumeDoc(userId: string, id: string): Promise<any | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminClient.from('resume_documents') as any)
    .select('id, clerk_user_id, status')
    .eq('id', id)
    .eq('clerk_user_id', userId)
    .single();
  return data ?? null;
}

/** Generate (or re-generate) the .docx/.pdf from the current canonical résumé. */
export async function generateResume(input: unknown) {
  try {
    const { userId } = await getUserContext('candidate');
    const { id } = IdInput.parse(input);
    if (!(await ownedResumeDoc(userId, id))) return { ok: false as const, error: { code: 'NOT_FOUND' } };

    await generateResumeDocuments(id, userId);
    revalidatePath('/dashboard/assets');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    console.error('generateResume failed', e);
    return { ok: false as const, error: { code: 'INTERNAL' } };
  }
}

/**
 * Persist the candidate's edited Markdown, re-derive the canonical résumé from it
 * (so the generated documents reflect the edits), and regenerate .docx/.pdf.
 * Markdown is the editable source of truth; canonical_json is derived for rendering.
 */
export async function saveAndRegenerateResume(input: unknown) {
  try {
    const { userId } = await getUserContext('candidate');
    const { id, markdown } = SaveInput.parse(input);
    if (!(await ownedResumeDoc(userId, id))) return { ok: false as const, error: { code: 'NOT_FOUND' } };

    const parsed = await parseResumeText(markdown);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('resume_documents') as any)
      .update({
        canonical_json: parsed.json,
        canonical_markdown: markdown, // keep the candidate's edits verbatim
        status: 'generating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    await generateResumeDocuments(id, userId);
    revalidatePath('/dashboard/assets');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    console.error('saveAndRegenerateResume failed', e);
    return { ok: false as const, error: { code: 'INTERNAL' } };
  }
}

/** Mark the résumé approved. (Phase 2 will hook profile-field derivation here.) */
export async function approveResume(input: unknown) {
  try {
    const { userId } = await getUserContext('candidate');
    const { id } = IdInput.parse(input);
    const doc = await ownedResumeDoc(userId, id);
    if (!doc) return { ok: false as const, error: { code: 'NOT_FOUND' } };
    if (doc.status !== 'ready' && doc.status !== 'approved') {
      return { ok: false as const, error: { code: 'INVALID_INPUT', message: 'Generate the résumé before approving' } };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('resume_documents') as any)
      .update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);

    revalidatePath('/dashboard/assets');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT' } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    console.error('approveResume failed', e);
    return { ok: false as const, error: { code: 'INTERNAL' } };
  }
}
