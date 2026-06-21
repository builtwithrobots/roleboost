'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Briefcase, Plus, X, Archive, ChevronRight, Loader2 } from 'lucide-react';
import { createJobPosting, archiveJobPosting } from '@/app/(employer)/dashboard/jobs/actions';

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  candidateCount: number;
}

interface Props {
  jobs: Job[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function NewJobDialog({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    department: '',
    location: '',
    description: '',
    is_active: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createJobPosting(form);
      if (result.ok) {
        onClose();
      } else {
        setError('Failed to create job. Please try again.');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[--z-modal] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New job posting"
    >
      <div
        className="absolute inset-0 bg-[--rb-overlay]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg rounded-[--radius-2xl] bg-[--rb-bg-modal] shadow-[--shadow-modal] border border-[--rb-border]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--rb-border]">
          <h2 className="text-base font-semibold text-[--rb-text]">New Job Posting</h2>
          <button
            onClick={onClose}
            className="rounded-[--radius-sm] p-1 text-[--rb-text-muted] hover:bg-[--rb-bg-surface-raised] transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-[--rb-text-secondary] mb-1.5">
              Job title <span className="text-[--color-error]">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Senior Product Manager"
              required
              className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[--rb-text-secondary] mb-1.5">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                placeholder="Product"
                className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[--rb-text-secondary] mb-1.5">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Remote"
                className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[--rb-text-secondary] mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Role summary, requirements, and what you're looking for…"
              rows={4}
              className="w-full rounded-[--radius-md] border border-[--rb-border] bg-[--rb-bg-input] px-3 py-2 text-sm text-[--rb-text] placeholder:text-[--rb-text-muted] focus:outline-none focus:border-[--rb-border-focus] resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-[--color-error]">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[--radius-md] text-sm font-medium text-[--rb-text-secondary] border border-[--rb-border] hover:bg-[--rb-bg-surface-raised] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !form.title.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-[--radius-md] bg-[--rb-brand] text-white text-sm font-semibold hover:bg-[--rb-brand-hover] disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Create job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function JobsTable({ jobs: initialJobs }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [showNewJob, setShowNewJob] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleArchive = (jobId: string) => {
    setArchivingId(jobId);
    startTransition(async () => {
      const result = await archiveJobPosting(jobId);
      if (result.ok) {
        setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, isActive: false } : j));
      }
      setArchivingId(null);
    });
  };

  return (
    <div className="min-h-full bg-[--rb-bg-page]">
      {/* Header */}
      <div className="border-b border-[--rb-border] bg-[--rb-bg-surface] px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[--rb-text]">Jobs</h1>
          <p className="mt-1 text-sm text-[--rb-text-muted]">
            Manage your open job postings.{' '}
            <span className="font-data text-[--rb-text-secondary]">{jobs.filter(j => j.isActive).length}</span> active.
          </p>
        </div>
        <button
          onClick={() => setShowNewJob(true)}
          className="flex items-center gap-1.5 rounded-[--radius-md] bg-[--rb-brand] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_8px_rgb(79_70_229_/_0.25)] hover:bg-[--rb-brand-hover] active:scale-[0.98] transition-all duration-[--duration-fast]"
        >
          <Plus className="size-4" />
          New job
        </button>
      </div>

      {/* Table */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-16 rounded-full bg-[--rb-brand-subtle] flex items-center justify-center mb-4">
              <Briefcase className="size-8 text-[--rb-brand]" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold text-[--rb-text] mb-2">No job postings yet</h2>
            <p className="text-sm text-[--rb-text-muted] max-w-sm mb-6">
              Create job postings to organize your hiring pipeline by role.
            </p>
            <button
              onClick={() => setShowNewJob(true)}
              className="flex items-center gap-2 rounded-[--radius-md] bg-[--rb-brand] px-4 py-2 text-sm font-semibold text-white hover:bg-[--rb-brand-hover] transition-colors"
            >
              <Plus className="size-4" />
              Create your first job
            </button>
          </div>
        ) : (
          <div className="rb-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--rb-border] bg-[--rb-bg-surface-raised]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[--rb-text-secondary]">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[--rb-text-secondary] hidden sm:table-cell">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[--rb-text-secondary] hidden md:table-cell">Location</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[--rb-text-secondary]">Candidates</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[--rb-text-secondary] hidden lg:table-cell">Created</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[--rb-text-secondary]">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[--rb-border]">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[--rb-bg-surface-raised] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[--rb-text]">{job.title}</div>
                    </td>
                    <td className="px-4 py-3 text-[--rb-text-secondary] hidden sm:table-cell">
                      {job.department ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[--rb-text-secondary] hidden md:table-cell">
                      {job.location ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/dashboard/board?job=${job.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[--rb-brand] hover:underline"
                      >
                        {job.candidateCount}
                        <ChevronRight className="size-3" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[--rb-text-muted] text-xs font-data hidden lg:table-cell">
                      {formatDate(job.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          job.isActive
                            ? 'bg-[--color-success-bg] text-[--color-success]'
                            : 'bg-[--rb-bg-surface-raised] text-[--rb-text-muted]'
                        }`}
                      >
                        {job.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {job.isActive && (
                        <button
                          onClick={() => handleArchive(job.id)}
                          disabled={archivingId === job.id}
                          className="flex items-center gap-1 text-xs text-[--rb-text-muted] hover:text-[--color-error] transition-colors disabled:opacity-50"
                          title="Archive job"
                        >
                          {archivingId === job.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Archive className="size-3.5" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewJob && <NewJobDialog onClose={() => setShowNewJob(false)} />}
    </div>
  );
}
