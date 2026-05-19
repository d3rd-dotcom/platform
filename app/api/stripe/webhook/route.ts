import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { sqlQuery } from '@/lib/db';
import { ensureMembershipSchema } from '@/lib/ensureMembershipSchema';
import { deliverMembershipOrder } from '@/lib/membership-fulfillment';

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

  if (!orderId || !buyerWallet) {
    console.error('[membership webhook] payment intent missing metadata:', pi.id);
    return NextResponse.json({ received: true });
  }

  await ensureMembershipSchema();

  // Record that payment cleared. The conditional update keeps this idempotent
  // and lets a payment that lands after the reservation lapsed still deliver.
  await sqlQuery(
    `UPDATE membership_orders
        SET status='paid', updated_at=CURRENT_TIMESTAMP
      WHERE id=:id AND status IN ('pending', 'paid', 'expired')`,
    { id: orderId },
  );

  // Hand off to the shared delivery path. If it fails, the order is left as
  // `failed` and the reconcile cron retries — no need to fail the webhook.
  const result = await deliverMembershipOrder(orderId);
  return NextResponse.json({ received: true, status: result.status, txHash: result.txHash });
}
