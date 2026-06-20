'use client'

import { usePathname } from 'next/navigation'
import {
  UserRound,
  FolderOpen,
  Share2,
  Eye,
  BarChart3,
  Inbox,
  Bot,
} from 'lucide-react'
import {
  SidebarDivider,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/components/ui/sidebar'

const profileItems = [
  { href: '/dashboard/profile', label: 'Profile',   Icon: UserRound },
  { href: '/dashboard/assets',  label: 'Assets',    Icon: FolderOpen },
  { href: '/dashboard/share',   label: 'Share Hub', Icon: Share2 },
  { href: '/dashboard/preview', label: 'Preview',   Icon: Eye },
]

const insightItems = [
  { href: '/dashboard/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/dashboard/feedback',  label: 'Feedback',  Icon: Inbox },
]

const aiItems = [
  { href: '/dashboard/ai', label: 'AI Studio', Icon: Bot },
]

export default function CandidateNav() {
  const pathname = usePathname()

  return (
    <>
      <SidebarSection>
        <SidebarHeading>Profile</SidebarHeading>
        {profileItems.map(({ href, label, Icon }) => (
          <SidebarItem key={href} href={href} current={pathname === href}>
            <Icon data-slot="icon" strokeWidth={1.5} />
            <SidebarLabel>{label}</SidebarLabel>
          </SidebarItem>
        ))}
      </SidebarSection>

      <SidebarDivider />

      <SidebarSection>
        <SidebarHeading>Insights</SidebarHeading>
        {insightItems.map(({ href, label, Icon }) => (
          <SidebarItem key={href} href={href} current={pathname === href}>
            <Icon data-slot="icon" strokeWidth={1.5} />
            <SidebarLabel>{label}</SidebarLabel>
          </SidebarItem>
        ))}
      </SidebarSection>

      <SidebarDivider />

      <SidebarSection>
        <SidebarHeading>AI</SidebarHeading>
        {aiItems.map(({ href, label, Icon }) => (
          <SidebarItem key={href} href={href} current={pathname === href}>
            <Icon data-slot="icon" strokeWidth={1.5} />
            <SidebarLabel>{label}</SidebarLabel>
          </SidebarItem>
        ))}
      </SidebarSection>
    </>
  )
}
