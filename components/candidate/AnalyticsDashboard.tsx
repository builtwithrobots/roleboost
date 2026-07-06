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

export type RangeKey = '7d' | '30d' | '90d' | '12m';

interface MetricValue {
  total: number;
  deltaPct: number | null;
}

export interface TopicRow {
  category: string;
  label: string;
  count: number;
  priority: 'high' | 'medium' | 'low';
  sample: string;
}

export interface ActivityEvent {
  kind: 'view' | 'chat' | 'meeting';
  ago: string;
  label: string;
}

export interface AnalyticsData {
  range: { key: RangeKey; label: string; prevLabel: string };
  metrics: { views: MetricValue; chats: MetricValue; meetings: MetricValue; conversionPct: number | null };
  trend: { granularity: 'day' | 'month'; labels: string[]; views: number[]; chats: number[] };
  funnel: { views: number; chats: number; meetings: number };
  topics: TopicRow[];
  activity: ActivityEvent[];
  hasAnyData: boolean;
}

const RANGE_TABS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '12m', label: '12M' },
];

export default function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--rb-text-muted)]">Showing the last {data.range.label}.</p>
        <RangeSelector active={data.range.key} />
      </div>

      {!data.hasAnyData ? (
        <EmptyState />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Profile views"
              value={data.metrics.views.total}
              Icon={Eye}
              spark={data.trend.views}
              delta={data.metrics.views.deltaPct}
              prevLabel={data.range.prevLabel}
            />
            <StatCard
              label="Chats started"
              value={data.metrics.chats.total}
              Icon={MessageSquare}
              spark={data.trend.chats}
              delta={data.metrics.chats.deltaPct}
              prevLabel={data.range.prevLabel}
            />
            <StatCard
              label="Meeting requests"
              value={data.metrics.meetings.total}
              Icon={CalendarClock}
              delta={data.metrics.meetings.deltaPct}
              prevLabel={data.range.prevLabel}
            />
            <StatCard
              label="Chat to meeting"
              value={data.metrics.conversionPct === null ? '—' : `${data.metrics.conversionPct}%`}
              Icon={Target}
              hint="of chats led to a meeting request"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rb-card p-5">
              <h2 className="text-sm font-semibold text-[var(--rb-text)]">Your pipeline</h2>
              <p className="mb-4 text-xs text-[var(--rb-text-muted)]">How interest turns into conversations.</p>
              <Funnel funnel={data.funnel} />
            </section>

            <section className="rb-card p-5">
              <h2 className="text-sm font-semibold text-[var(--rb-text)]">Activity over time</h2>
              <p className="mb-4 text-xs text-[var(--rb-text-muted)]">
                {data.trend.granularity === 'month' ? 'By month, last 12 months.' : `Daily, last ${data.range.label}.`}
              </p>
              <div className="flex flex-col gap-4">
                <TrendRow label="Profile views" trend={data.trend} series={data.trend.views} total={data.metrics.views.total} />
                <TrendRow label="Chats started" trend={data.trend} series={data.trend.chats} total={data.metrics.chats.total} />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

            <section className="rb-card p-5">
              <h2 className="text-sm font-semibold text-[var(--rb-text)]">Recent activity</h2>
              <p className="mb-4 text-xs text-[var(--rb-text-muted)]">The latest views, chats, and requests.</p>
              {data.activity.length === 0 ? (
                <p className="rounded-[var(--radius-md)] bg-[var(--rb-bg-surface-raised)] px-3 py-4 text-center text-xs text-[var(--rb-text-muted)]">
                  No activity in this range.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {data.activity.map((e, i) => (
                    <ActivityItem key={i} event={e} last={i === data.activity.length - 1} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function RangeSelector({ active }: { active: RangeKey }) {
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className="flex gap-1 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] p-1"
    >
      {RANGE_TABS.map((t) => (
        <Link
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          href={`/dashboard/analytics?range=${t.key}`}
          className={`rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold transition-colors ${
            active === t.key
              ? 'bg-[var(--rb-brand)] text-white'
              : 'text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rb-card flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--rb-brand-subtle)]">
        <BarChart3 className="size-6 text-[var(--rb-brand)]" strokeWidth={1.5} />
      </span>
      <div>
        <p className="text-base font-semibold text-[var(--rb-text)]">No activity in this range</p>
        <p className="mt-1 max-w-sm text-sm text-[var(--rb-text-muted)]">
          Once recruiters open your profile and chat with your AI, your views, engagement, and meeting
          requests will show up here. Try a longer range, or share your link.
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

function StatCard({
  label,
  value,
  Icon,
  spark,
  delta,
  prevLabel,
  hint,
}: {
  label: string;
  value: number | string;
  Icon: typeof Eye;
  spark?: number[];
  delta?: number | null;
  prevLabel?: string;
  hint?: string;
}) {
  return (
    <div className="rb-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--rb-text-secondary)]">{label}</span>
        <Icon className="size-4 text-[var(--rb-text-muted)]" strokeWidth={1.5} />
      </div>
      <span className="font-data text-3xl font-bold leading-none text-[var(--rb-text)]">{value}</span>
      {spark && spark.some((n) => n > 0) ? <Sparkline data={spark} /> : <div className="h-8" aria-hidden="true" />}
      {hint ? (
        <span className="text-[11px] text-[var(--rb-text-muted)]">{hint}</span>
      ) : (
        <DeltaBadge deltaPct={delta ?? null} prevLabel={prevLabel ?? 'previous period'} />
      )}
    </div>
  );
}

function DeltaBadge({ deltaPct, prevLabel }: { deltaPct: number | null; prevLabel: string }) {
  if (deltaPct === null) {
    return <span className="text-[11px] text-[var(--rb-text-muted)]">No prior data to compare</span>;
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
      vs {prevLabel}
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

function TrendRow({
  label,
  trend,
  series,
  total,
}: {
  label: string;
  trend: { granularity: 'day' | 'month'; labels: string[] };
  series: number[];
  total: number;
}) {
  const hasData = series.some((n) => n > 0);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-[var(--rb-text-secondary)]">{label}</span>
        <span className="font-data text-xs font-semibold text-[var(--rb-text)]">{total}</span>
      </div>
      {!hasData ? (
        <div className="flex h-10 items-center text-[11px] text-[var(--rb-text-muted)]">No activity yet</div>
      ) : trend.granularity === 'month' ? (
        <MonthlyBars values={series} labels={trend.labels} />
      ) : (
        <Sparkline data={series} />
      )}
    </div>
  );
}

function MonthlyBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1" style={{ height: 56 }}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${labels[i]}: ${v}`}>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-[3px] bg-[var(--rb-brand)]"
              style={{ height: `${v === 0 ? 2 : Math.max(6, (v / max) * 44)}px`, opacity: v === 0 ? 0.25 : 1 }}
            />
          </div>
          <span className="text-[9px] leading-none text-[var(--rb-text-muted)]">{labels[i]?.[0]}</span>
        </div>
      ))}
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
                {conv !== null && <span className="text-[11px] text-[var(--rb-text-muted)]">{conv}% of prior</span>}
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
        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--rb-text-muted)]">e.g. &ldquo;{topic.sample}&rdquo;</p>
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
      <span className="shrink-0 text-xs text-[var(--rb-text-muted)]">{event.ago}</span>
    </li>
  );
}
