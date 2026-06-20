import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { adminClient } from '@/lib/supabase/admin';

// Clerk sends webhook events when users are created or deleted.
// We use the admin Supabase client (RLS bypass) because there is no Clerk
// session at webhook time — the request comes from Clerk's servers, not a browser.
type ClerkEmailAddress = { email_address: string; id: string };
type ClerkUserCreatedEvent = {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: ClerkEmailAddress[];
    primary_email_address_id: string;
    public_metadata: Record<string, unknown>;
  };
};
type ClerkUserDeletedEvent = {
  type: 'user.deleted';
  data: { id: string; deleted: boolean };
};
type ClerkWebhookEvent = ClerkUserCreatedEvent | ClerkUserDeletedEvent;

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  }

  const payload = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid signature' } }, { status: 401 });
  }

  switch (event.type) {
    case 'user.created': {
      const { id, email_addresses, primary_email_address_id, public_metadata } = event.data;
      const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address
        ?? email_addresses[0]?.email_address;

      if (!primaryEmail) {
        console.error('Clerk user.created: no email address found for', id);
        return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400 });
      }

      // Role may be set by onboarding via a Clerk public metadata update.
      // Default to 'candidate' for now; the onboarding flow will update it.
      const role = (public_metadata?.role as string) ?? 'candidate';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (adminClient.from('users') as any).upsert(
        { clerk_user_id: id, email: primaryEmail, role, subscription_status: 'free' },
        { onConflict: 'clerk_user_id' }
      );

      if (error) {
        console.error('Clerk user.created: failed to upsert user', id, error);
        return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 });
      }
      break;
    }

    case 'user.deleted': {
      const { id } = event.data;

      // CASCADE deletes handle all child rows (profiles, assets, sessions, etc.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (adminClient.from('users') as any)
        .delete()
        .eq('clerk_user_id', id);

      if (error) {
        console.error('Clerk user.deleted: failed to delete user', id, error);
        return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
