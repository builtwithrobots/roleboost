// Route-level loading state for every candidate dashboard page: a lightweight
// skeleton instead of a blank screen while the Server Component fetches.
export default function DashboardLoading() {
  return (
    <div className="min-h-full" aria-busy="true" aria-label="Loading page">
      <div className="border-b border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <div className="h-6 w-40 animate-pulse rounded bg-[var(--rb-bg-surface-raised)]" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[var(--rb-bg-surface-raised)]" />
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="h-32 animate-pulse rounded-[var(--radius-xl)] bg-[var(--rb-bg-surface-raised)]" />
        <div className="h-64 animate-pulse rounded-[var(--radius-xl)] bg-[var(--rb-bg-surface-raised)]" />
        <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-[var(--rb-bg-surface-raised)]" />
      </div>
    </div>
  );
}
