import { redirect } from 'next/navigation'
import { getUserContext, AuthError } from '@/lib/auth/user-context'
import { SidebarLayout } from '@/components/ui/sidebar-layout'
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarSpacer } from '@/components/ui/sidebar'
import RoleBoostLogo from '@/components/layout/RoleBoostLogo'
import CandidateNav from '@/components/layout/CandidateNav'
import SubscriptionBadge from '@/components/layout/SubscriptionBadge'
import UserMenu from '@/components/layout/UserMenu'

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  let ctx
  try {
    ctx = await getUserContext('candidate')
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === 'UNAUTHENTICATED') redirect('/sign-in')
      if (e.code === 'FORBIDDEN') redirect('/dashboard/candidates')
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
        <CandidateNav />
        <SidebarSpacer />
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
  )

  return (
    <SidebarLayout navbar={<RoleBoostLogo compact />} sidebar={sidebar}>
      {children}
    </SidebarLayout>
  )
}
