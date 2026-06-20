import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  try {
    const { userId } = await auth();
    if (!userId) redirect('/sign-in');
    redirect('/onboarding');
  } catch {
    redirect('/sign-in');
  }
}
