import { NextResponse } from 'next/server';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { walletHoldsConfiguredVipMembershipCard } from '@/lib/vip-membership-card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/membership/holding-status
 *
 * Checks whether the signed-in wallet already holds a VIP Membership card.
 * The checkout modal uses this for a warning only; it does not block repeat
 * purchases because membership cards can be transferred between accounts.
 */
export async function GET() {
  const buyerWallet = await getWalletAddressFromRequest();
  if (!buyerWallet) {
    return NextResponse.json({ error: 'Sign in to check membership status.' }, { status: 401 });
  }

  const hasVipMembershipCard = await walletHoldsConfiguredVipMembershipCard(buyerWallet);
  return NextResponse.json({ hasVipMembershipCard, walletAddress: buyerWallet });
}
