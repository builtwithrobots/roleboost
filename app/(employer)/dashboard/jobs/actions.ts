'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { adminClient } from '@/lib/supabase/admin';

const JobInput = z.object({
  title: z.string().min(1).max(200),
  department: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  is_active: z.boolean().default(true),
});

async function getEmployerAccountId(userId: string): Promise<string | null> {
  const { data } = await (adminClient.from('employer_members') as any)
    .select('employer_account_id')
    .eq('clerk_user_id', userId)
    .single();
  return data?.employer_account_id ?? null;
}

export async function createJobPosting(input: unknown) {
  try {
    const { userId } = await getUserContext('employer');
    const parsed = JobInput.parse(input);
    const employerAccountId = await getEmployerAccountId(userId);
    if (!employerAccountId) return { ok: false as const, error: { code: 'FORBIDDEN' } };

    const { error } = await (adminClient.from('job_postings') as any).insert({
      employer_account_id: employerAccountId,
      created_by: userId,
      title: parsed.title,
      department: parsed.department || null,
      location: parsed.location || null,
      description: parsed.description || null,
      is_active: parsed.is_active,
    });

    if (error) {
      console.error('createJobPosting: failed', userId, error);
      return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };
    }

    revalidatePath('/dashboard/jobs');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false as const, error: { code: 'INVALID_INPUT', details: e.issues } };
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}

export async function archiveJobPosting(jobId: string) {
  try {
    const { supabase } = await getUserContext('employer');

    const { error } = await supabase
      .from('job_postings')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (error) return { ok: false as const, error: { code: 'INTERNAL', message: error.message } };

    revalidatePath('/dashboard/jobs');
    return { ok: true as const };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false as const, error: { code: e.code } };
    throw e;
  }
}
