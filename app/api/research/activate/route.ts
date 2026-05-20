import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import { isDbConfigured } from '@/lib/db';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/research/activate
 *
 * Unlocks Blue research mode. Research mode is a VIP-membership benefit:
 * only wallets holding a VIP membership card may activate it. The check is
 * server-side so the gate cannot be skipped from the client.
 */
export async function POST() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit({ max: 30, windowMs: 60 * 60 * 1000, identifier: `research-activate:${user.id}` });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: getRateLimitHeaders(rl) });
  }

  const wallet = await getWalletAddressFromRequest();
  if (!wallet || !(await walletHoldsVipMembershipCard(wallet))) {
    return NextResponse.json({ error: 'vip_required' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
