import { NextResponse } from 'next/server';
import { getStripe, MONTHLY_MEMBERSHIP_PRICE_CENTS } from '@/lib/stripe';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureMembershipSchema, walletHasActiveSubscription } from '@/lib/ensureMembershipSchema';
import { getWalletAddressFromRequest, getEmailAddressFromRequest } from '@/lib/wallet-auth';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 });
  }

  const buyerWallet = await getWalletAddressFromRequest();
  if (!buyerWallet) {
    return NextResponse.json({ error: 'Create an account to start membership.' }, { status: 401 });
  }

  await ensureMembershipSchema();
  if (await walletHasActiveSubscription(buyerWallet)) {
    return NextResponse.json({ error: 'This account already has an active membership.' }, { status: 409 });
  }

  const existing = await sqlQuery<Array<{ id: string; stripe_checkout_session_id: string | null }>>(
    `SELECT id, stripe_checkout_session_id FROM membership_subscriptions
      WHERE LOWER(buyer_wallet)=LOWER(:wallet) AND status='pending'
      ORDER BY created_at DESC LIMIT 1`,
    { wallet: buyerWallet },
  );
  if (existing[0]?.stripe_checkout_session_id) {
    try {
      const openSession = await getStripe().checkout.sessions.retrieve(existing[0].stripe_checkout_session_id);
      if (openSession.status === 'open' && openSession.url) {
        return NextResponse.json({ url: openSession.url });
      }
      await sqlQuery(
        `UPDATE membership_subscriptions SET status='incomplete_expired', updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
        { id: existing[0].id },
      );
    } catch (error) {
      console.error('[membership subscription] failed to reuse checkout session:', error);
    }
  }

  const [user, email] = await Promise.all([
    getCurrentUserFromRequestCookie(),
    getEmailAddressFromRequest(),
  ]);
  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  const inserted = await sqlQuery<Array<{ id: string }>>(
    `INSERT INTO membership_subscriptions (user_id, buyer_wallet, status)
     VALUES (:userId, :wallet, 'pending') RETURNING id`,
    { userId: user?.id ?? null, wallet: buyerWallet },
  );
  const recordId = inserted[0].id;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: MONTHLY_MEMBERSHIP_PRICE_CENTS,
          recurring: { interval: 'month' },
          product_data: { name: 'Mental Wealth Academy Membership' },
        },
      }],
      metadata: { membershipSubscriptionId: recordId, buyerWallet, userId: user?.id ?? '' },
      subscription_data: {
        metadata: { membershipSubscriptionId: recordId, buyerWallet, userId: user?.id ?? '' },
      },
      success_url: `${origin}/?membership=monthly-success#membership`,
      cancel_url: `${origin}/#membership`,
    }, { idempotencyKey: `monthly-membership-${recordId}` });

    await sqlQuery(
      `UPDATE membership_subscriptions
          SET stripe_checkout_session_id=:sessionId, updated_at=CURRENT_TIMESTAMP
        WHERE id=:id`,
      { id: recordId, sessionId: session.id },
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    await sqlQuery(
      `UPDATE membership_subscriptions SET status='incomplete_expired', updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
      { id: recordId },
    );
    console.error('[membership subscription] checkout session creation failed:', error);
    return NextResponse.json({ error: 'Could not start subscription checkout.' }, { status: 500 });
  }
}
