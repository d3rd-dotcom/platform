import { BigNumber } from 'ethers';
import { sqlQuery } from './db';
import { ensureMembershipSchema, expireStaleMembershipOrders } from './ensureMembershipSchema';
import { getBlueWalletAddress, transferVipMembership } from './blue-membership';
import { verifyPayment } from './crypto-payment';

/**
 * Backend-owned fulfilment for VIP Membership orders.
 *
 * The browser's only job is to trigger the payment and hand the transaction
 * hash to the server. From that point the lifecycle is the server's:
 *
 *   pending  -> payment recorded (payment_tx_hash set)
 *   pending  -> paid          (payment verified on-chain)
 *   paid     -> transferring  (claimed for delivery)
 *   transferring -> transferred (NFT sent) | failed (will retry)
 *
 * `reconcileMembershipOrders` is the worker that advances every non-terminal
 * order. It runs on a cron and is also called opportunistically by the
 * checkout routes, so delivery never depends on the buyer's tab staying open.
 */

/** ETH price drifts between quote and payment — accept 98% of the quote. */
const ETH_TOLERANCE_BPS = 9800;
/** Hard cap on delivery attempts before an order is left as failed. */
const MAX_DELIVERY_ATTEMPTS = 5;
/** A crypto payment that never verifies within this window is given up on. */
const VERIFY_GIVE_UP_HOURS = 3;

export interface FulfilmentResult {
  status: string;
  txHash?: string | null;
  error?: string | null;
}

interface OrderRow {
  id: string;
  status: string;
  buyer_wallet: string;
  token_id: string;
  tx_hash: string | null;
  error: string | null;
  payment_tx_hash: string | null;
  payment_currency: string | null;
  eth_amount_wei: string | null;
  usdc_amount: string | null;
  delivery_attempts: number;
  created_at: string;
}

async function readOrder(orderId: string): Promise<OrderRow | null> {
  const rows = await sqlQuery<OrderRow[]>(
    `SELECT id, status, buyer_wallet, token_id, tx_hash, error,
            payment_tx_hash, payment_currency, eth_amount_wei, usdc_amount,
            delivery_attempts, created_at
       FROM membership_orders WHERE id = :id LIMIT 1`,
    { id: orderId },
  );
  return rows[0] ?? null;
}

/**
 * Claims an order for delivery and sends the NFT. The conditional UPDATE is the
 * idempotency gate: only one caller can move an order into `transferring`, so
 * concurrent webhook / cron / poll calls cannot double-send. A delivery left
 * stuck in `transferring` for over 10 minutes (a crashed process) is reclaimed.
 */
export async function deliverMembershipOrder(orderId: string): Promise<FulfilmentResult> {
  const claimed = await sqlQuery<Array<{ id: string; buyer_wallet: string; token_id: string }>>(
    `UPDATE membership_orders
        SET status = 'transferring',
            delivery_attempts = delivery_attempts + 1,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
        AND delivery_attempts < :max
        AND (
          status IN ('pending', 'paid', 'failed', 'expired')
          OR (status = 'transferring'
              AND updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
        )
      RETURNING id, buyer_wallet, token_id`,
    { id: orderId, max: MAX_DELIVERY_ATTEMPTS },
  );

  if (claimed.length === 0) {
    // Already terminal, already in flight, or out of attempts — report current.
    const order = await readOrder(orderId);
    if (!order) return { status: 'not_found' };
    return { status: order.status, txHash: order.tx_hash, error: order.error };
  }

  const order = claimed[0];
  try {
    const { txHash } = await transferVipMembership(order.buyer_wallet, order.token_id, 1);
    await sqlQuery(
      `UPDATE membership_orders
          SET status = 'transferred', tx_hash = :tx, error = NULL,
              transferred_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
      { id: orderId, tx: txHash },
    );
    return { status: 'transferred', txHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    // Drop back to `failed`; the reconcile sweep retries until the attempt cap.
    await sqlQuery(
      `UPDATE membership_orders
          SET status = 'failed', error = :err, updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
      { id: orderId, err: `Payment received. NFT transfer failed: ${message}` },
    );
    console.error('[membership] NFT delivery failed for', orderId, '-', message);
    return { status: 'failed', error: message };
  }
}

