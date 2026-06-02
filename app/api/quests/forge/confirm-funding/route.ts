import { NextResponse } from 'next/server';
import { BigNumber } from 'ethers';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { ensureCustomQuestsSchema } from '@/lib/ensureCustomQuestsSchema';
import { getBlueWalletAddress } from '@/lib/blue-membership';
import { verifyPayment } from '@/lib/crypto-payment';
import { usdcToUnits } from '@/lib/quest-forge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface QuestRow {
  id: string;
  created_by: string;
  creator_wallet: string;
  reward_kind: string | null;
  escrow_total: string | null;
  escrow_status: string | null;
  funding_tx_hash: string | null;
}

/**
 * POST /api/quests/forge/confirm-funding  { questId, txHash }
 *
 * Confirms the on-chain USDC deposit a quest creator sent to Blue's wallet to
 * fund a USDC quest's escrow. Verifies the transfer on Base (sender = creator,
 * recipient = Blue, amount >= escrow total), then flips the quest to 'funded'
 * so it becomes visible and claimable.
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
  const questId = typeof body?.questId === 'string' ? body.questId : '';
  const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : '';
  if (!questId || !txHash) {
    return NextResponse.json({ error: 'questId and txHash are required.' }, { status: 400 });
  }

  await ensureForumSchema();
  await ensureCustomQuestsSchema();

  const rows = await sqlQuery<QuestRow[]>(
    `SELECT id, created_by, creator_wallet, reward_kind, escrow_total, escrow_status, funding_tx_hash
     FROM custom_quests WHERE id = :id LIMIT 1`,
    { id: questId },
  );
  const quest = rows[0];
  if (!quest) {
    return NextResponse.json({ error: 'Quest not found.' }, { status: 404 });
  }
  if (quest.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the quest creator can fund it.' }, { status: 403 });
  }
  if (quest.reward_kind !== 'usdc') {
    return NextResponse.json({ error: 'This quest is not a USDC quest.' }, { status: 400 });
  }
  if (quest.escrow_status === 'funded') {
    return NextResponse.json({ ok: true, alreadyFunded: true });
  }
  if (quest.escrow_status !== 'pending_funding') {
    return NextResponse.json({ error: `Quest cannot be funded (status: ${quest.escrow_status}).` }, { status: 409 });
  }

  // Block reusing one deposit transaction to fund more than one quest.
  const reused = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM custom_quests WHERE LOWER(funding_tx_hash) = LOWER(:tx) AND id <> :id LIMIT 1`,
    { tx: txHash, id: questId },
  );
  if (reused.length > 0) {
    return NextResponse.json({ error: 'That transaction has already funded another quest.' }, { status: 409 });
  }

  let blueWallet: string;
  try {
    blueWallet = getBlueWalletAddress();
  } catch {
    return NextResponse.json({ error: 'Escrow wallet is not configured.' }, { status: 503 });
  }

  const escrowTotal = Number(quest.escrow_total ?? 0);
  const minAmount = BigNumber.from(usdcToUnits(escrowTotal));

  let verification;
  try {
    verification = await verifyPayment({
      txHash,
      currency: 'usdc',
      recipient: blueWallet,
      expectedSender: quest.creator_wallet,
      minAmount,
    });
  } catch (err) {
    console.error('[quests/confirm-funding] verification error:', err);
    return NextResponse.json({ error: 'Could not verify the deposit yet. Try again in a moment.' }, { status: 502 });
  }

  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason ?? 'Deposit could not be verified.' }, { status: 400 });
  }

  // Mark funded only if still pending, so a double submit can't double-flip.
  const updated = await sqlQuery<Array<{ id: string }>>(
    `UPDATE custom_quests
     SET escrow_status = 'funded', funding_tx_hash = :tx
     WHERE id = :id AND escrow_status = 'pending_funding'
     RETURNING id`,
    { id: questId, tx: txHash },
  );
  if (updated.length === 0) {
    return NextResponse.json({ ok: true, alreadyFunded: true });
  }

  return NextResponse.json({ ok: true, escrowStatus: 'funded' });
}
