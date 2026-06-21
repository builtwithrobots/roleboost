'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { setUserRole } from './actions';

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (role: 'candidate' | 'employer') => {
    setError(null);
    startTransition(async () => {
      const result = await setUserRole(role);
      if (result.ok) {
        router.push(role === 'candidate' ? '/dashboard/profile' : '/dashboard/candidates');
      } else {
        setError('Something went wrong. Please try again.');
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-lg w-full p-8 text-center">
        <h1 className="text-3xl font-bold mb-8">How are you using RoleBoost?</h1>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleSelect('candidate')}
            disabled={isPending}
            className="p-8 border-2 border-gray-200 rounded-xl hover:border-blue-500 transition-colors disabled:opacity-50"
          >
            <span className="font-semibold">I am looking for my next role</span>
          </button>
          <button
            onClick={() => handleSelect('employer')}
            disabled={isPending}
            className="p-8 border-2 border-gray-200 rounded-xl hover:border-blue-500 transition-colors disabled:opacity-50"
          >
            <span className="font-semibold">I am hiring for my team</span>
          </button>
        </div>
        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
