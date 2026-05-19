import { NextResponse } from 'next/server';
import { MEMBERSHIP_PRICE_CENTS } from '@/lib/stripe';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureMembershipSchema, countCommittedMemberships } from '@/lib/ensureMembershipSchema';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getBlueWalletAddress } from '@/lib/blue-membership';
import {
  VIP_MEMBERSHIP_CARD_TOKEN_ID,
  getVipMembershipCardBalance,
} from '@/lib/soul-key';
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

  // Inventory check — Blue's on-chain balance minus everything committed.
  const inventory = await getVipMembershipCardBalance(blueAddress, tokenId);
  const committed = await countCommittedMemberships(tokenId);

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

  // Reuse an open crypto checkout for this wallet rather than stacking
  // reservations. Refresh the quote so the ETH amount tracks the live price.
  const existing = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM membership_orders
      WHERE LOWER(buyer_wallet) = LOWER(:wallet)
        AND status = 'pending' AND reserved_until > CURRENT_TIMESTAMP
        AND payment_method = 'crypto'
      ORDER BY created_at DESC LIMIT 1`,
    { wallet: buyerWallet },
  );

  let orderId: string;
  if (existing.length > 0) {
    orderId = existing[0].id;
    await sqlQuery(
      `UPDATE membership_orders
          SET eth_amount_wei = :eth, usdc_amount = :usdc,
              reserved_until = CURRENT_TIMESTAMP + (:minutes || ' minutes')::interval,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = :id`,
      {
        eth: quote.eth.amount,
        usdc: quote.usdc.amount,
        minutes: String(RESERVATION_MINUTES),
        id: orderId,
      },
    );
  } else {
    // Only block a brand-new reservation when inventory is genuinely full.
    if (committed >= Number(inventory)) {
      return NextResponse.json({ error: 'Memberships are sold out.' }, { status: 409 });
    }
    const inserted = await sqlQuery<Array<{ id: string }>>(
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
    orderId = inserted[0].id;
  }

  return NextResponse.json({
    orderId,
    blueWallet: blueAddress,
    chainId: BASE_CHAIN_ID,
    usdcAddress: USDC_ADDRESS,
    quote,
  });
}
