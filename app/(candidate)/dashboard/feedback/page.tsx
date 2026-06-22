import { Inbox } from 'lucide-react';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';

export default function CandidateFeedbackPage() {
  return (
    <DashboardPage className="min-h-full bg-[var(--rb-bg-page)]">
      <PageHeader
        title="Feedback"
        description="Notes and feedback that employers send you after viewing your profile."
      />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <EmptyState
          icon={Inbox}
          title="No feedback yet"
          description="When an employer sends feedback through RoleBoost, it lands here and in your inbox. Share your profile link to get the conversation started."
        />
      </div>
    </DashboardPage>
  );
}
