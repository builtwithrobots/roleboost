import { redirect } from 'next/navigation'
import { getUserContext, AuthError } from '@/lib/auth/user-context'
import { SidebarLayout } from '@/components/ui/sidebar-layout'
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarSpacer } from '@/components/ui/sidebar'
import RoleBoostLogo from '@/components/layout/RoleBoostLogo'
import EmployerNav from '@/components/layout/EmployerNav'
import SubscriptionBadge from '@/components/layout/SubscriptionBadge'
import UserMenu from '@/components/layout/UserMenu'

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  let ctx
  try {
    ctx = await getUserContext('employer')
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === 'UNAUTHENTICATED') redirect('/sign-in')
      if (e.code === 'FORBIDDEN') redirect('/dashboard/profile')
      redirect('/onboarding')
    }
    throw e
  }

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
  )

  return (
    <SidebarLayout navbar={<RoleBoostLogo compact />} sidebar={sidebar}>
      {children}
    </SidebarLayout>
  )
}
