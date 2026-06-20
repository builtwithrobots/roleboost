import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('paddle-signature');
  if (!signature) {
    return NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  }

  const payload = await req.text();
  const body = JSON.parse(payload) as { event_type: string };

  switch (body.event_type) {
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.cancelled':
    case 'subscription.payment.failed':
      break;
  }

  return NextResponse.json({ received: true });
}
