'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { LogOut, Settings, CreditCard } from 'lucide-react'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
} from '@/components/ui/dropdown'
import { SidebarItem, SidebarLabel } from '@/components/ui/sidebar'

export default function UserMenu({ role }: { role: 'candidate' | 'employer' | 'admin' }) {
  const { user } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()

  if (!user) return null

  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join('') || user.primaryEmailAddress?.emailAddress[0].toUpperCase() || '?'

  const displayName = user.fullName || user.primaryEmailAddress?.emailAddress || 'Account'
  const email = user.primaryEmailAddress?.emailAddress

  // Candidates have a dedicated settings page; employers have no settings
  // surface yet, so their link is left as-is. Admins go back to the control center.
  const accountSettingsHref =
    role === 'candidate' ? '/dashboard/settings' : role === 'admin' ? '/admin' : '/account'

  return (
    <Dropdown>
      <DropdownButton as={SidebarItem} className="w-full">
        <span
          data-slot="avatar"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand)] text-xs font-bold text-white sm:size-6"
          aria-hidden="true"
        >
          {initials}
        </span>
        <SidebarLabel>{displayName}</SidebarLabel>
      </DropdownButton>

      <DropdownMenu anchor="top start" className="min-w-64">
        <DropdownHeader>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">{displayName}</span>
            {email && (
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{email}</span>
            )}
          </div>
        </DropdownHeader>

        <DropdownDivider />

        <DropdownItem href={accountSettingsHref}>
          <Settings data-slot="icon" strokeWidth={1.5} />
          Account settings
        </DropdownItem>

        {role === 'employer' && (
          <DropdownItem href="/billing">
            <CreditCard data-slot="icon" strokeWidth={1.5} />
            Billing
          </DropdownItem>
        )}

        <DropdownDivider />

        <DropdownItem onClick={() => signOut(() => router.push('/sign-in'))}>
          <LogOut data-slot="icon" strokeWidth={1.5} />
          Sign out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
