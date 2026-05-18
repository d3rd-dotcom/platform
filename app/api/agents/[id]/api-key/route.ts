import { createHash, randomBytes, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';
import { getAgentHomeRow, isAgentOperator } from '@/lib/agent-home';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolves the agent and confirms the caller is its operator.
 * Returns the agent row, or a NextResponse error to return directly.
 */
async function resolveOperatorAgent(agentId: string) {
  if (!isDbConfigured()) {
    return { error: NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 }) };
  }
  await ensureForumSchema();

  const operator = await getWalletAddressFromRequest();
  if (!operator) {
    return { error: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }) };
  }

  const agent = await getAgentHomeRow(agentId);
  if (!agent) {
    return { error: NextResponse.json({ error: 'Agent not found.' }, { status: 404 }) };
  }
  if (!isAgentOperator(agent, operator)) {
    return { error: NextResponse.json({ error: 'You are not the operator of this agent.' }, { status: 403 }) };
  }
  return { agent };
}

async function revokeActiveKeys(agentUserId: string) {
  await sqlQuery(
    `UPDATE agent_api_keys SET revoked_at = CURRENT_TIMESTAMP
     WHERE agent_user_id = :id AND revoked_at IS NULL`,
    { id: agentUserId }
  );
}

/**
 * POST /api/agents/[id]/api-key
 * Generates a new long-lived agent API key, revoking any prior key. The
 * plaintext key is returned once and never stored — only its SHA-256 hash is.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const resolved = await resolveOperatorAgent(params.id);
    if ('error' in resolved) return resolved.error;

    const key = `mwa_ag_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(key).digest('hex');
    const keyPrefix = key.slice(0, 12);

    await revokeActiveKeys(resolved.agent.id);
    await sqlQuery(
      `INSERT INTO agent_api_keys (id, agent_user_id, key_hash, key_prefix)
       VALUES (:id, :agentUserId, :keyHash, :keyPrefix)`,
      { id: randomUUID(), agentUserId: resolved.agent.id, keyHash, keyPrefix }
    );

    return NextResponse.json(
      {
        apiKey: key,
        keyPrefix,
        note: 'Store this key now — it will not be shown again.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Agent API key create error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create API key.' }, { status: 500 });
  }
}

/**
 * DELETE /api/agents/[id]/api-key
 * Revokes the agent's active API key(s).
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const resolved = await resolveOperatorAgent(params.id);
    if ('error' in resolved) return resolved.error;

    await revokeActiveKeys(resolved.agent.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Agent API key revoke error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to revoke API key.' }, { status: 500 });
  }
}
