import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { getRequestClient } from '@/lib/supabase/server';

// Simple endpoint to clear the admin preview cookie from a client component.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const supabase = await getRequestClient();
  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_user_id', userId)
    .single();

  if (!user?.is_admin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.delete('rb-admin-preview-role');

  return NextResponse.json({ ok: true });
}
