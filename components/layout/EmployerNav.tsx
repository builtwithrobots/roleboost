'use client'

import { usePathname } from 'next/navigation'
import {
  Users,
  Columns3,
  Briefcase,
  UserPlus,
} from 'lucide-react'
import {
  SidebarDivider,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/components/ui/sidebar'

const workflowItems = [
  { href: '/dashboard/candidates', label: 'Candidates', Icon: Users },
  { href: '/dashboard/board',      label: 'Board',      Icon: Columns3 },
  { href: '/dashboard/jobs',       label: 'Jobs',       Icon: Briefcase },
]

const secondaryItems = [
  { href: '/dashboard/team', label: 'Team', Icon: UserPlus },
]

export default function EmployerNav() {
  const pathname = usePathname()

  return (
    <>
      <SidebarSection>
        <SidebarHeading>Hiring</SidebarHeading>
        {workflowItems.map(({ href, label, Icon }) => (
          <SidebarItem key={href} href={href} current={pathname === href}>
            <Icon data-slot="icon" strokeWidth={1.5} />
            <SidebarLabel>{label}</SidebarLabel>
          </SidebarItem>
        ))}
      </SidebarSection>

      <SidebarDivider />

      <SidebarSection>
        <SidebarHeading>Workspace</SidebarHeading>
        {secondaryItems.map(({ href, label, Icon }) => (
          <SidebarItem key={href} href={href} current={pathname === href}>
            <Icon data-slot="icon" strokeWidth={1.5} />
            <SidebarLabel>{label}</SidebarLabel>
          </SidebarItem>
        ))}
      </SidebarSection>
    </>
  )
}