/**
 * Advances a single order toward delivery. Verifies a recorded crypto payment
 * on-chain when needed, then delivers. Safe to call repeatedly.
 */
export async function reconcileMembershipOrder(orderId: string): Promise<FulfilmentResult> {
  const order = await readOrder(orderId);
  if (!order) return { status: 'not_found' };

  // Terminal or actively in flight — nothing to do.
  if (order.status === 'transferred') {
    return { status: 'transferred', txHash: order.tx_hash };
  }
  if (order.status === 'transferring') {
    return { status: 'transferring' };
  }

  // A verified-but-undelivered order (or a delivery that previously failed)
  // just needs another delivery attempt.
  if (order.status === 'paid' || order.status === 'failed') {
    if (order.delivery_attempts >= MAX_DELIVERY_ATTEMPTS) {
      return { status: order.status, error: order.error };
    }
    return deliverMembershipOrder(orderId);
  }

  // A pending order with a recorded crypto payment: verify it on-chain.
  if ((order.status === 'pending' || order.status === 'expired') && order.payment_tx_hash) {
    const currency = order.payment_currency === 'usdc' ? 'usdc' : 'eth';

    let minAmount: BigNumber;
    if (currency === 'eth') {
      if (!order.eth_amount_wei) return { status: order.status, error: 'Order has no ETH price.' };
      minAmount = BigNumber.from(order.eth_amount_wei).mul(ETH_TOLERANCE_BPS).div(10000);
    } else {
      if (!order.usdc_amount) return { status: order.status, error: 'Order has no USDC price.' };
      minAmount = BigNumber.from(order.usdc_amount);
    }

    let blueAddress: string;
    try {
      blueAddress = getBlueWalletAddress();
    } catch {
      return { status: order.status, error: 'Membership wallet not configured.' };
    }

    let verification;
    try {
      verification = await verifyPayment({
        txHash: order.payment_tx_hash,
        currency,
        recipient: blueAddress,
        expectedSender: order.buyer_wallet,
        minAmount,
      });
    } catch {
      // RPC hiccup — leave the order untouched and let the next sweep retry.
      return { status: order.status, error: 'Verification temporarily unavailable.' };
    }

    if (!verification.ok) {
      // The payment may simply not be confirmed yet — keep retrying until the
      // give-up window, then mark it failed so it stops being swept.
      const ageMs = Date.now() - new Date(order.created_at).getTime();
      if (ageMs > VERIFY_GIVE_UP_HOURS * 3600_000) {
        await sqlQuery(
          `UPDATE membership_orders
              SET status = 'failed', error = :err, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id AND status IN ('pending', 'expired')`,
          { id: orderId, err: `Payment could not be verified: ${verification.reason}` },
        );
        return { status: 'failed', error: verification.reason };
      }
      return { status: 'pending', error: verification.reason };
    }

    // Payment confirmed — mark paid, then deliver.
    await sqlQuery(
      `UPDATE membership_orders
          SET status = 'paid', payment_method = 'crypto', error = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = :id AND status IN ('pending', 'expired')`,
      { id: orderId },
    );
    return deliverMembershipOrder(orderId);
  }

  // Pending with no payment yet — nothing to advance.
  return { status: order.status };
}

export interface ReconcileSummary {
  expired: number;
  checked: number;
  delivered: number;
  failed: number;
}

/**
 * Sweeps every non-terminal order: expires abandoned checkouts, verifies
 * recorded crypto payments, and (re)delivers anything that is paid but not yet
 * transferred. Intended to run on a cron and from the checkout routes.
 */
export async function reconcileMembershipOrders(): Promise<ReconcileSummary> {
  await ensureMembershipSchema();
  const expired = await expireStaleMembershipOrders();

  const rows = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM membership_orders
      WHERE status = 'paid'
         OR (status = 'failed' AND delivery_attempts < :max)
         OR (status IN ('pending', 'expired') AND payment_tx_hash IS NOT NULL)
         OR (status = 'transferring'
             AND updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
      ORDER BY created_at
      LIMIT 50`,
    { max: MAX_DELIVERY_ATTEMPTS },
  );

  let delivered = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await reconcileMembershipOrder(row.id);
    if (result.status === 'transferred') delivered += 1;
    if (result.status === 'failed') failed += 1;
  }

  return { expired, checked: rows.length, delivered, failed };
}
