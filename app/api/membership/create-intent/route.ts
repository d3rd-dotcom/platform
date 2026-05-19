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

  // Reuse an open checkout for this wallet instead of stacking reservations.
  const existing = await sqlQuery<Array<{ id: string; stripe_payment_intent_id: string | null }>>(
    `SELECT id, stripe_payment_intent_id FROM membership_orders
      WHERE LOWER(buyer_wallet) = LOWER(:wallet)
        AND status = 'pending' AND reserved_until > CURRENT_TIMESTAMP
        AND stripe_payment_intent_id IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`,
    { wallet: buyerWallet },
  );
  if (existing.length > 0 && existing[0].stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(existing[0].stripe_payment_intent_id);
      const reusable = ['requires_payment_method', 'requires_confirmation', 'requires_action'];
      if (reusable.includes(pi.status) && pi.client_secret) {
        return NextResponse.json({ clientSecret: pi.client_secret, orderId: existing[0].id });
      }
    } catch (err) {
      console.error('[membership] failed to reuse payment intent:', err);
    }
  }

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
  const inventory = await getVipMembershipCardBalance(blueAddress, tokenId);
  const committed = await countCommittedMemberships(tokenId);
  if (committed >= Number(inventory)) {
    return NextResponse.json({ error: 'Memberships are sold out.' }, { status: 409 });
  }

  const user = await getCurrentUserFromRequestCookie();

  // Reserve the slot first, then attach the payment intent.
  const inserted = await sqlQuery<Array<{ id: string }>>(
    `INSERT INTO membership_orders (user_id, buyer_wallet, token_id, amount_cents, status, reserved_until)
     VALUES (:userId, :wallet, :tokenId, :amount, 'pending',
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
  const orderId = inserted[0].id;

  try {
    const intent = await stripe.paymentIntents.create({
      amount: MEMBERSHIP_PRICE_CENTS,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: 'MWA VIP Membership',
      metadata: { orderId, buyerWallet, tokenId, userId: user?.id ?? '' },
    });
    await sqlQuery(
      `UPDATE membership_orders
          SET stripe_payment_intent_id = :pi, updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
      { pi: intent.id, id: orderId },
    );
    return NextResponse.json({ clientSecret: intent.client_secret, orderId });
  } catch (err) {
    await sqlQuery(
      `UPDATE membership_orders SET status='expired', updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
      { id: orderId },
    );
    console.error('[membership] payment intent creation failed:', err);
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 });
  }
}
