import { BarChart3, Eye, MessageSquare, Clock } from 'lucide-react';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';

const STATS = [
  { label: 'Profile views', value: '-', Icon: Eye },
  { label: 'AI chats started', value: '-', Icon: MessageSquare },
  { label: 'Avg. time on profile', value: '-', Icon: Clock },
];

export default function CandidateAnalyticsPage() {
  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Analytics"
        description="See who's viewing your profile and how they engage with your career story."
      />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STATS.map(({ label, value, Icon }) => (
            <div key={label} className="rb-stat-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--rb-text-secondary)]">{label}</span>
                <Icon className="size-4 text-[var(--rb-text-muted)]" strokeWidth={1.5} />
              </div>
              <span className="font-data text-3xl font-bold text-[var(--rb-text)]">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <EmptyState
            icon={BarChart3}
            title="No activity yet"
            description="Once recruiters open your RoleBoost profile, your views, watch time, and engagement trends will appear here."
          />
        </div>
      </div>
    </DashboardPage>
  );
}
