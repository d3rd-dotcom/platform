import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { fetchDiamondBalance } from '@/lib/diamonds-balance';
import { getChainConfig } from '@/lib/chain-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RewardRow {
  source: string;
  amount: number;
  delivery: string;
  status: string;
  created_at: string;
}

interface BurnRow {
  purpose: string;
  amount: number;
  tx_hash: string;
  created_at: string;
}

export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const user = await getCurrentUserFromRequestCookie();
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const userRows = await sqlQuery<Array<{ wallet_address: string | null; shard_count: number }>>(
      `SELECT wallet_address, shard_count FROM users WHERE id = :id LIMIT 1`,
      { id: user.id },
    );
    const walletAddress = userRows[0]?.wallet_address ?? null;
    const shardCount = userRows[0]?.shard_count ?? 0;

    let onchainBalance: number | null = null;
    if (walletAddress) {
      onchainBalance = await fetchDiamondBalance(walletAddress);
    }

    const rewards = await sqlQuery<RewardRow[]>(
      `SELECT source, amount, delivery, status, created_at
       FROM diamond_onchain_rewards
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT 100`,
      { userId: user.id },
    );

    const burns = await sqlQuery<BurnRow[]>(
      `SELECT purpose, amount, tx_hash, created_at
       FROM diamond_burns
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT 100`,
      { userId: user.id },
    );

    const totalEarned = rewards
      .filter((r) => r.status === 'confirmed')
      .reduce((sum, r) => sum + r.amount, 0);

    const totalSpent = burns.reduce((sum, r) => sum + r.amount, 0);

    const chain = getChainConfig();

    return NextResponse.json({
      walletAddress,
      shardCount,
      onchainBalance,
      totalEarned,
      totalSpent,
      rewards,
      burns,
      chain: {
        name: chain.chainName,
        explorerUrl: chain.explorerUrl,
      },
    });
  } catch (error) {
    console.error('[api/me/treasury] Failed:', error);
    return NextResponse.json(
      { error: 'Could not load treasury data.' },
      { status: 500 },
    );
  }
}
