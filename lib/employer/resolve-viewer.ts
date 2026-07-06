import 'server-only';
import { adminClient } from '@/lib/supabase/admin';

// Resolves a signed-in chat viewer to their employer account, so recruiter
// conversations are attributed to a real company instead of showing as an
// anonymous "Signed-in recruiter". Uses the service-role client because
// /api/chat runs in an anonymous-friendly context (no JWT-forwarding client),
// and only reads the viewer's own membership by their verified Clerk id.

export interface EmployerViewer {
  employerAccountId: string;
  employerCompanyName: string | null;
}

export async function resolveEmployerViewer(
  clerkUserId: string,
): Promise<EmployerViewer | null> {
  try {
    const { data: member } = await (adminClient.from('employer_members') as any)
      .select('employer_account_id')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();
    if (!member?.employer_account_id) return null;

    const { data: account } = await (adminClient.from('employer_accounts') as any)
      .select('company_name')
      .eq('id', member.employer_account_id)
      .maybeSingle();

    return {
      employerAccountId: member.employer_account_id,
      employerCompanyName: account?.company_name ?? null,
    };
  } catch (e) {
    console.error('resolveEmployerViewer: failed', clerkUserId, e);
    return null;
  }
}
