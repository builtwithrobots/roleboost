import { redirect } from 'next/navigation';
import { getUserContext, AuthError, getAdminPreviewRole } from '@/lib/auth/user-context';
import { SidebarLayout } from '@/components/ui/sidebar-layout';
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarSpacer } from '@/components/ui/sidebar';
import RoleBoostLogo from '@/components/layout/RoleBoostLogo';
import EmployerNav from '@/components/layout/EmployerNav';
import SubscriptionBadge from '@/components/layout/SubscriptionBadge';
import UserMenu from '@/components/layout/UserMenu';
import AdminCommandBar from '@/components/admin/AdminCommandBar';

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getUserContext('employer');
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === 'UNAUTHENTICATED') redirect('/sign-in');
      if (e.code === 'SUSPENDED') redirect('/suspended');
      if (e.code === 'FORBIDDEN') redirect('/dashboard/profile');
      redirect('/onboarding');
    }
    throw e;
  }

  const previewRole = ctx.isAdmin ? await getAdminPreviewRole() : null;
  const impersonating = ctx.impersonating
    ? { email: ctx.impersonating.targetEmail, role: ctx.impersonating.targetRole }
    : null;

  const sidebar = (
    <Sidebar>
      <SidebarHeader>
        <RoleBoostLogo />
      </SidebarHeader>

      <SidebarBody>
        <EmployerNav />
        <SidebarSpacer />
      </SidebarBody>

      <SidebarFooter>
        <div className="flex items-center justify-between px-2 pb-1">
          <SubscriptionBadge
            tier={ctx.user.subscription_tier}
            status={ctx.user.subscription_status}
          />
        </div>
        <UserMenu role="employer" />
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
