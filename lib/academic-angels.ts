import { BigNumber, utils } from 'ethers';

/**
 * Academic Angels NFT ownership.
 *
 * The Academic Angels are the Scatter "academic-angels" PFP collection on Base
 * (an ERC-721). Holding one unlocks the $1 USDC quest payout and the "Angel"
 * membership tier. This is a different contract from the VIP membership card
 * (see lib/vip-membership-card.ts), which maps to the "Staff" tier.
 */
export const ACADEMIC_ANGELS_ADDRESS =
  process.env.ACADEMIC_ANGELS_ADDRESS ||
  process.env.NEXT_PUBLIC_SCATTER_COLLECTION_ADDRESS ||
  '';

const ERC721_BALANCE_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const erc721BalanceInterface = new utils.Interface(ERC721_BALANCE_ABI);

const CACHE_TTL_MS = 60_000;
let angelCached: { wallet: string; hasAngel: boolean; expiresAt: number } | null = null;

function getBaseRpcUrl(): string | null {
  const rpcUrl =
    process.env.ACADEMIC_ANGELS_RPC_URL ||
    process.env.BASE_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    'https://mainnet.base.org';
  return rpcUrl || null;
}

async function rpcRequest<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || `RPC ${method} failed with status ${response.status}`);
  }
  return body.result as T;
}

/**
 * Returns true when the wallet currently holds at least one Academic Angel.
 * Reads live ERC-721 balance — ownership, not a snapshot. Returns false on any
 * misconfiguration or RPC failure so a payout is never granted on a bad read.
 */
export async function walletHoldsAcademicAngel(wallet: string | null | undefined): Promise<boolean> {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return false;
  if (!ACADEMIC_ANGELS_ADDRESS || !/^0x[a-fA-F0-9]{40}$/.test(ACADEMIC_ANGELS_ADDRESS)) {
    console.warn('[academic-angels] collection address not configured');
    return false;
  }

  const now = Date.now();
  const normalized = wallet.toLowerCase();
  if (angelCached && angelCached.wallet === normalized && angelCached.expiresAt > now) {
    return angelCached.hasAngel;
  }

  const rpcUrl = getBaseRpcUrl();
  if (!rpcUrl) return false;

  try {
    const data = erc721BalanceInterface.encodeFunctionData('balanceOf', [wallet]);
    const result = await rpcRequest<string>(rpcUrl, 'eth_call', [
      { to: ACADEMIC_ANGELS_ADDRESS, data },
      'latest',
    ]);
    const [balance] = erc721BalanceInterface.decodeFunctionResult('balanceOf', result) as [BigNumber];
    const hasAngel = balance.gt(0);
    angelCached = { wallet: normalized, hasAngel, expiresAt: now + CACHE_TTL_MS };
    return hasAngel;
  } catch (err) {
    console.error('[academic-angels] balanceOf failed:', err);
    return false;
  }
}
