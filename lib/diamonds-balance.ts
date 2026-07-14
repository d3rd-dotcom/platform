import { createPublicClient, http, formatUnits, parseAbi, type Chain } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { getDiamondsTokenAddress, getChainConfig, getRpcUrl } from './chain-config';

const BALANCE_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);

// Server routes (/api/me, /api/profile) read the balance on every call, so a
// short cache keeps one RPC read per wallet per few seconds. Client callers
// share the same code path harmlessly (each browser caches only its own reads).
const CACHE_TTL_MS = 10_000;
const balanceCache = new Map<string, { at: number; balance: number }>();

/**
 * Read the wallet's live $BLUE balance from the active Diamonds chain, in
 * whole diamonds. This is the app's source of truth for what a user holds.
 * Returns null when the token isn't configured or the RPC read fails —
 * callers fall back to the in-app credit mirror.
 */
export async function fetchDiamondBalance(address: string): Promise<number | null> {
  const tokenAddress = getDiamondsTokenAddress();
  if (!tokenAddress || !address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;

  const key = address.toLowerCase();
  const hit = balanceCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.balance;

  try {
    // viem (fetch transport): ethers v5 cannot make RPC calls from deployed
    // Vercel lambdas, which silently pushed every caller onto the DB fallback.
    const cfg = getChainConfig();
    const chain: Chain = cfg.chainId === 84532 ? baseSepolia : base;
    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl()),
    });
    const raw = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: BALANCE_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });
    const balance = Math.floor(Number(formatUnits(raw, 18)));
    balanceCache.set(key, { at: Date.now(), balance });
    return balance;
  } catch {
    return null;
  }
}
