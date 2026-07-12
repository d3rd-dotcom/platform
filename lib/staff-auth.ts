import type { CurrentUser } from './auth';

function configuredStaffWallets(): Set<string> {
  return new Set(
    (process.env.STAFF_WALLET_ADDRESSES || '')
      .split(',')
      .map((wallet) => wallet.trim().toLowerCase())
      .filter((wallet) => /^0x[a-f0-9]{40}$/.test(wallet)),
  );
}

/** Staff authority is an explicit server-side allowlist, independent of VIP ownership. */
export function isStaffUser(user: Pick<CurrentUser, 'walletAddress'>): boolean {
  return configuredStaffWallets().has(user.walletAddress.toLowerCase());
}
