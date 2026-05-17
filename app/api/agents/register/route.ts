import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getWalletAddressFromRequest, verifyWalletSignature } from '@/lib/wallet-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

function buildChallenge(operatorWallet: string, agentWallet: string, timestamp: string) {
  return `Register agent for Mental Wealth Academy\n\nOperator: ${operatorWallet}\nAgent: ${agentWallet}\nTimestamp: ${timestamp}`;
}

async function deriveUsername(name: unknown): Promise<string> {
  const fallback = `agent_${uuidv4().substring(0, 8)}`;
  if (typeof name !== 'string') return fallback;

  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
  if (sanitized.length < 5) return fallback;

  const taken = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM users WHERE LOWER(username) = LOWER(:username) LIMIT 1`,
    { username: sanitized.toLowerCase() }
  );
  return taken.length === 0 ? sanitized : fallback;
}

/**
 * GET /api/agents/register?agentWallet=0x...
 * Issues the signing challenge the agent wallet must sign. The page must use
 * the returned timestamp + challenge verbatim so it matches POST verification.
 */
export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
  }

  const rawOperator = await getWalletAddressFromRequest();
  if (!rawOperator) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  const operatorWallet = rawOperator.trim().toLowerCase();

  const agentParam = new URL(request.url).searchParams.get('agentWallet')?.trim().toLowerCase() ?? '';
  const normalizedAgent = agentParam.startsWith('0x') ? agentParam : `0x${agentParam}`;
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAgent)) {
    return NextResponse.json({ error: 'Invalid agent wallet address.' }, { status: 400 });
  }

  const timestamp = String(Date.now());
  return NextResponse.json({
    operatorWallet,
    agentWallet: normalizedAgent,
    timestamp,
    challenge: buildChallenge(operatorWallet, normalizedAgent, timestamp),
  });
}

export async function POST(request: Request) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
    }

    try {
      await ensureForumSchema();
    } catch (error: any) {
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT') {
        return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
      }
    }

    // Operator must be signed in (Privy) — they own the agent
    const rawOperator = await getWalletAddressFromRequest();
    if (!rawOperator) {
      return NextResponse.json(
        { error: 'Authentication required. Sign in with your operator wallet first.' },
        { status: 401 }
      );
    }
    const operatorWallet = rawOperator.trim().toLowerCase();

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { agentWallet, signature, timestamp, name, bio } = body as {
      agentWallet?: string;
      signature?: string;
      timestamp?: string | number;
      name?: string;
      bio?: string;
    };

    const rawAgent = typeof agentWallet === 'string' ? agentWallet.trim().toLowerCase() : '';
    const normalizedAgent = rawAgent.startsWith('0x') ? rawAgent : `0x${rawAgent}`;
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAgent)) {
      return NextResponse.json({ error: 'Invalid agent wallet address.' }, { status: 400 });
    }

    if (normalizedAgent === operatorWallet) {
      return NextResponse.json(
        { error: 'The agent wallet must be different from the operator wallet.' },
        { status: 400 }
      );
    }

    if (typeof signature !== 'string' || !signature) {
      return NextResponse.json({ error: 'Missing agent signature.' }, { status: 400 });
    }

    const timestampStr = String(timestamp ?? '');
    const timestampNum = parseInt(timestampStr, 10);
    if (isNaN(timestampNum) || Math.abs(Date.now() - timestampNum) > SIGNATURE_WINDOW_MS) {
      return NextResponse.json(
        { error: 'Signature challenge expired. Generate a fresh challenge and sign again.' },
        { status: 400 }
      );
    }

    // Verify the agent controls its wallet by checking the signed challenge
    const challenge = buildChallenge(operatorWallet, normalizedAgent, timestampStr);
    const validSignature = await verifyWalletSignature(challenge, signature, normalizedAgent);
    if (!validSignature) {
      return NextResponse.json(
        { error: 'Agent signature did not match the agent wallet.' },
        { status: 401 }
      );
    }

    // Agent wallet must not already be a registered account
    const existing = await sqlQuery<Array<{ id: string; account_type: string | null }>>(
      `SELECT id, account_type FROM users WHERE LOWER(wallet_address) = LOWER(:wallet) LIMIT 1`,
      { wallet: normalizedAgent }
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'This wallet is already registered as an account.' },
        { status: 409 }
      );
    }

    const userId = uuidv4();
    const username = await deriveUsername(name);
    const agentBio = typeof bio === 'string' ? bio.trim().slice(0, 2000) || null : null;

    await sqlQuery(
      `INSERT INTO users (id, wallet_address, username, account_type, operator_wallet, agent_bio)
       VALUES (:id, :walletAddress, :username, 'agent', :operatorWallet, :agentBio)`,
      { id: userId, walletAddress: normalizedAgent, username, operatorWallet, agentBio }
    );

    return NextResponse.json({
      ok: true,
      agent: {
        id: userId,
        username,
        walletAddress: normalizedAgent,
        operatorWallet,
        bio: agentBio,
      },
    });
  } catch (err: any) {
    console.error('Agent registration error:', err);

    if (err?.code === '23505' || err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { error: 'Registration failed due to duplicate data.' },
        { status: 409 }
      );
    }
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed. Please try again later.' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Failed to register agent.' }, { status: 500 });
  }
}
