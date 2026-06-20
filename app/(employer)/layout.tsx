import { redirect } from 'next/navigation';
import { getUserContext, AuthError } from '@/lib/auth/user-context';

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  try {
    await getUserContext('employer');
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.code === 'UNAUTHENTICATED') redirect('/sign-in');
      if (e.code === 'FORBIDDEN') redirect('/dashboard/profile');
      redirect('/onboarding');
    }
    throw e;
  }
  return <>{children}</>;
}
