import { NextResponse } from 'next/server';
import { BigNumber } from 'ethers';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureMembershipSchema } from '@/lib/ensureMembershipSchema';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { getBlueWalletAddress, transferVipMembership } from '@/lib/blue-membership';
import { verifyPayment } from '@/lib/crypto-payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ETH price can drift between the quote and payment — allow 2% slippage. */
const ETH_TOLERANCE_BPS = 9800; // 98% of the quoted wei

/**
 * POST /api/membership/confirm-crypto
 * Body: { orderId, currency: 'eth' | 'usdc', txHash }
 *
 * Verifies the buyer's payment landed in Blue's wallet, then has Blue
 * transfer the VIP Membership NFT. This is the crypto equivalent of the
 * Stripe webhook — it runs synchronously and persists the final order
 * status, which the transfer screen then polls via /order-status.
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
    token_id: string;
    eth_amount_wei: string | null;
    usdc_amount: string | null;
    tx_hash: string | null;
  }>>(
    `SELECT id, status, buyer_wallet, token_id, eth_amount_wei, usdc_amount, tx_hash
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

  // Already fulfilled — return the result so a repeated confirm is harmless.
  if (order.status === 'transferred') {
    return NextResponse.json({ status: 'transferred', txHash: order.tx_hash });
  }

  // Expected amount in base units for the chosen currency.
  let minAmount: BigNumber;
  if (currency === 'eth') {
    if (!order.eth_amount_wei) {
      return NextResponse.json({ error: 'This order has no ETH price. Restart checkout.' }, { status: 409 });
    }
    minAmount = BigNumber.from(order.eth_amount_wei).mul(ETH_TOLERANCE_BPS).div(10000);
  } else {
    if (!order.usdc_amount) {
      return NextResponse.json({ error: 'This order has no USDC price. Restart checkout.' }, { status: 409 });
    }
    minAmount = BigNumber.from(order.usdc_amount);
  }

  let blueAddress: string;
  try {
    blueAddress = getBlueWalletAddress();
  } catch (err) {
    console.error('[membership] Blue wallet not configured:', err);
    return NextResponse.json({ error: 'Membership wallet is not configured.' }, { status: 503 });
  }

  // Confirm the payment actually reached Blue's wallet on-chain.
  let verification;
  try {
    verification = await verifyPayment({
      txHash,
      currency,
      recipient: blueAddress,
      expectedSender: buyerWallet,
      minAmount,
    });
  } catch (err) {
    console.error('[membership] payment verification error:', err);
    return NextResponse.json(
      { error: 'Could not verify the payment on Base. Try again shortly.' },
      { status: 502 },
    );
  }
  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: 400 });
  }

  // Claim the order. The conditional update is the idempotency gate: a second
  // confirm cannot move it out of transferring/transferred.
  const claimed = await sqlQuery<Array<{ id: string }>>(
    `UPDATE membership_orders
        SET status = 'transferring', payment_method = 'crypto',
            payment_currency = :cur, payment_tx_hash = :tx,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = :id AND status IN ('pending', 'paid', 'failed')
      RETURNING id`,
    { id: orderId, cur: currency, tx: txHash },
  );
  if (claimed.length === 0) {
    // Another request is already fulfilling this order.
    return NextResponse.json({ status: order.status });
  }

  try {
    const { txHash: nftTx } = await transferVipMembership(order.buyer_wallet, order.token_id, 1);
    await sqlQuery(
      `UPDATE membership_orders
          SET status = 'transferred', tx_hash = :tx, error = NULL,
              transferred_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
      { id: orderId, tx: nftTx },
    );
    return NextResponse.json({ status: 'transferred', txHash: nftTx });
  } catch (err) {
    // Payment cleared but the NFT transfer failed. Keep payment_tx_hash on the
    // row so the delivery can be retried; surface a clear failure to the buyer.
    const message = err instanceof Error ? err.message : 'Transfer failed';
    await sqlQuery(
      `UPDATE membership_orders
          SET status = 'failed', error = :err, updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
      { id: orderId, err: `Payment received. NFT transfer failed: ${message}` },
    );
    console.error('[membership] crypto NFT transfer failed:', message);
    return NextResponse.json(
      {
        status: 'failed',
        error: 'Your payment went through, but sending the membership NFT failed. Our team has been notified.',
      },
      { status: 500 },
    );
  }
}
