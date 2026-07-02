import { NextResponse } from 'next/server';
import { createPublicClient, http, erc20Abi } from 'viem';
import { base } from 'viem/chains';
import { sqlQuery, isDbConfigured } from '@/lib/db';
import { getDiamondsTokenAddress } from '@/lib/diamonds-onchain';

export const dynamic = 'force-dynamic';

interface LeaderboardUser {
  rank: number;
  username: string;
  avatarUrl: string | null;
  shards: number;
}

interface UserRow {
  username: string;
  avatar_url: string | null;
  wallet_address: string | null;
  shard_count: number;
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; users: LeaderboardUser[] } | null = null;

function getBaseRpcUrl(): string {
  return (
    process.env.BASE_MAINNET_RPC_URL ||
    process.env.BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    'https://mainnet.base.org'
  );
}

/**
 * The leaderboard is the actual Diamonds ($BLUE) balance of each member's
 * wallet, read from the token contract — Blue included, with her 200M stash.
 * One multicall covers every wallet; results are cached for a minute. If the
 * token or RPC is unavailable, fall back to the in-app shard_count ledger.
 */
async function rankByOnchainBalance(rows: UserRow[], tokenAddress: string): Promise<LeaderboardUser[]> {
  const holders = rows.filter(
    (r) => r.username && r.wallet_address && /^0x[a-fA-F0-9]{40}$/.test(r.wallet_address),
  );
  if (holders.length === 0) return [];

  const client = createPublicClient({ chain: base, transport: http(getBaseRpcUrl()) });
  const results = await client.multicall({
    contracts: holders.map((r) => ({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [r.wallet_address as `0x${string}`],
    })),
    allowFailure: true,
  });

  return holders
    .map((r, i) => {
      const result = results[i];
      const balance = result.status === 'success' ? (result.result as bigint) : 0n;
      return {
        username: r.username,
        avatarUrl: r.avatar_url,
        shards: Number(balance / 10n ** 18n),
      };
    })
    .sort((a, b) => b.shards - a.shards)
    .slice(0, 20)
    .map((u, i) => ({ rank: i + 1, ...u }));
}

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ users: [] });
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ users: cache.users });
  }

  try {
    const rows = await sqlQuery<UserRow[]>(
      `SELECT username, avatar_url, wallet_address, shard_count
       FROM users
       WHERE username IS NOT NULL`,
      {},
    );

    const tokenAddress = getDiamondsTokenAddress();
    if (tokenAddress) {
      try {
        const users = await rankByOnchainBalance(rows, tokenAddress);
        cache = { at: Date.now(), users };
        return NextResponse.json({ users });
      } catch (err) {
        console.error('[leaderboard] onchain read failed, falling back to shard_count:', err);
      }
    }

    const users = rows
      .filter((r) => r.username)
      .sort((a, b) => b.shard_count - a.shard_count)
      .slice(0, 20)
      .map((r, i) => ({
        rank: i + 1,
        username: r.username,
        avatarUrl: r.avatar_url,
        shards: r.shard_count,
      }));
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ users: [] });
  }
}
