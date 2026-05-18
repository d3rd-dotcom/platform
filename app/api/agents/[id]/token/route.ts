import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { decryptAgentKey, signAgentSignInToken } from '@/lib/agent-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agents/[id]/token
 *
 * Mints a short-lived sign-in token for a custodial agent. The operator
 * authenticates as themselves; the server — which holds the agent key —
 * signs the standard sign-in message and returns an
 * `address:signature:timestamp` Bearer token. The private key never leaves
 * the server. The operator's off-platform agent process uses this endpoint
 * to refresh its token (tokens expire after 5 minutes).
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
    }
    await ensureForumSchema();

    const rawOperator = await getWalletAddressFromRequest();
    if (!rawOperator) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    const operatorWallet = rawOperator.trim().toLowerCase();

    const agentId = params.id;
    const rows = await sqlQuery<
      Array<{ id: string; account_type: string | null; operator_wallet: string | null }>
    >(
      `SELECT id, account_type, operator_wallet FROM users WHERE id = :id LIMIT 1`,
      { id: agentId }
    );
    const agent = rows[0];
    if (!agent || agent.account_type !== 'agent') {
      return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
    }
    if ((agent.operator_wallet ?? '').toLowerCase() !== operatorWallet) {
      return NextResponse.json(
        { error: 'You are not the operator of this agent.' },
        { status: 403 }
      );
    }

    const keyRows = await sqlQuery<
      Array<{ encrypted_key: string; iv: string; auth_tag: string }>
    >(
      `SELECT encrypted_key, iv, auth_tag FROM agent_wallet_keys WHERE user_id = :id LIMIT 1`,
      { id: agentId }
    );
    if (keyRows.length === 0) {
      return NextResponse.json(
        { error: 'This is a self-custody agent. Sign the sign-in message with its own wallet key.' },
        { status: 400 }
      );
    }

    let token: { token: string; timestamp: number; expiresAt: number };
    try {
      const privateKey = decryptAgentKey({
        encryptedKey: keyRows[0].encrypted_key,
        iv: keyRows[0].iv,
        authTag: keyRows[0].auth_tag,
      });
      token = await signAgentSignInToken(privateKey);
    } catch (err: any) {
      console.error('Agent token signing failed:', err?.message);
      return NextResponse.json({ error: 'Could not mint an agent token.' }, { status: 500 });
    }

    return NextResponse.json({
      token: token.token,
      expiresAt: token.expiresAt,
      tokenType: 'Bearer',
    });
  } catch (err: any) {
    console.error('Agent token endpoint error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to mint agent token.' }, { status: 500 });
  }
}
