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
  MessagesSquare,
  CalendarClock,
  Settings,
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
  { href: '/dashboard/transcripts',      label: 'Transcripts',      Icon: MessagesSquare },
  { href: '/dashboard/meeting-requests', label: 'Meeting Requests', Icon: CalendarClock },
  { href: '/dashboard/analytics',        label: 'Analytics',        Icon: BarChart3 },
  { href: '/dashboard/feedback',         label: 'Feedback',         Icon: Inbox },
]

const aiItems = [
  { href: '/dashboard/ai', label: 'AI Studio', Icon: Bot },
]

const accountItems = [
  { href: '/dashboard/settings', label: 'Settings', Icon: Settings },
]

/** A small count pill shown on a nav item, e.g. new meeting requests. */
function NavBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} new`}
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--rb-brand)] px-1.5 text-[11px] font-semibold leading-5 text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default function CandidateNav({ newMeetingRequests = 0 }: { newMeetingRequests?: number }) {
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
            {href === '/dashboard/meeting-requests' && newMeetingRequests > 0 && (
              <NavBadge count={newMeetingRequests} />
            )}
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

      <SidebarDivider />

      <SidebarSection>
        <SidebarHeading>Account</SidebarHeading>
        {accountItems.map(({ href, label, Icon }) => (
          <SidebarItem key={href} href={href} current={pathname === href}>
            <Icon data-slot="icon" strokeWidth={1.5} />
            <SidebarLabel>{label}</SidebarLabel>
          </SidebarItem>
        ))}
      </SidebarSection>
    </>
  )
}
