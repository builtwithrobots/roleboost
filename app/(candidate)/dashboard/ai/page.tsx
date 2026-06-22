import DashboardPage from '@/components/layout/DashboardPage';

export default function AIStudioPage() {
  return (
    <DashboardPage>
      <div className="p-8">
        <h1 className="font-display text-2xl font-bold text-[--rb-text-primary]">AI Studio</h1>
        <p className="mt-2 text-[--rb-text-muted]">Train and test your personal career AI.</p>
      </div>
    </DashboardPage>
  );
}
