import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { SidebarLayout } from '@/components/ui/sidebar-layout';
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarSpacer } from '@/components/ui/sidebar';
import RoleBoostLogo from '@/components/layout/RoleBoostLogo';
import AdminNav from '@/components/layout/AdminNav';
import AdminViewLaunchers from '@/components/layout/AdminViewLaunchers';
import AdminPaletteLauncher from '@/components/admin/AdminPaletteLauncher';
import UserMenu from '@/components/layout/UserMenu';

// The superadmin dashboard shell, the same SidebarLayout the candidate and
// employer dashboards use, so an admin gets a first-class dashboard rather than
// a bare page. The command palette is mounted here so it (and its ⌘K shortcut)
// is available on every admin page.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let ctx;
  try {
    ctx = await getUserContext();
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === 'UNAUTHENTICATED') redirect('/sign-in');
      if (e.code === 'SUSPENDED') redirect('/suspended');
      redirect('/');
    }
    throw e;
  }

  if (!ctx.isAdmin) redirect('/');

  const sidebar = (
    <Sidebar>
      <SidebarHeader>
        <RoleBoostLogo />
      </SidebarHeader>

      <SidebarBody>
        <AdminNav />
        <AdminViewLaunchers />
        <SidebarSpacer />
        <div className="px-2">
          <AdminPaletteLauncher activeSession={false} />
        </div>
      </SidebarBody>

      <SidebarFooter>
        <UserMenu role="admin" />
      </SidebarFooter>
    </Sidebar>
  );

  return (
    <SidebarLayout navbar={<RoleBoostLogo compact />} sidebar={sidebar}>
      {children}
    </SidebarLayout>
  );
}
