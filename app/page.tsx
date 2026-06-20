import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getRequestClient } from '@/lib/supabase/server';

export default async function HomePage() {
  try {
    const { userId } = await auth();
    if (!userId) redirect('/sign-in');

    // Check if this user already has a role — returning users skip onboarding
    const supabase = await getRequestClient();
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('clerk_user_id', userId)
      .single();

    if (!user) redirect('/onboarding');
    if (user.role === 'candidate') redirect('/dashboard/profile');
    if (user.role === 'employer') redirect('/dashboard/candidates');

    redirect('/onboarding');
  } catch {
    redirect('/sign-in');
  }
}
