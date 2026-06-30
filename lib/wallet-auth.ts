import { createHash } from 'crypto';
import { headers, cookies } from 'next/headers';
import { recoverMessageAddress } from 'viem';
import { getWalletFromPrivyToken } from './privy-auth';
import { sqlQuery } from './db';

/**
 * Resolves an agent API key (`mwa_ag_...`) to the agent's wallet address.
 * Only the SHA-256 hash is compared; revoked keys are ignored.
 */
async function resolveAgentApiKey(key: string): Promise<string | null> {
  try {
    const keyHash = createHash('sha256').update(key).digest('hex');
    const rows = await sqlQuery<Array<{ wallet_address: string }>>(
      `SELECT u.wallet_address
       FROM agent_api_keys k
       JOIN users u ON u.id = k.agent_user_id
       WHERE k.key_hash = :keyHash AND k.revoked_at IS NULL
       LIMIT 1`,
      { keyHash }
    );
    if (rows.length === 0) return null;
    // Bump last_used_at without blocking the request
    sqlQuery(
      `UPDATE agent_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = :keyHash`,
      { keyHash }
    ).catch(() => {});
    return rows[0].wallet_address.toLowerCase();
  } catch (error) {
    console.error('resolveAgentApiKey error:', error);
    return null;
  }
}

/**
 * Gets the wallet address from the request.
 * Checks in order:
 *   1. Authorization header (Bearer <privy-jwt>)
 *   2. Privy auth cookie (privy-token) — set automatically by Privy SDK
 *   3. Legacy signed wallet message (address:signature:timestamp)
 */
export async function getWalletAddressFromRequest(): Promise<string | null> {
  try {
    const headersList = await headers();

    // 0. Dev bypass — no real auth needed in dev mode. Must come before the
    //    real auth checks so we never waste a Privy call.
    if (process.env.DEV_BYPASS_AUTH && process.env.NODE_ENV !== 'production') {
      const bypassWallet = tryDevBypass(headersList);
      if (bypassWallet) return bypassWallet;
    }

    const authHeader = headersList.get('authorization');

    // 1. Try Authorization header with Privy JWT
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Agent API key — long-lived bearer credential for skill-driven agents
      if (token.startsWith('mwa_ag_')) {
        const wallet = await resolveAgentApiKey(token);
        if (wallet) return wallet;
        console.warn('[Wallet Auth] Agent API key did not resolve');
      }

      // JWT tokens contain dots
      if (token.includes('.')) {
        const wallet = await getWalletFromPrivyToken(token);
        if (wallet) return wallet;
        console.warn('[Wallet Auth] Authorization header JWT failed to extract wallet');
      }

      // Legacy: signed wallet auth — address:signature:timestamp
      const parts = token.split(':');
      if (parts.length === 3) {
        const [walletAddress, signature, timestamp] = parts;

        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return null;

        const timestampNum = parseInt(timestamp, 10);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        if (isNaN(timestampNum) || Math.abs(now - timestampNum) > fiveMinutes) return null;

        const message = `Sign in to Mental Wealth Academy\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;
        const isValid = await verifyWalletSignature(message, signature, walletAddress);
        if (isValid) return walletAddress.toLowerCase();
      }
    }

    // 2. Try Privy auth cookie (set automatically by @privy-io/react-auth)
    const cookieStore = await cookies();
    const privyToken = cookieStore.get('privy-token')?.value;
    if (privyToken) {
      const wallet = await getWalletFromPrivyToken(privyToken);
      if (wallet) return wallet;
      console.warn('[Wallet Auth] privy-token cookie JWT failed to extract wallet');
    } else {
      console.warn('[Wallet Auth] No privy-token cookie found');
    }

    console.warn('[Wallet Auth] All auth methods failed. authHeader:', authHeader ? 'present' : 'absent', 'privyToken:', privyToken ? 'present' : 'absent');
    return null;
  } catch (error) {
    console.error('getWalletAddressFromRequest error:', error);
    return null;
  }
}

/**
 * Dev-only auth bypass. When DEV_BYPASS_AUTH is truthy AND the request
 * carries a `x-dev-bypass` header with a valid 0x wallet address, that
 * wallet is returned directly — no Privy JWT needed.
 *
 * The client-side DevOnboardingPanel sets this header so the onboarding
 * API calls work without real wallet auth. Guarded by NODE_ENV so never
 * active in production builds.
 */
function tryDevBypass(headersList: Headers): string | null {
  const bypass = process.env.DEV_BYPASS_AUTH;
  if (!bypass || bypass === '0' || bypass === 'false' || bypass === 'no') {
    return null;
  }
  if (process.env.NODE_ENV === 'production') return null;

  const devBypass = headersList.get('x-dev-bypass');
  if (devBypass && /^0x[a-fA-F0-9]{40}$/.test(devBypass)) {
    return devBypass.toLowerCase();
  }
  return null;
}

export async function verifyWalletSignature(
  message: string,
  signature: string,
  address: string
): Promise<boolean> {
  try {
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}
