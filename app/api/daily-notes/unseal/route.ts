import { NextRequest, NextResponse } from 'next/server';
import { Contract, providers, utils } from 'ethers';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensurePrayersSchema } from '@/lib/ensurePrayersSchema';
import { decryptForUser } from '@/lib/encrypt';
import { getDiamondsTokenAddress } from '@/lib/diamonds-onchain';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UNSEAL_DIAMOND_COST = 400;
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const ERC20_INTERFACE = new utils.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

interface FieldNoteEntry {
  day?: number;
  date?: string;
  content?: string;
  submittedAt?: number;
}

interface UnsealedNote {
  date: string;
  content: string;
  day: number;
  weekNumber: number;
  submittedAt: number | null;
}

function parseAllWeekPages(userId: string, progressData: any): Record<string, FieldNoteEntry[]> {
  if (progressData?.encrypted && progressData?.data) {
    const decrypted = decryptForUser(userId, progressData.data);
    const parsed = JSON.parse(decrypted);
    return parsed.allWeekPages ?? {};
  }

  return progressData?.allWeekPages ?? {};
}

function flattenNotes(allWeekPages: Record<string, FieldNoteEntry[]>): UnsealedNote[] {
  const notes: UnsealedNote[] = [];

  for (const [weekKey, entries] of Object.entries(allWeekPages)) {
    if (!Array.isArray(entries)) continue;
    const weekNumber = Number(weekKey);

    for (const entry of entries) {
      if (typeof entry?.date !== 'string') continue;
      if (typeof entry.content !== 'string' || entry.content.trim().length === 0) continue;

      notes.push({
        date: entry.date,
        content: entry.content,
        day: typeof entry.day === 'number' ? entry.day : 0,
        weekNumber: Number.isFinite(weekNumber) ? weekNumber : 0,
        submittedAt: typeof entry.submittedAt === 'number' ? entry.submittedAt : null,
      });
    }
  }

  notes.sort((a, b) => a.date.localeCompare(b.date));
  return notes;
}

let burnSchemaEnsured = false;
async function ensureBurnLedgerSchema() {
  if (burnSchemaEnsured) return;
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS diamond_burns (
      id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR(36) NOT NULL,
      wallet_address VARCHAR(64) NOT NULL,
      purpose VARCHAR(32) NOT NULL,
      amount INTEGER NOT NULL,
      tx_hash VARCHAR(80) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  burnSchemaEnsured = true;
}

function getBaseProvider(): providers.JsonRpcProvider {
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  return new providers.JsonRpcProvider(rpcUrl);
}

/**
 * Verify the supplied tx is a confirmed burn: a Transfer of at least the
 * unseal cost in $BLUE, from the signed-in user's wallet, to the dead
 * address, emitted by the Diamonds token contract. Fail closed on any
 * mismatch — the notes only unseal for a real burn.
 */
async function verifyBurnTx(txHash: string, userWallet: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const tokenAddress = getDiamondsTokenAddress();
  if (!tokenAddress) return { ok: false, reason: 'token_not_configured' };

  const provider = getBaseProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { ok: false, reason: 'tx_not_found' };
  if (receipt.status !== 1) return { ok: false, reason: 'tx_failed' };
  if (receipt.from.toLowerCase() !== userWallet.toLowerCase()) return { ok: false, reason: 'wrong_sender' };

  const requiredAmount = utils.parseUnits(String(UNSEAL_DIAMOND_COST), 18);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    let parsed;
    try {
      parsed = ERC20_INTERFACE.parseLog(log);
    } catch {
      continue;
    }
    if (parsed.name !== 'Transfer') continue;
    if (String(parsed.args.from).toLowerCase() !== userWallet.toLowerCase()) continue;
    if (String(parsed.args.to).toLowerCase() !== BURN_ADDRESS.toLowerCase()) continue;
    if (parsed.args.value.lt(requiredAmount)) continue;
    return { ok: true };
  }

  return { ok: false, reason: 'no_burn_transfer' };
}

/**
 * POST /api/daily-notes/unseal
 * Body: { txHash } — the hash of a confirmed 400 $BLUE burn (transfer to the
 * dead address on Base) signed by the user's wallet. Verifies the burn
 * on-chain, records it (one unseal per tx hash), and returns every field
 * note the user has written, oldest first. Access lasts for the current
 * view only — the client re-seals on close and a new unseal burns again.
 */
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rl = checkRateLimit({
    max: 10,
    windowMs: 60 * 60 * 1000,
    identifier: `daily-note-unseal:${user.id}`,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  let body: { txHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const txHash = body.txHash?.trim();
  if (!txHash || !TX_HASH_PATTERN.test(txHash)) {
    return NextResponse.json({ error: 'invalid_tx', cost: UNSEAL_DIAMOND_COST }, { status: 400 });
  }

  await ensurePrayersSchema();

  const rows = await sqlQuery<Array<{ progress_data: any }>>(
    `SELECT progress_data FROM prayers
     WHERE user_id = :userId
     LIMIT 1`,
    { userId: user.id }
  );

  let notes: UnsealedNote[] = [];
  if (rows.length > 0) {
    try {
      notes = flattenNotes(parseAllWeekPages(user.id, rows[0].progress_data));
    } catch (error) {
      console.error('Failed to decrypt field notes for unseal:', error);
      return NextResponse.json({ error: 'Failed to load notes.' }, { status: 500 });
    }
  }

  if (notes.length === 0) {
    return NextResponse.json({ error: 'no_notes' }, { status: 404 });
  }

  let verification;
  try {
    verification = await verifyBurnTx(txHash, user.walletAddress);
  } catch (error) {
    console.error('Burn verification failed:', error);
    return NextResponse.json({ error: 'verify_failed' }, { status: 502 });
  }

  if (!verification.ok) {
    return NextResponse.json(
      { error: 'burn_not_verified', reason: verification.reason, cost: UNSEAL_DIAMOND_COST },
      { status: 402 }
    );
  }

  // One unseal per burn tx — the unique constraint rejects replays.
  await ensureBurnLedgerSchema();
  try {
    await sqlQuery(
      `INSERT INTO diamond_burns (user_id, wallet_address, purpose, amount, tx_hash)
       VALUES (:userId, :walletAddress, 'field_notes_unseal', :amount, :txHash)`,
      {
        userId: user.id,
        walletAddress: user.walletAddress,
        amount: UNSEAL_DIAMOND_COST,
        txHash: txHash.toLowerCase(),
      }
    );
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'tx_already_used' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({
    ok: true,
    notes,
    diamondsBurned: UNSEAL_DIAMOND_COST,
  });
}
