import { redirect } from 'next/navigation';
import { getUserContext, AuthError, getAdminPreviewRole } from '@/lib/auth/user-context';
import { SidebarLayout } from '@/components/ui/sidebar-layout';
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarSpacer } from '@/components/ui/sidebar';
import RoleBoostLogo from '@/components/layout/RoleBoostLogo';
import CandidateNav from '@/components/layout/CandidateNav';
import SubscriptionBadge from '@/components/layout/SubscriptionBadge';
import UserMenu from '@/components/layout/UserMenu';
import AdminPreviewBanner from '@/components/layout/AdminPreviewBanner';
import HelpButton from '@/components/candidate/HelpButton';

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === 'UNAUTHENTICATED') redirect('/sign-in');
      if (e.code === 'FORBIDDEN') redirect('/dashboard/candidates');
      redirect('/onboarding');
    }
    throw e;
  }

  const previewRole = ctx.isAdmin ? await getAdminPreviewRole() : null;

  const sidebar = (
    <Sidebar>
      <SidebarHeader>
        <RoleBoostLogo />
      </SidebarHeader>

      <SidebarBody>
        <CandidateNav />
        <SidebarSpacer />
      </SidebarBody>

      <SidebarFooter>
        <div className="px-2 pb-1">
          <HelpButton />
        </div>
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
      {previewRole === 'candidate' && <AdminPreviewBanner previewRole="candidate" />}
      <SidebarLayout navbar={<RoleBoostLogo compact />} sidebar={sidebar}>
        {children}
      </SidebarLayout>
    </>
  );
}
