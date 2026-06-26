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
      shard_count: number;
      created_at: string;
      custodial: boolean;
    }>
  >(
    `SELECT u.id, u.username, u.wallet_address,
            u.shard_count, u.created_at,
            (k.user_id IS NOT NULL) AS custodial
     FROM users u
     LEFT JOIN agent_wallet_keys k ON k.user_id = u.id
     WHERE u.account_type = 'agent' AND LOWER(u.operator_wallet) = LOWER(:operatorWallet)
     ORDER BY u.created_at DESC`,
    { operatorWallet }
  );

  return NextResponse.json({
    agents: rows.map((row) => ({
      id: row.id,
      username: row.username,
      walletAddress: row.wallet_address,
      shardCount: row.shard_count,
      createdAt: row.created_at,
      walletMode: row.custodial ? 'custodial' : 'self',
    })),
  });
}
