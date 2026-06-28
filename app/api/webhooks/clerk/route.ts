import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { adminClient } from '@/lib/supabase/admin';

// Clerk sends webhook events when users are created, updated, or deleted.
// We use the admin Supabase client (RLS bypass) because there is no Clerk
// session at webhook time, the request comes from Clerk's servers, not a browser.
type ClerkEmailAddress = { email_address: string; id: string };
type ClerkUserCreatedEvent = {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: ClerkEmailAddress[];
    primary_email_address_id: string | null;
    public_metadata: Record<string, unknown>;
  };
};
type ClerkUserUpdatedEvent = {
  type: 'user.updated';
  data: {
    id: string;
    email_addresses: ClerkEmailAddress[];
    primary_email_address_id: string | null;
  };
};
type ClerkUserDeletedEvent = {
  type: 'user.deleted';
  data: { id: string; deleted: boolean };
};
type ClerkWebhookEvent = ClerkUserCreatedEvent | ClerkUserUpdatedEvent | ClerkUserDeletedEvent;

function extractEmail(email_addresses: ClerkEmailAddress[], primary_email_address_id: string | null): string {
  return (
    email_addresses.find((e) => e.id === primary_email_address_id)?.email_address
    ?? email_addresses[0]?.email_address
    ?? ''
  );
}

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
      const email = extractEmail(email_addresses, primary_email_address_id);
      // email may be empty for OAuth sign-ups, user.updated will fill it in.
      //
      // Do NOT default the role here. The webhook fires before the user reaches
      // onboarding, so we have no role yet, leave it NULL and let onboarding's
      // setUserRole() set it. A pre-set role only exists when an admin provisions
      // an account via Clerk public_metadata.
      const role = (public_metadata?.role as string) ?? null;

      // ignoreDuplicates: never overwrite an existing row. If onboarding already
      // ran (or this event is a duplicate), we must not clobber a chosen role or
      // reset subscription_status to 'free' for a paying user.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (adminClient.from('users') as any).upsert(
        { clerk_user_id: id, email, role, subscription_status: 'free' },
        { onConflict: 'clerk_user_id', ignoreDuplicates: true }
      );

      if (error) {
        console.error('Clerk user.created: failed to upsert user', id, error);
        return NextResponse.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 });
      }
      break;
    }

    case 'user.updated': {
      const { id, email_addresses, primary_email_address_id } = event.data;
      const email = extractEmail(email_addresses, primary_email_address_id);
      if (!email) break; // nothing to update

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (adminClient.from('users') as any)
        .update({ email })
        .eq('clerk_user_id', id);

      if (error) {
        console.error('Clerk user.updated: failed to update email for', id, error);
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
