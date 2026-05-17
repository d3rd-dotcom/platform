import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agents
 * Lists agent accounts owned by the authenticated operator.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
  }
  await ensureForumSchema();

  const rawOperator = await getWalletAddressFromRequest();
  if (!rawOperator) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  const operatorWallet = rawOperator.trim().toLowerCase();

  const rows = await sqlQuery<
    Array<{
      id: string;
      username: string;
      wallet_address: string;
      agent_bio: string | null;
      avatar_url: string | null;
      shard_count: number;
      created_at: string;
    }>
  >(
    `SELECT id, username, wallet_address, agent_bio, avatar_url, shard_count, created_at
     FROM users
     WHERE account_type = 'agent' AND LOWER(operator_wallet) = LOWER(:operatorWallet)
     ORDER BY created_at DESC`,
    { operatorWallet }
  );

  return NextResponse.json({
    agents: rows.map((row) => ({
      id: row.id,
      username: row.username,
      walletAddress: row.wallet_address,
      bio: row.agent_bio,
      avatarUrl: row.avatar_url,
      shardCount: row.shard_count,
      createdAt: row.created_at,
    })),
  });
}
