import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { sqlQuery } from '@/lib/db';
import { ensureMembershipSchema } from '@/lib/ensureMembershipSchema';
import { transferVipMembership } from '@/lib/blue-membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 *
 * Stripe-driven fulfilment for VIP Membership purchases. On a successful
 * payment, Blue transfers one membership NFT to the buyer's wallet.
 *
 * Idempotency: a conditional UPDATE claims the order out of pending/paid
 * before the transfer runs, so duplicate webhook deliveries are no-ops.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[membership webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // A payment that never cleared — release the slot.
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.orderId;
    if (orderId) {
      await ensureMembershipSchema();
      await sqlQuery(
        `UPDATE membership_orders
            SET status='failed', error=:err, updated_at=CURRENT_TIMESTAMP
          WHERE id=:id AND status IN ('pending', 'paid')`,
        { id: orderId, err: pi.last_payment_error?.message ?? 'Payment failed' },
      );
    }
    return NextResponse.json({ received: true });
  }

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true });
  }

  const pi = event.data.object as Stripe.PaymentIntent;
  const orderId = pi.metadata?.orderId;
  const buyerWallet = pi.metadata?.buyerWallet;
  const tokenId = pi.metadata?.tokenId || '1';

  if (!orderId || !buyerWallet) {
    console.error('[membership webhook] payment intent missing metadata:', pi.id);
    return NextResponse.json({ received: true });
  }

  await ensureMembershipSchema();

  // Claim the order. This conditional update is the idempotency gate: only one
  // delivery can move the order out of pending/paid into transferring.
  const claimed = await sqlQuery<Array<{ id: string }>>(
    `UPDATE membership_orders
        SET status='transferring', updated_at=CURRENT_TIMESTAMP
      WHERE id=:id AND status IN ('pending', 'paid')
      RETURNING id`,
    { id: orderId },
  );
  if (claimed.length === 0) {
    // Already transferred, in flight, or failed — nothing more to do.
    return NextResponse.json({ received: true });
  }

  try {
    const { txHash } = await transferVipMembership(buyerWallet, tokenId, 1);
    await sqlQuery(
      `UPDATE membership_orders
          SET status='transferred', tx_hash=:tx, error=NULL,
              transferred_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE id=:id`,
      { id: orderId, tx: txHash },
    );
    return NextResponse.json({ received: true, txHash });
  } catch (err) {
    // Payment cleared but the on-chain transfer failed. Drop back to 'paid' so
    // a Stripe webhook retry re-attempts, and return 500 to trigger that retry.
    const message = err instanceof Error ? err.message : 'Transfer failed';
    await sqlQuery(
      `UPDATE membership_orders
          SET status='paid', error=:err, updated_at=CURRENT_TIMESTAMP
        WHERE id=:id`,
      { id: orderId, err: message },
    );
    console.error('[membership webhook] NFT transfer failed:', message);
    return NextResponse.json({ error: 'Transfer failed, will retry.' }, { status: 500 });
  }
}
