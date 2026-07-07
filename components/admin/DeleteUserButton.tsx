'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteUser } from '@/lib/auth/admin-actions';

// Destructive delete with an explicit confirm. Full delete: removes the Clerk
// account and cascade-deletes all Supabase data.
export default function DeleteUserButton({
  clerkUserId,
  email,
}: {
  clerkUserId: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    const confirmed = window.confirm(
      `Permanently delete ${email}?\n\nThis removes their account and ALL their data (profile, assets, chats, transcripts). This cannot be undone.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const res = await deleteUser(clerkUserId);
      if (res && !res.ok) {
        window.alert(res.error?.message ?? 'Delete failed.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-md px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
