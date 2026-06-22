import { Bot } from 'lucide-react';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';

export default function AIStudioPage() {
  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="AI Studio"
        description="Train and fine-tune the career AI that answers recruiters on your behalf."
        actions={
          <span className="rb-badge bg-[var(--rb-brand-subtle)] text-[var(--rb-text-brand)]">
            Coming soon
          </span>
        }
      />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <EmptyState
          icon={Bot}
          title="Your career AI lives here"
          description="Soon you'll review the questions recruiters ask most, edit how your AI answers, and set topics that redirect to a direct conversation — all from this studio."
        />
      </div>
    </DashboardPage>
  );
}
