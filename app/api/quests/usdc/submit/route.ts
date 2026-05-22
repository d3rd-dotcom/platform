import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { ensureQuestUsdcClaimsSchema } from '@/lib/ensureQuestUsdcClaimsSchema';
import { getQuestDefinition, getQuestUsdcReward } from '@/lib/quest-definitions';
import { walletHoldsAcademicAngel } from '@/lib/academic-angels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ClaimRow {
  id: string;
  status: string;
  tx_hash: string | null;
  usdc_amount: string;
  note: string | null;
}

async function loadClaim(userId: string, questId: string): Promise<ClaimRow | null> {
  const rows = await sqlQuery<ClaimRow[]>(
    `SELECT id, status, tx_hash, usdc_amount, note
     FROM quest_usdc_claims
     WHERE user_id = :userId AND quest_id = :questId
     LIMIT 1`,
    { userId, questId },
  );
  return rows[0] ?? null;
}

/**
 * GET /api/quests/usdc/submit?questId=...
 * Returns the caller's USDC eligibility and existing claim state for a quest.
 */
export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const questId = new URL(request.url).searchParams.get('questId');
  if (!questId) {
    return NextResponse.json({ error: 'questId is required.' }, { status: 400 });
  }

  const usdcReward = getQuestUsdcReward(questId);
  if (usdcReward <= 0) {
    return NextResponse.json({ usdcReward: 0, eligible: false, claim: null });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  await ensureForumSchema();
  await ensureQuestUsdcClaimsSchema();

  const [eligible, claim] = await Promise.all([
    walletHoldsAcademicAngel(user.walletAddress),
    loadClaim(user.id, questId),
  ]);

  return NextResponse.json({
    usdcReward,
    eligible,
    claim: claim
      ? { status: claim.status, txHash: claim.tx_hash, note: claim.note }
      : null,
  });
}

/**
 * POST /api/quests/usdc/submit  { questId }
 * Queues a $1 USDC bounty for staff review. Eligibility requires the caller to
 * hold an Academic Angel NFT. Only Blue-funded official quests are accepted —
 * custom quests are funded and judged by their own creator, never Blue.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const questId = typeof body?.questId === 'string' ? body.questId : null;
  if (!questId) {
    return NextResponse.json({ error: 'questId is required.' }, { status: 400 });
  }

  // Only built-in, Blue-funded quests carry a USDC bounty. This rejects any
  // custom (cq_*) quest id by construction.
  const definition = getQuestDefinition(questId);
  const usdcReward = definition?.usdcReward ?? 0;
  if (!definition || usdcReward <= 0) {
    return NextResponse.json({ error: 'This quest does not offer a USDC bounty.' }, { status: 400 });
  }

  if (!user.walletAddress) {
    return NextResponse.json({ error: 'Link a wallet to claim USDC.' }, { status: 400 });
  }

  const eligible = await walletHoldsAcademicAngel(user.walletAddress);
  if (!eligible) {
    return NextResponse.json(
      { error: 'Hold an Academic Angel NFT to unlock this USDC bounty.' },
      { status: 403 },
    );
  }

  await ensureForumSchema();
  await ensureQuestUsdcClaimsSchema();

  const existing = await loadClaim(user.id, questId);
  if (existing) {
    return NextResponse.json(
      { error: 'You already have a USDC claim for this quest.', claim: { status: existing.status } },
      { status: 409 },
    );
  }

  try {
    await sqlQuery(
      `INSERT INTO quest_usdc_claims (id, user_id, quest_id, recipient_wallet, usdc_amount, status)
       VALUES (:id, :userId, :questId, :wallet, :amount, 'pending')`,
      {
        id: uuidv4(),
        userId: user.id,
        questId,
        wallet: user.walletAddress,
        amount: usdcReward,
      },
    );
  } catch (err: any) {
    // Unique constraint race — a claim already exists.
    if (String(err?.message || '').includes('uq_quest_usdc_claim_user_quest')) {
      return NextResponse.json({ error: 'You already have a USDC claim for this quest.' }, { status: 409 });
    }
    console.error('Error creating USDC claim:', err);
    return NextResponse.json({ error: 'Failed to submit USDC claim.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, claim: { status: 'pending' } });
}
