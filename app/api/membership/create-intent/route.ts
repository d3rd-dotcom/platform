import { NextResponse } from 'next/server';
import { getStripe, MEMBERSHIP_PRICE_CENTS } from '@/lib/stripe';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import {
  ensureMembershipSchema,
  countCommittedMemberships,
  expireStaleMembershipOrders,
} from '@/lib/ensureMembershipSchema';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getBlueWalletAddress } from '@/lib/blue-membership';
import {
  VIP_MEMBERSHIP_CARD_TOKEN_ID,
  getVipMembershipCardBalance,
} from '@/lib/soul-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** How long a pending order holds its inventory slot before lapsing. */
const RESERVATION_MINUTES = 30;

/**
 * POST /api/membership/create-intent
 *
 * Reserves a membership slot from Blue's inventory and opens a Stripe
 * PaymentIntent for $89.90. Returns { clientSecret, orderId } for the
 * on-page Payment Element.
 */
export async function POST() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 });
  }

  const buyerWallet = await getWalletAddressFromRequest();
  if (!buyerWallet) {
    return NextResponse.json({ error: 'Sign in to buy a membership.' }, { status: 401 });
  }

  await ensureMembershipSchema();
  // Clear out abandoned checkouts so they neither pile up nor hold inventory.
  await expireStaleMembershipOrders();

  const tokenId = VIP_MEMBERSHIP_CARD_TOKEN_ID.toString();

  const stripe = getStripe();

  // Reuse any open checkout for this wallet instead of stacking reservations
  // when the buyer switches between card and crypto.
  const existing = await sqlQuery<Array<{ id: string; stripe_payment_intent_id: string | null }>>(
    `SELECT id, stripe_payment_intent_id FROM membership_orders
      WHERE LOWER(buyer_wallet) = LOWER(:wallet)
        AND status = 'pending' AND reserved_until > CURRENT_TIMESTAMP
        AND payment_tx_hash IS NULL
      ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
    { wallet: buyerWallet },
  );

  let orderId: string | null = existing[0]?.id ?? null;
  let createdOrder = false;
  if (existing.length > 0 && existing[0].stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(existing[0].stripe_payment_intent_id);
      const reusable = ['requires_payment_method', 'requires_confirmation', 'requires_action'];
      if (reusable.includes(pi.status) && pi.client_secret) {
        await sqlQuery(
          `UPDATE membership_orders
              SET payment_method = 'stripe',
                  reserved_until = CURRENT_TIMESTAMP + (:minutes || ' minutes')::interval,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = :id`,
          { id: existing[0].id, minutes: String(RESERVATION_MINUTES) },
        );
        return NextResponse.json({ clientSecret: pi.client_secret, orderId: existing[0].id });
      }
      if (['processing', 'succeeded', 'requires_capture'].includes(pi.status)) {
        return NextResponse.json(
          { error: 'Your card payment is already processing. Check the transfer screen in a moment.' },
          { status: 409 },
        );
      }
    } catch (err) {
      console.error('[membership] failed to reuse payment intent:', err);
    }
  }

  const user = await getCurrentUserFromRequestCookie();

  if (!orderId) {
    // Inventory check — Blue's on-chain balance minus everything already committed.
    let blueAddress: string;
    try {
      blueAddress = getBlueWalletAddress();
    } catch (err) {
      console.error('[membership] Blue wallet not configured:', err);
      return NextResponse.json(
        { error: 'Membership wallet is not configured.' },
        { status: 503 },
      );
    }

    let inventory: bigint;
    try {
      inventory = await getVipMembershipCardBalance(blueAddress, tokenId);
    } catch (err) {
      console.error('[membership] inventory check failed:', err);
      return NextResponse.json(
        { error: 'Could not check membership availability. Try again.' },
        { status: 503 },
      );
    }

    const committed = await countCommittedMemberships(tokenId);
    if (committed >= Number(inventory)) {
      return NextResponse.json({ error: 'Memberships are sold out.' }, { status: 409 });
    }

    // Reserve the slot first, then attach the payment intent.
    const inserted = await sqlQuery<Array<{ id: string }>>(
      `INSERT INTO membership_orders
         (user_id, buyer_wallet, token_id, amount_cents, status, payment_method, reserved_until)
       VALUES (:userId, :wallet, :tokenId, :amount, 'pending', 'stripe',
               CURRENT_TIMESTAMP + (:minutes || ' minutes')::interval)
       RETURNING id`,
      {
        userId: user?.id ?? null,
        wallet: buyerWallet,
        tokenId,
        amount: MEMBERSHIP_PRICE_CENTS,
        minutes: String(RESERVATION_MINUTES),
      },
    );
    orderId = inserted[0].id;
    createdOrder = true;
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: MEMBERSHIP_PRICE_CENTS,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: 'MWA VIP Membership',
      metadata: { orderId, buyerWallet, tokenId, userId: user?.id ?? '' },
    }, { idempotencyKey: `membership-card-${orderId}` });
    if (!intent.client_secret) {
      throw new Error('Stripe did not return a client secret.');
    }
    await sqlQuery(
      `UPDATE membership_orders
          SET stripe_payment_intent_id = :pi,
              payment_method = 'stripe',
              user_id = COALESCE(user_id, :userId),
              reserved_until = CURRENT_TIMESTAMP + (:minutes || ' minutes')::interval,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
      {
        pi: intent.id,
        id: orderId,
        userId: user?.id ?? null,
        minutes: String(RESERVATION_MINUTES),
      },
    );
    return NextResponse.json({ clientSecret: intent.client_secret, orderId });
  } catch (err) {
    if (createdOrder) {
      await sqlQuery(
        `UPDATE membership_orders SET status='expired', updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
        { id: orderId },
      );
    }
    console.error('[membership] payment intent creation failed:', err);
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 });
  }
}
