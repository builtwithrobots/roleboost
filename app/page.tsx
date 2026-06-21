import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/supabase/admin';
import LandingPage from '@/components/landing/LandingPage';

export default async function HomePage() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  try {
    const { data: user } = await (adminClient.from('users') as any)
      .select('role')
      .eq('clerk_user_id', userId)
      .single();

    if (!user) redirect('/onboarding');
    if (user.role === 'candidate') redirect('/dashboard/profile');
    if (user.role === 'employer') redirect('/dashboard/candidates');
    if (user.role === 'admin') redirect('/admin');

    redirect('/onboarding');
  } catch {
    redirect('/onboarding');
  }
}
