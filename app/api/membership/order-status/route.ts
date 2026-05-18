import { NextResponse } from 'next/server';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureMembershipSchema } from '@/lib/ensureMembershipSchema';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/membership/order-status?orderId=...
 *
 * Polled by the transfer screen while Blue moves the membership NFT.
 * Returns the order status, and the transaction hash once transferred.
 */
export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const orderId = new URL(request.url).searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId.' }, { status: 400 });
  }

  const wallet = await getWalletAddressFromRequest();
  if (!wallet) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  await ensureMembershipSchema();

  const rows = await sqlQuery<Array<{
    status: string;
    tx_hash: string | null;
    error: string | null;
    buyer_wallet: string;
  }>>(
    `SELECT status, tx_hash, error, buyer_wallet
       FROM membership_orders WHERE id=:id LIMIT 1`,
    { id: orderId },
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const order = rows[0];
  if (order.buyer_wallet.toLowerCase() !== wallet.toLowerCase()) {
    return NextResponse.json({ error: 'Not your order.' }, { status: 403 });
  }

  return NextResponse.json({
    status: order.status,
    txHash: order.tx_hash,
    error: order.error,
  });
}
