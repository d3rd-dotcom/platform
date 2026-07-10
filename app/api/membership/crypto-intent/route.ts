import { NextResponse } from 'next/server';
import { MEMBERSHIP_PRICE_CENTS } from '@/lib/stripe';
import { isDbConfigured, sqlQueryWithClient, withTransaction } from '@/lib/db';
import {
  ensureMembershipSchema,
  expireStaleMembershipOrders,
} from '@/lib/ensureMembershipSchema';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getBlueWalletAddress } from '@/lib/blue-membership';
import {
  VIP_MEMBERSHIP_CARD_TOKEN_ID,
  getVipMembershipCardBalance,
} from '@/lib/vip-membership-card';
import { BASE_CHAIN_ID, USDC_ADDRESS, quoteCryptoPrice } from '@/lib/crypto-payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** How long a pending order holds its inventory slot before lapsing. */
const RESERVATION_MINUTES = 30;

/**
 * POST /api/membership/crypto-intent
 *
 * The Stripe-free checkout path: reserves a membership slot and returns the
 * address and amounts a buyer pays directly from their wallet. Blue releases
 * the NFT once the payment is confirmed via /api/membership/confirm-crypto.
 *
 * Returns { orderId, blueWallet, chainId, usdcAddress, quote }.
 */
export async function POST() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const buyerWallet = await getWalletAddressFromRequest();
  if (!buyerWallet) {
    return NextResponse.json({ error: 'Sign in to buy a membership.' }, { status: 401 });
  }

  await ensureMembershipSchema();
  // Clear out abandoned checkouts so they neither pile up nor hold inventory.
  await expireStaleMembershipOrders();

  const tokenId = VIP_MEMBERSHIP_CARD_TOKEN_ID.toString();

  // Blue's wallet — both the inventory holder and the crypto payee.
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

  let quote;
  try {
    quote = await quoteCryptoPrice(MEMBERSHIP_PRICE_CENTS);
  } catch (err) {
    console.error('[membership] crypto price quote failed:', err);
    return NextResponse.json(
      { error: 'Could not price the membership in crypto right now.' },
      { status: 503 },
    );
  }

  const user = await getCurrentUserFromRequestCookie();

  // Read chain inventory once, then serialize the reservation decision in the
  // database. Without the advisory lock, two requests can both observe the
  // last available NFT and create two reservations.
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

  const reservation = await withTransaction(async (client) => {
    await sqlQueryWithClient(
      client,
      `SELECT pg_advisory_xact_lock(hashtextextended(:tokenId, 0))`,
      { tokenId },
    );

    // Re-read inside the lock so concurrent requests for this wallet reuse the
    // reservation created by the first request.
    const existing = await sqlQueryWithClient<Array<{ id: string }>>(
      client,
      `SELECT id FROM membership_orders
        WHERE LOWER(buyer_wallet) = LOWER(:wallet)
          AND status = 'pending' AND reserved_until > CURRENT_TIMESTAMP
          AND payment_tx_hash IS NULL
        ORDER BY updated_at DESC, created_at DESC LIMIT 1`,
      { wallet: buyerWallet },
    );

    if (existing.length > 0) {
      await sqlQueryWithClient(
        client,
        `UPDATE membership_orders
            SET payment_method = 'crypto',
                eth_amount_wei = :eth, usdc_amount = :usdc,
                user_id = COALESCE(user_id, :userId),
                reserved_until = CURRENT_TIMESTAMP + (:minutes || ' minutes')::interval,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = :id`,
        {
          eth: quote.eth.amount,
          usdc: quote.usdc.amount,
          userId: user?.id ?? null,
          minutes: String(RESERVATION_MINUTES),
          id: existing[0].id,
        },
      );
      return { orderId: existing[0].id, soldOut: false };
    }

    const rows = await sqlQueryWithClient<Array<{ committed: string }>>(
      client,
      `SELECT (
          SELECT COUNT(*)::int
            FROM membership_orders
           WHERE token_id = :tokenId
             AND (
               status IN ('paid', 'transferring', 'transferred')
               OR (status = 'failed' AND delivery_attempts > 0)
               OR (status IN ('pending', 'expired') AND payment_tx_hash IS NOT NULL)
             )
        ) + (
          SELECT COUNT(*)::int
            FROM (
              SELECT DISTINCT LOWER(buyer_wallet)
                FROM membership_orders
               WHERE token_id = :tokenId
                 AND status = 'pending'
                 AND reserved_until > CURRENT_TIMESTAMP
                 AND payment_tx_hash IS NULL
            ) pending_reservations
        ) AS committed`,
      { tokenId },
    );
    if (Number(rows[0]?.committed ?? 0) >= Number(inventory)) {
      return { orderId: null, soldOut: true };
    }

    const inserted = await sqlQueryWithClient<Array<{ id: string }>>(
      client,
      `INSERT INTO membership_orders
         (user_id, buyer_wallet, token_id, amount_cents, status,
          payment_method, eth_amount_wei, usdc_amount, reserved_until)
       VALUES (:userId, :wallet, :tokenId, :amount, 'pending',
               'crypto', :eth, :usdc,
               CURRENT_TIMESTAMP + (:minutes || ' minutes')::interval)
       RETURNING id`,
      {
        userId: user?.id ?? null,
        wallet: buyerWallet,
        tokenId,
        amount: MEMBERSHIP_PRICE_CENTS,
        eth: quote.eth.amount,
        usdc: quote.usdc.amount,
        minutes: String(RESERVATION_MINUTES),
      },
    );
    return { orderId: inserted[0].id, soldOut: false };
  });

  if (reservation.soldOut) {
    return NextResponse.json({ error: 'Memberships are sold out.' }, { status: 409 });
  }
  const orderId = reservation.orderId;

  return NextResponse.json({
    orderId,
    blueWallet: blueAddress,
    chainId: BASE_CHAIN_ID,
    usdcAddress: USDC_ADDRESS,
    quote,
  });
}
