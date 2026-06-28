import { Eye } from 'lucide-react';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';

export default function CandidatePreviewPage() {
  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Preview"
        description="See your profile exactly as employers experience it."
      />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <EmptyState
          icon={Eye}
          title="Preview is on the way"
          description="The live employer-view modal, audio, video, deck, infographic, resume, and your AI chat, will render here so you can check it before you share."
        />
      </div>
    </DashboardPage>
  );
}
