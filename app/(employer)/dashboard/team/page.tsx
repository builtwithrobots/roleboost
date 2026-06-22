import { UserPlus } from 'lucide-react';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';

export default function EmployerTeamPage() {
  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Team"
        description="Invite colleagues to share your candidate pool, board, and transcripts."
        actions={
          <span className="rb-badge bg-[var(--rb-brand-subtle)] text-[var(--rb-text-brand)]">
            Coming soon
          </span>
        }
      />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <EmptyState
          icon={UserPlus}
          title="Build your hiring team"
          description="Team invites and role management are on the way. Soon you'll be able to add members, assign owner or member access, and collaborate on candidates together."
        />
      </div>
    </DashboardPage>
  );
}
