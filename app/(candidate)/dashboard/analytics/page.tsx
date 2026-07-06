import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';
import { adminClient } from '@/lib/supabase/admin';
import DashboardPage from '@/components/layout/DashboardPage';
import PageHeader from '@/components/ui/page-header';
import AnalyticsDashboard, {
  type AnalyticsData,
  type TopicRow,
  type ActivityEvent,
} from '@/components/candidate/AnalyticsDashboard';

// Always fresh: a view or chat that just happened should move the numbers.
export const dynamic = 'force-dynamic';

// Candidate analytics. Reads through the service-role client, scoped explicitly
// to the owner's candidate_profile_id (resolved from their verified
// clerk_user_id) -- the same owner-scoped admin pattern the transcripts and
// employer pages use, so the numbers show reliably.

const DAY = 86_400_000;
const WINDOW_DAYS = 30;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Buckets ISO timestamps into a dense last-N-days daily series (oldest first). */
function dailySeries(timestamps: string[], now: number, days: number): number[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) counts.set(dayKey(new Date(ts)), (counts.get(dayKey(new Date(ts))) ?? 0) + 1);
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(counts.get(dayKey(new Date(now - i * DAY))) ?? 0);
  }
  return out;
}

/** This-7-days count and the change vs the prior 7 days, from raw timestamps. */
function weekOverWeek(timestamps: string[], now: number): { last7: number; deltaPct: number | null } {
  const cutoff1 = now - 7 * DAY;
  const cutoff2 = now - 14 * DAY;
  let last7 = 0;
  let prev7 = 0;
  for (const ts of timestamps) {
    const t = new Date(ts).getTime();
    if (t >= cutoff1) last7 += 1;
    else if (t >= cutoff2) prev7 += 1;
  }
  const deltaPct = prev7 === 0 ? (last7 > 0 ? 100 : null) : Math.round(((last7 - prev7) / prev7) * 100);
  return { last7, deltaPct };
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

export default async function CandidateAnalyticsPage() {
  let ctx;
  try {
    ctx = await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) redirect('/sign-in');
    throw e;
  }

  const { data: profile } = await (adminClient.from('candidate_profiles') as any)
    .select('id')
    .eq('clerk_user_id', ctx.userId)
    .maybeSingle();

  const now = Date.now();
  const since = new Date(now - WINDOW_DAYS * DAY).toISOString();

  let data: AnalyticsData = {
    totals: { views: 0, chats: 0, meetings: 0, conversionPct: null },
    week: { views: null, chats: null, meetings: null },
    daily: { views: [], chats: [] },
    funnel: { views: 0, chats: 0, meetings: 0 },
    topics: [],
    activity: [],
    hasAnyData: false,
    windowDays: WINDOW_DAYS,
  };

  if (profile) {
    const pid = (profile as { id: string }).id;

    const [viewsRes, sessionsRes, meetingsRes, gapsRes] = await Promise.all([
      (adminClient.from('profile_views') as any)
        .select('viewed_at')
        .eq('candidate_profile_id', pid)
        .gte('viewed_at', since)
        .order('viewed_at', { ascending: false })
        .limit(2000),
      (adminClient.from('chat_sessions') as any)
        .select('id, started_at, is_sandbox, employer_company_name, viewer_clerk_user_id')
        .eq('candidate_profile_id', pid)
        .eq('is_sandbox', false)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(2000),
      (adminClient.from('meeting_requests') as any)
        .select('created_at, recruiter_name, recruiter_email')
        .eq('candidate_profile_id', pid)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500),
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

    const viewTs = views.map((v) => v.viewed_at);
    const chatTs = sessions.map((s) => s.started_at);
    const meetingTs = meetings.map((m) => m.created_at);

    const totalChats = chatTs.length;
    const totalMeetings = meetingTs.length;

    // Topic demand: group open (unaddressed) gaps by brain category, rank by count.
    const byCategory = new Map<string, { count: number; topPriority: 'high' | 'medium' | 'low'; sample: string }>();
    const rank = { high: 3, medium: 2, low: 1 } as const;
    for (const g of gaps) {
      if (g.is_addressed) continue;
      const cur = byCategory.get(g.category);
      if (!cur) {
        byCategory.set(g.category, { count: 1, topPriority: g.priority, sample: g.question_asked });
      } else {
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

    // Activity feed: merge the three streams, newest first.
    const activity: ActivityEvent[] = [
      ...views.slice(0, 20).map((v) => ({ kind: 'view' as const, at: v.viewed_at, label: 'A recruiter opened your profile' })),
      ...sessions.slice(0, 20).map((s) => ({
        kind: 'chat' as const,
        at: s.started_at,
        label: `${s.employer_company_name?.trim() || (s.viewer_clerk_user_id ? 'A signed-in recruiter' : 'A recruiter')} chatted with your AI`,
      })),
      ...meetings.slice(0, 20).map((m) => ({
        kind: 'meeting' as const,
        at: m.created_at,
        label: `Meeting request from ${m.recruiter_name?.trim() || m.recruiter_email}`,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12);

    data = {
      totals: {
        views: viewTs.length,
        chats: totalChats,
        meetings: totalMeetings,
        conversionPct: totalChats > 0 ? Math.round((totalMeetings / totalChats) * 100) : null,
      },
      week: {
        views: weekOverWeek(viewTs, now),
        chats: weekOverWeek(chatTs, now),
        meetings: weekOverWeek(meetingTs, now),
      },
      daily: {
        views: dailySeries(viewTs, now, WINDOW_DAYS),
        chats: dailySeries(chatTs, now, WINDOW_DAYS),
      },
      funnel: { views: viewTs.length, chats: totalChats, meetings: totalMeetings },
      topics,
      activity,
      hasAnyData: viewTs.length + totalChats + totalMeetings > 0,
      windowDays: WINDOW_DAYS,
    };
  }

  return (
    <DashboardPage className="min-h-full">
      <PageHeader
        title="Analytics"
        description="How recruiters are finding, engaging with, and reaching out through your profile. Last 30 days."
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AnalyticsDashboard data={data} />
      </div>
    </DashboardPage>
  );
}
