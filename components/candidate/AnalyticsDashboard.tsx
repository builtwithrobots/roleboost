import Link from 'next/link';
import {
  Eye,
  MessageSquare,
  CalendarClock,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  BarChart3,
} from 'lucide-react';

export interface TopicRow {
  category: string;
  label: string;
  count: number;
  priority: 'high' | 'medium' | 'low';
  sample: string;
}

export interface ActivityEvent {
  kind: 'view' | 'chat' | 'meeting';
  at: string;
  label: string;
}

export interface AnalyticsData {
  totals: { views: number; chats: number; meetings: number; conversionPct: number | null };
  week: {
    views: { last7: number; deltaPct: number | null } | null;
    chats: { last7: number; deltaPct: number | null } | null;
    meetings: { last7: number; deltaPct: number | null } | null;
  };
  daily: { views: number[]; chats: number[] };
  funnel: { views: number; chats: number; meetings: number };
  topics: TopicRow[];
  activity: ActivityEvent[];
  hasAnyData: boolean;
  windowDays: number;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  if (!data.hasAnyData) {
    return (
      <div className="rb-card flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
          <BarChart3 className="size-6 text-[var(--rb-brand)]" strokeWidth={1.5} />
        </span>
        <div>
          <p className="text-base font-semibold text-[var(--rb-text)]">No activity yet</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--rb-text-muted)]">
            Once recruiters open your profile and chat with your AI, your views, engagement, and
            meeting requests will show up here.
          </p>
        </div>
        <Link
          href="/dashboard/share"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Sparkles className="size-4" />
          Share your profile link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Profile views"
          value={data.totals.views}
          Icon={Eye}
          spark={data.daily.views}
          week={data.week.views}
        />
        <StatCard
          label="Chats started"
          value={data.totals.chats}
          Icon={MessageSquare}
          spark={data.daily.chats}
          week={data.week.chats}
        />
        <StatCard
          label="Meeting requests"
          value={data.totals.meetings}
          Icon={CalendarClock}
          week={data.week.meetings}
        />
        <StatCard
          label="Chat to meeting"
          value={data.totals.conversionPct === null ? '—' : `${data.totals.conversionPct}%`}
          Icon={Target}
          hint="of chats led to a meeting request"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pipeline funnel */}
        <section className="rb-card p-5">
          <h2 className="text-sm font-semibold text-[var(--rb-text)]">Your pipeline</h2>
          <p className="mb-4 text-xs text-[var(--rb-text-muted)]">How interest turns into conversations, last {data.windowDays} days.</p>
          <Funnel funnel={data.funnel} />
        </section>

        {/* Activity over time (small multiples, never dual-axis) */}
        <section className="rb-card p-5">
          <h2 className="text-sm font-semibold text-[var(--rb-text)]">Activity over time</h2>
          <p className="mb-4 text-xs text-[var(--rb-text-muted)]">Daily, last {data.windowDays} days.</p>
          <div className="flex flex-col gap-4">
            <TrendRow label="Profile views" data={data.daily.views} total={data.totals.views} />
            <TrendRow label="Chats started" data={data.daily.chats} total={data.totals.chats} />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* What recruiters ask */}
        <section className="rb-card p-5">
          <h2 className="text-sm font-semibold text-[var(--rb-text)]">What recruiters want to know</h2>
          <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
            Topics your AI got asked about but could answer better. Strengthen these to close the gap.
          </p>
          {data.topics.length === 0 ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-3 py-4 text-center text-xs text-[var(--rb-text-muted)]">
              Nothing flagged yet. As recruiters chat, weak spots will surface here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.topics.map((t) => (
                <TopicItem key={t.category} topic={t} />
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="rb-card p-5">
          <h2 className="text-sm font-semibold text-[var(--rb-text)]">Recent activity</h2>
          <p className="mb-4 text-xs text-[var(--rb-text-muted)]">The latest views, chats, and requests.</p>
          <ul className="flex flex-col">
            {data.activity.map((e, i) => (
              <ActivityItem key={i} event={e} last={i === data.activity.length - 1} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  Icon,
  spark,
  week,
  hint,
}: {
  label: string;
  value: number | string;
  Icon: typeof Eye;
  spark?: number[];
  week?: { last7: number; deltaPct: number | null } | null;
  hint?: string;
}) {
  return (
    <div className="rb-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--rb-text-secondary)]">{label}</span>
        <Icon className="size-4 text-[var(--rb-text-muted)]" strokeWidth={1.5} />
      </div>
      <span className="font-data text-3xl font-bold leading-none text-[var(--rb-text)]">{value}</span>
      {spark && spark.some((n) => n > 0) ? (
        <Sparkline data={spark} />
      ) : (
        <div className="h-8" aria-hidden="true" />
      )}
      {week ? (
        <DeltaBadge deltaPct={week.deltaPct} last7={week.last7} />
      ) : hint ? (
        <span className="text-[11px] text-[var(--rb-text-muted)]">{hint}</span>
      ) : (
        <span className="h-4" aria-hidden="true" />
      )}
    </div>
  );
}

function DeltaBadge({ deltaPct, last7 }: { deltaPct: number | null; last7: number }) {
  if (deltaPct === null) {
    return <span className="text-[11px] text-[var(--rb-text-muted)]">{last7} in the last 7 days</span>;
  }
  const up = deltaPct >= 0;
  const Arrow = deltaPct === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const color = deltaPct === 0 ? 'text-[var(--rb-text-muted)]' : up ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]';
  return (
    <span className="flex items-center gap-1 text-[11px] text-[var(--rb-text-muted)]">
      <span className={`inline-flex items-center gap-0.5 font-medium ${color}`}>
        <Arrow className="size-3" />
        {Math.abs(deltaPct)}%
      </span>
      vs prior 7 days
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...data);
  const n = data.length;
  const pts = data.map((v, i) => [n <= 1 ? 0 : (i / (n - 1)) * w, h - (v / max) * (h - 4) - 2] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill="var(--rb-brand)" opacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke="var(--rb-brand)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrendRow({ label, data, total }: { label: string; data: number[]; total: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-[var(--rb-text-secondary)]">{label}</span>
        <span className="font-data text-xs font-semibold text-[var(--rb-text)]">{total}</span>
      </div>
      {data.some((n) => n > 0) ? (
        <Sparkline data={data} />
      ) : (
        <div className="flex h-8 items-center text-[11px] text-[var(--rb-text-muted)]">No activity yet</div>
      )}
    </div>
  );
}

function Funnel({ funnel }: { funnel: { views: number; chats: number; meetings: number } }) {
  const stages = [
    { label: 'Profile views', value: funnel.views, Icon: Eye },
    { label: 'Chats started', value: funnel.chats, Icon: MessageSquare },
    { label: 'Meeting requests', value: funnel.meetings, Icon: CalendarClock },
  ];
  const max = Math.max(1, funnel.views, funnel.chats, funnel.meetings);
  return (
    <div className="flex flex-col gap-3">
      {stages.map((s, i) => {
        const prev = i === 0 ? null : stages[i - 1].value;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-[var(--rb-text-secondary)]">
                <s.Icon className="size-3.5 text-[var(--rb-text-muted)]" />
                {s.label}
              </span>
              <span className="flex items-center gap-2">
                {conv !== null && (
                  <span className="text-[11px] text-[var(--rb-text-muted)]">{conv}% of prior</span>
                )}
                <span className="font-data font-semibold text-[var(--rb-text)]">{s.value}</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--rb-bg-surface-raised)]">
              <div
                className="h-full rounded-full bg-[var(--rb-brand)]"
                style={{ width: `${Math.max(s.value > 0 ? 4 : 0, (s.value / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PRIORITY_META: Record<TopicRow['priority'], { label: string; cls: string }> = {
  high: { label: 'High demand', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  medium: { label: 'Medium', cls: 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-secondary)]' },
  low: { label: 'Low', cls: 'bg-[var(--rb-bg-surface-raised)] text-[var(--rb-text-muted)]' },
};

function TopicItem({ topic }: { topic: TopicRow }) {
  const p = PRIORITY_META[topic.priority];
  return (
    <li className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--rb-border)] p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--rb-text)]">{topic.label}</p>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.cls}`}>{p.label}</span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--rb-text-muted)]">
          e.g. &ldquo;{topic.sample}&rdquo;
        </p>
      </div>
      <Link
        href="/dashboard/ai"
        className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--rb-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-brand)]"
      >
        Strengthen
      </Link>
    </li>
  );
}

function ActivityItem({ event, last }: { event: ActivityEvent; last: boolean }) {
  const meta = {
    view: { Icon: Eye },
    chat: { Icon: MessageSquare },
    meeting: { Icon: CalendarClock },
  }[event.kind];
  return (
    <li className={`flex items-center gap-3 py-2.5 ${last ? '' : 'border-b border-[var(--rb-border)]'}`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
        <meta.Icon className="size-4 text-[var(--rb-brand)]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--rb-text-secondary)]">{event.label}</span>
      <span className="shrink-0 text-xs text-[var(--rb-text-muted)]">{relativeTime(event.at)}</span>
    </li>
  );
}
