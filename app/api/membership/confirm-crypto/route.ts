import { NextResponse } from 'next/server';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureMembershipSchema } from '@/lib/ensureMembershipSchema';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { reconcileMembershipOrder } from '@/lib/membership-fulfillment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/membership/confirm-crypto
 * Body: { orderId, currency: 'eth' | 'usdc', txHash }
 *
 * The buyer's wallet has broadcast the payment. This route's job is to durably
 * record the transaction hash on the order — the hand-off point after which the
 * server owns delivery. It then runs one reconcile pass so the happy path ships
 * the NFT within this request; if the payment is not yet confirmed, the order
 * carries its payment_tx_hash and the reconcile cron / status poll finishes the
 * job. Delivery no longer depends on the buyer's browser staying open.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const buyerWallet = await getWalletAddressFromRequest();
  if (!buyerWallet) {
    return NextResponse.json({ error: 'Sign in to confirm your payment.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const orderId: string | undefined = body?.orderId;
  const currency: string | undefined = body?.currency;
  const txHash: string | undefined = body?.txHash;

  if (!orderId || (currency !== 'eth' && currency !== 'usdc')) {
    return NextResponse.json({ error: 'Missing order or currency.' }, { status: 400 });
  }
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: 'A valid payment transaction hash is required.' }, { status: 400 });
  }

  await ensureMembershipSchema();

  // A payment can only ever be applied to one order.
  const reused = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM membership_orders
      WHERE payment_tx_hash = :tx AND id <> :id LIMIT 1`,
    { tx: txHash, id: orderId },
  );
  if (reused.length > 0) {
    return NextResponse.json(
      { error: 'That payment has already been used for another order.' },
      { status: 409 },
    );
  }

  const rows = await sqlQuery<Array<{
    id: string;
    status: string;
    buyer_wallet: string;
    tx_hash: string | null;
    payment_tx_hash: string | null;
  }>>(
    `SELECT id, status, buyer_wallet, tx_hash, payment_tx_hash
       FROM membership_orders WHERE id = :id LIMIT 1`,
    { id: orderId },
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const order = rows[0];
  if (order.buyer_wallet.toLowerCase() !== buyerWallet.toLowerCase()) {
    return NextResponse.json({ error: 'This order belongs to another wallet.' }, { status: 403 });
  }
  if (order.status === 'transferred') {
    return NextResponse.json({ status: 'transferred', txHash: order.tx_hash });
  }
  if (order.payment_tx_hash && order.payment_tx_hash.toLowerCase() !== txHash.toLowerCase()) {
    return NextResponse.json(
      { error: 'A different payment is already recorded for this order.' },
      { status: 409 },
    );
  }

  // Durably record the payment. After this the order is the reconcile worker's
  // responsibility — closing the tab no longer loses the delivery.
  await sqlQuery(
    `UPDATE membership_orders
        SET payment_method = 'crypto', payment_currency = :cur,
            payment_tx_hash = :tx, updated_at = CURRENT_TIMESTAMP
      WHERE id = :id AND status IN ('pending', 'paid', 'failed', 'expired')`,
    { id: orderId, cur: currency, tx: txHash },
  );

  // Try to finish the job now; whatever the outcome, the order is recorded and
  // the cron / status poll will carry it the rest of the way.
  const result = await reconcileMembershipOrder(orderId);

  return NextResponse.json({
    ok: true,
    status: result.status,
    txHash: result.txHash ?? null,
    error: result.error ?? null,
  });
}
