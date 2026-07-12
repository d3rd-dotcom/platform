import { walletHoldsVipMembershipCard } from './vip-membership-card';
import { walletHasActiveSubscription } from './ensureMembershipSchema';

/** Monthly Stripe membership or the lifetime onchain membership card. */
export async function walletHasMembershipAccess(
  wallet: string | null | undefined,
): Promise<boolean> {
  if (!wallet) return false;

  if (await walletHoldsVipMembershipCard(wallet)) return true;
  return walletHasActiveSubscription(wallet);
}
