import { UserRound, Briefcase } from 'lucide-react';
import { setAdminPreviewRole } from '@/lib/auth/admin-actions';
import { SidebarHeading, SidebarSection } from '@/components/ui/sidebar';

// Sidebar launchers that let a superadmin jump straight into the full candidate
// or employer dashboard (with every menu item) from anywhere in /admin. Each is a
// server-action form that sets the preview cookie and redirects into that
// dashboard; the command bar there switches back. Styled to match SidebarItem.

const itemClass =
  'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-[var(--rb-text)] hover:bg-[var(--rb-bg-surface-raised)] [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-[var(--rb-text-muted)] hover:[&>svg]:text-[var(--rb-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-border-focus)]';

async function viewAsCandidate() {
  'use server';
  await setAdminPreviewRole('candidate');
}

async function viewAsEmployer() {
  'use server';
  await setAdminPreviewRole('employer');
}

export default function AdminViewLaunchers() {
  return (
    <SidebarSection>
      <SidebarHeading>View as</SidebarHeading>
      <form action={viewAsCandidate}>
        <button type="submit" className={itemClass}>
          <UserRound strokeWidth={1.5} aria-hidden="true" />
          Candidate view
        </button>
      </form>
      <form action={viewAsEmployer}>
        <button type="submit" className={itemClass}>
          <Briefcase strokeWidth={1.5} aria-hidden="true" />
          Employer view
        </button>
      </form>
    </SidebarSection>
  );
}
