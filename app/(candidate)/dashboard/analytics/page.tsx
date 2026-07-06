import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { adminClient } from '@/lib/supabase/admin';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import AnalyticsDashboard, {
  type AnalyticsData,
  type TopicRow,
  type ActivityEvent,
  type RangeKey,
} from '@/components/candidate/AnalyticsDashboard';

// Always fresh: a view or chat that just happened should move the numbers.
export const dynamic = 'force-dynamic';

// Candidate analytics. Reads through the service-role client, scoped explicitly
// to the owner's candidate_profile_id -- the same owner-scoped admin pattern the
// transcripts pages use, so the numbers show reliably. All metrics are computed
// from raw event rows (profile_views / chat_sessions / meeting_requests), so any
// time range is just a different query over the same events.

const DAY = 86_400_000;

const RANGES: Record<RangeKey, { days: number; granularity: 'day' | 'month'; label: string; prevLabel: string }> = {
  '7d': { days: 7, granularity: 'day', label: '7 days', prevLabel: 'previous 7 days' },
  '30d': { days: 30, granularity: 'day', label: '30 days', prevLabel: 'previous 30 days' },
  '90d': { days: 90, granularity: 'day', label: '90 days', prevLabel: 'previous 90 days' },
  '12m': { days: 365, granularity: 'month', label: '12 months', prevLabel: 'previous 12 months' },
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

/** Pure relative-time formatter: takes the reference `now` so render stays pure. */
function relativeTime(iso: string, now: number): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function countBetween(timestamps: number[], from: number, to: number): number {
  let n = 0;
  for (const t of timestamps) if (t >= from && t < to) n += 1;
  return n;
}

/** Current-window total and % change vs the immediately preceding equal window. */
function metric(timestamps: number[], now: number, days: number): { total: number; deltaPct: number | null } {
  const total = countBetween(timestamps, now - days * DAY, now + DAY);
  const prev = countBetween(timestamps, now - 2 * days * DAY, now - days * DAY);
  const deltaPct = prev === 0 ? (total > 0 ? 100 : null) : Math.round(((total - prev) / prev) * 100);
  return { total, deltaPct };
}

/** Dense bucket series over the current window: daily, or monthly for 12m. */
function buildTrend(
  timestamps: number[],
  now: number,
  granularity: 'day' | 'month',
  days: number,
): { values: number[]; labels: string[] } {
  if (granularity === 'day') {
    const counts = new Map<string, number>();
    for (const t of timestamps) {
      const k = dayKey(new Date(t));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const values: number[] = [];
    for (let i = days - 1; i >= 0; i--) values.push(counts.get(dayKey(new Date(now - i * DAY))) ?? 0);
    return { values, labels: [] };
  }
  const nowD = new Date(now);
  const counts = new Map<string, number>();
  for (const t of timestamps) {
    const k = monthKey(new Date(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const values: number[] = [];
  const labels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth() - i, 1));
    values.push(counts.get(monthKey(d)) ?? 0);
    labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
  }
  return { values, labels };
}

const CATEGORY_LABELS: Record<string, string> = {
  key_wins: 'Key wins & impact',
  departure_reasons: 'Why you left roles',
  biggest_challenge: 'Biggest challenges',
  leadership_philosophy: 'Leadership approach',
  ideal_environment: 'Ideal environment',
  manager_needs: 'What you need from a manager',
  honest_weaknesses: 'Growth areas',
  wish_questions: 'Questions you wish they asked',
  additional_context: 'Other context',
};

function emptyData(rangeKey: RangeKey): AnalyticsData {
  const r = RANGES[rangeKey];
  return {
    range: { key: rangeKey, label: r.label, prevLabel: r.prevLabel },
    metrics: {
      views: { total: 0, deltaPct: null },
      chats: { total: 0, deltaPct: null },
      meetings: { total: 0, deltaPct: null },
      conversionPct: null,
    },
    trend: { granularity: r.granularity, labels: [], views: [], chats: [] },
    funnel: { views: 0, chats: 0, meetings: 0 },
    topics: [],
    activity: [],
    hasAnyData: false,
  };
}

async function loadAnalyticsData(userId: string, rangeKey: RangeKey): Promise<AnalyticsData> {
  const r = RANGES[rangeKey];
  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  if (!profile) return emptyData(rangeKey);

  const pid = (profile as { id: string }).id;
  const now = Date.now();
  // Fetch two windows back so the period-over-period delta can be computed.
  const since = new Date(now - 2 * r.days * DAY).toISOString();

  const [viewsRes, sessionsRes, meetingsRes, gapsRes] = await Promise.all([
    (adminClient.from('profile_views') as any)
      .select('viewed_at')
      .eq('candidate_profile_id', pid)
      .gte('viewed_at', since)
      .order('viewed_at', { ascending: false })
      .limit(5000),
    (adminClient.from('chat_sessions') as any)
      .select('started_at, employer_company_name, viewer_clerk_user_id')
      .eq('candidate_profile_id', pid)
      .eq('is_sandbox', false)
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(5000),
    (adminClient.from('meeting_requests') as any)
      .select('created_at, recruiter_name, recruiter_email')
      .eq('candidate_profile_id', pid)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000),
    (adminClient.from('transcript_gaps') as any)
      .select('category, question_asked, priority, is_addressed')
      .eq('candidate_profile_id', pid)
      .limit(500),
  ]);

  const views = (viewsRes.data ?? []) as { viewed_at: string }[];
  const sessions = (sessionsRes.data ?? []) as {
    started_at: string;
    employer_company_name: string | null;
    viewer_clerk_user_id: string | null;
  }[];
  const meetings = (meetingsRes.data ?? []) as {
    created_at: string;
    recruiter_name: string | null;
    recruiter_email: string;
  }[];
  const gaps = (gapsRes.data ?? []) as {
    category: string;
    question_asked: string;
    priority: 'high' | 'medium' | 'low';
    is_addressed: boolean;
  }[];

  const viewMs = views.map((v) => new Date(v.viewed_at).getTime());
  const chatMs = sessions.map((s) => new Date(s.started_at).getTime());
  const meetingMs = meetings.map((m) => new Date(m.created_at).getTime());

  const vMetric = metric(viewMs, now, r.days);
  const cMetric = metric(chatMs, now, r.days);
  const mMetric = metric(meetingMs, now, r.days);

  // Topic demand: group open gaps by brain category, rank by priority then count.
  const rank = { high: 3, medium: 2, low: 1 } as const;
  const byCategory = new Map<string, { count: number; topPriority: 'high' | 'medium' | 'low'; sample: string }>();
  for (const g of gaps) {
    if (g.is_addressed) continue;
    const cur = byCategory.get(g.category);
    if (!cur) byCategory.set(g.category, { count: 1, topPriority: g.priority, sample: g.question_asked });
    else {
      cur.count += 1;
      if (rank[g.priority] > rank[cur.topPriority]) {
        cur.topPriority = g.priority;
        cur.sample = g.question_asked;
      }
    }
  }
  const topics: TopicRow[] = Array.from(byCategory.entries())
    .map(([category, v]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      count: v.count,
      priority: v.topPriority,
      sample: v.sample,
    }))
    .sort((a, b) => rank[b.priority] - rank[a.priority] || b.count - a.count)
    .slice(0, 5);

  // Activity feed within the current window, newest first.
  const windowStart = now - r.days * DAY;
  const activity: ActivityEvent[] = [
    ...views
      .filter((v) => new Date(v.viewed_at).getTime() >= windowStart)
      .slice(0, 20)
      .map((v) => ({ kind: 'view' as const, at: v.viewed_at, label: 'A recruiter opened your profile' })),
    ...sessions
      .filter((s) => new Date(s.started_at).getTime() >= windowStart)
      .slice(0, 20)
      .map((s) => ({
        kind: 'chat' as const,
        at: s.started_at,
        label: `${s.employer_company_name?.trim() || (s.viewer_clerk_user_id ? 'A signed-in recruiter' : 'A recruiter')} chatted with your AI`,
      })),
    ...meetings
      .filter((m) => new Date(m.created_at).getTime() >= windowStart)
      .slice(0, 20)
      .map((m) => ({
        kind: 'meeting' as const,
        at: m.created_at,
        label: `Meeting request from ${m.recruiter_name?.trim() || m.recruiter_email}`,
      })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12)
    .map(({ kind, at, label }) => ({ kind, label, ago: relativeTime(at, now) }));

  const viewTrend = buildTrend(viewMs, now, r.granularity, r.days);
  const chatTrend = buildTrend(chatMs, now, r.granularity, r.days);

  return {
    range: { key: rangeKey, label: r.label, prevLabel: r.prevLabel },
    metrics: {
      views: vMetric,
      chats: cMetric,
      meetings: mMetric,
      conversionPct: cMetric.total > 0 ? Math.round((mMetric.total / cMetric.total) * 100) : null,
    },
    trend: { granularity: r.granularity, labels: viewTrend.labels, views: viewTrend.values, chats: chatTrend.values },
    funnel: { views: vMetric.total, chats: cMetric.total, meetings: mMetric.total },
    topics,
    activity,
    hasAnyData: vMetric.total + cMetric.total + mMetric.total > 0,
  };
}

export default async function CandidateAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { range } = await searchParams;
  const rangeKey: RangeKey = range && range in RANGES ? (range as RangeKey) : '30d';
  const data = await loadAnalyticsData(ctx.userId, rangeKey);

  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Analytics"
        description="How recruiters are finding, engaging with, and reaching out through your profile."
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AnalyticsDashboard data={data} />
      </div>
    </DashboardPage>
  );
}
