import { redirect } from 'next/navigation';
import { getUserContext, AuthError, getAdminPreviewRole } from '@/lib/auth/user-context';
import { SidebarLayout } from '@/components/ui/sidebar-layout';
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarSpacer } from '@/components/ui/sidebar';
import RoleBoostLogo from '@/components/layout/RoleBoostLogo';
import CandidateNav from '@/components/layout/CandidateNav';
import SubscriptionBadge from '@/components/layout/SubscriptionBadge';
import UserMenu from '@/components/layout/UserMenu';
import AdminCommandBar from '@/components/admin/AdminCommandBar';
import HelpButton from '@/components/candidate/HelpButton';

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === 'UNAUTHENTICATED') redirect('/sign-in');
      if (e.code === 'SUSPENDED') redirect('/suspended');
      if (e.code === 'FORBIDDEN') redirect('/dashboard/candidates');
      redirect('/onboarding');
    }
    throw e;
  }

  const previewRole = ctx.isAdmin ? await getAdminPreviewRole() : null;
  const impersonating = ctx.impersonating
    ? { email: ctx.impersonating.targetEmail, role: ctx.impersonating.targetRole }
    : null;

  // New meeting-request count for the sidebar notification badge. RLS scopes both
  // reads to the candidate's own rows.
  let newMeetingRequests = 0;
  const { data: prof } = await ctx.supabase
    .from('candidate_profiles')
    .select('id')
    .eq('clerk_user_id', ctx.userId)
    .maybeSingle();
  if (prof) {
    const { count } = await ctx.supabase
      .from('meeting_requests')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_profile_id', (prof as { id: string }).id)
      .eq('status', 'new');
    newMeetingRequests = count ?? 0;
  }

  const sidebar = (
    <Sidebar>
      <SidebarHeader>
        <RoleBoostLogo />
      </SidebarHeader>

      <SidebarBody>
        <CandidateNav newMeetingRequests={newMeetingRequests} />
        <SidebarSpacer />
        <HelpButton />
      </SidebarBody>

      <SidebarFooter>
        <div className="flex items-center justify-between px-2 pb-1">
          <SubscriptionBadge
            tier={ctx.user.subscription_tier}
            status={ctx.user.subscription_status}
          />
        </div>
        <UserMenu role="candidate" />
      </SidebarFooter>
    </Sidebar>
  );

  return (
    <>
      {ctx.isAdmin && (previewRole || impersonating) && (
        <AdminCommandBar previewRole={previewRole} impersonating={impersonating} />
      )}
      <SidebarLayout navbar={<RoleBoostLogo compact />} sidebar={sidebar}>
        {children}
      </SidebarLayout>
    </>
  );
}
