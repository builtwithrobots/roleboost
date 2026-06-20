import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  try {
    await getUserContext('candidate');
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === 'UNAUTHENTICATED') redirect('/sign-in');
      if (e.code === 'FORBIDDEN') redirect('/dashboard/candidates');
      redirect('/onboarding');
    }
    throw e;
  }
  return <>{children}</>;
}
