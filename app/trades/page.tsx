import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { walletHasMembershipAccess } from '@/lib/membership-access';
import MarketsClient from './MarketsClient';
import MarketsLockedPage from './MarketsLockedPage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function MarketsPage() {
  const user = await getCurrentUserFromRequestCookie();
  const hasVipMembershipCard = user
    ? await walletHasMembershipAccess(user.walletAddress)
    : false;

  if (!hasVipMembershipCard) {
    return <MarketsLockedPage />;
  }

  return <MarketsClient />;
}
