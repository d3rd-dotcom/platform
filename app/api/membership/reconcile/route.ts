import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { reconcileMembershipOrders } from '@/lib/membership-fulfillment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/membership/reconcile
 *
 * The membership delivery worker. Run on a cron (see vercel.json): it expires
 * abandoned checkouts, verifies recorded crypto payments on-chain, and delivers
 * any order that is paid but not yet transferred — including orders whose buyer
 * closed the tab before delivery finished.
 *
 * If CRON_SECRET is set, requests must present it as a bearer token; Vercel Cron
 * supplies this header automatically.
 */
async function runReconcile(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  try {
    const summary = await reconcileMembershipOrders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('[membership] reconcile sweep failed:', err);
    return NextResponse.json({ error: 'Reconcile failed.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runReconcile(request);
}

// Allow POST too, so the sweep can be triggered manually without a cron.
export async function POST(request: Request) {
  return runReconcile(request);
}
