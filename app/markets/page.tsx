import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import MarketsClient from './MarketsClient';
import MarketsLockedPage from './MarketsLockedPage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function MarketsPage() {
  const user = await getCurrentUserFromRequestCookie();
  const hasVipMembershipCard = user
    ? await walletHoldsVipMembershipCard(user.walletAddress)
    : false;

  if (!hasVipMembershipCard) {
    return <MarketsLockedPage />;
  }

  return <MarketsClient />;
}
