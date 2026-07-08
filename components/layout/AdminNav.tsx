'use client'

import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Package } from 'lucide-react'
import {
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/components/ui/sidebar'

const controlItems = [
  { href: '/admin', label: 'Overview', Icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', Icon: Users },
  { href: '/admin/asset-packages', label: 'Asset Packages', Icon: Package },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <SidebarSection>
      <SidebarHeading>Admin</SidebarHeading>
      {controlItems.map(({ href, label, Icon }) => (
        <SidebarItem key={href} href={href} current={pathname === href}>
          <Icon data-slot="icon" strokeWidth={1.5} />
          <SidebarLabel>{label}</SidebarLabel>
        </SidebarItem>
      ))}
    </SidebarSection>
  )
}
