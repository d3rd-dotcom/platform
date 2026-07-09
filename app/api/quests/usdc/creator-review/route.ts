import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery, withTransaction, sqlQueryWithClient } from '@/lib/db';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { ensureCustomQuestsSchema } from '@/lib/ensureCustomQuestsSchema';
import { ensureQuestUsdcClaimsSchema } from '@/lib/ensureQuestUsdcClaimsSchema';
import { distributeUSDC } from '@/lib/blue-usdc';
import { usdcToUnits } from '@/lib/quest-forge';
import { deliverDiamondsOnchain } from '@/lib/diamonds-onchain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ClaimJoinRow {
  id: string;
  user_id: string;
  quest_id: string;
  recipient_wallet: string | null;
  usdc_amount: string;
  reward_kind: string;
  proof_text: string | null;
  proof_url: string | null;
  status: string;
  created_at: string;
  username: string | null;
  quest_title: string;
  created_by: string;
  escrow_remaining: string | null;
  escrow_status: string | null;
}

async function ensureSchemas() {
  await ensureForumSchema();
  await ensureCustomQuestsSchema();
  await ensureQuestUsdcClaimsSchema();
}

/**
 * GET /api/quests/usdc/creator-review
 * Lists pending USDC claims on quests the caller created, for them to approve.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }
  await ensureSchemas();

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const rows = await sqlQuery<ClaimJoinRow[]>(
    `SELECT c.id, c.user_id, c.quest_id, c.recipient_wallet, c.usdc_amount, c.reward_kind, c.proof_text, c.proof_url, c.status, c.created_at,
            u.username, q.title AS quest_title, q.created_by, q.escrow_remaining, q.escrow_status
     FROM quest_usdc_claims c
     JOIN custom_quests q ON q.id = c.quest_id
     LEFT JOIN users u ON u.id = c.user_id
     WHERE q.created_by = :userId AND c.status = 'pending'
     ORDER BY c.created_at ASC`,
    { userId: user.id },
  );

  return NextResponse.json({
    claims: rows.map((r) => ({
      id: r.id,
      questId: r.quest_id,
      questTitle: r.quest_title,
      recipientWallet: r.recipient_wallet,
      usdcAmount: Number(r.usdc_amount),
      rewardKind: (r.reward_kind ?? 'usdc') as 'usdc' | 'credits',
      proofText: r.proof_text,
      proofUrl: r.proof_url,
      username: r.username,
      createdAt: r.created_at,
      escrowRemaining: r.escrow_remaining != null ? Number(r.escrow_remaining) : null,
    })),
  });
}

/**
 * POST /api/quests/usdc/creator-review  { claimId, action: 'approve' | 'reject', note? }
 * Creator-only. Reject closes the claim. Approve draws the reward from the
 * quest's escrow and has Blue send the USDC to the completer.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }
  await ensureSchemas();

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const claimId = typeof body?.claimId === 'string' ? body.claimId : null;
  const action = body?.action === 'approve' || body?.action === 'reject' ? body.action : null;
  const note = typeof body?.note === 'string' ? body.note.slice(0, 600) : null;
  if (!claimId || !action) {
    return NextResponse.json({ error: 'claimId and action are required.' }, { status: 400 });
  }

  const rows = await sqlQuery<ClaimJoinRow[]>(
    `SELECT c.id, c.user_id, c.quest_id, c.recipient_wallet, c.usdc_amount, c.reward_kind, c.status,
            c.created_at, NULL AS username, q.title AS quest_title, q.created_by,
            q.escrow_remaining, q.escrow_status
     FROM quest_usdc_claims c
     JOIN custom_quests q ON q.id = c.quest_id
     WHERE c.id = :id LIMIT 1`,
    { id: claimId },
  );
  const claim = rows[0];
  if (!claim) {
    return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
  }
  if (claim.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the quest creator can review this claim.' }, { status: 403 });
  }
  if (claim.status !== 'pending') {
    return NextResponse.json({ error: `Claim is already ${claim.status}.` }, { status: 409 });
  }

  if (action === 'reject') {
    await sqlQuery(
      `UPDATE quest_usdc_claims
       SET status = 'rejected', reviewed_by = :reviewer, note = :note, updated_at = NOW()
       WHERE id = :id AND status = 'pending'`,
      { id: claimId, reviewer: user.id, note },
    );
    return NextResponse.json({ ok: true, claim: { status: 'rejected' } });
  }

  const amount = Number(claim.usdc_amount);

  // Reserve the claim first so two approvals can't both pay out.
  const reserved = await sqlQuery<Array<{ id: string }>>(
    `UPDATE quest_usdc_claims
     SET status = 'approved', reviewed_by = :reviewer, note = :note, updated_at = NOW()
     WHERE id = :id AND status = 'pending'
     RETURNING id`,
    { id: claimId, reviewer: user.id, note },
  );
  if (reserved.length === 0) {
    return NextResponse.json({ error: 'Claim is no longer pending.' }, { status: 409 });
  }

  // Credit rewards: draw down the quest's escrow accounting atomically, then
  // pay the completer in real $BLUE from Blue's wallet (the creator's deposit
  // funded her for it at forge time).
  if (claim.reward_kind === 'credits') {
    try {
      const paid = await withTransaction(async (client) => {
        const drawn = await sqlQueryWithClient<Array<{ escrow_remaining: string }>>(
          client,
          `UPDATE custom_quests
           SET escrow_remaining = escrow_remaining - :amt,
               escrow_status = CASE WHEN escrow_remaining - :amt <= 0 THEN 'depleted' ELSE escrow_status END
           WHERE id = :qid AND escrow_remaining >= :amt
           RETURNING escrow_remaining`,
          { qid: claim.quest_id, amt: amount },
        );
        if (drawn.length === 0) {
          throw new Error('ESCROW_DEPLETED');
        }

        await sqlQueryWithClient(
          client,
          `UPDATE users SET shard_count = shard_count + :amt WHERE id = :userId`,
          { userId: claim.user_id, amt: amount },
        );

        const dupe = await sqlQueryWithClient<Array<{ id: string }>>(
          client,
          `SELECT id FROM quests WHERE user_id = :userId AND quest_id = :questId LIMIT 1`,
          { userId: claim.user_id, questId: claim.quest_id },
        );
        if (dupe.length === 0) {
          await sqlQueryWithClient(
            client,
            `INSERT INTO quests (id, user_id, quest_id, shards_awarded)
             VALUES (:id, :userId, :questId, :amt)`,
            { id: uuidv4(), userId: claim.user_id, questId: claim.quest_id, amt: amount },
          );
        }

        await sqlQueryWithClient(
          client,
          `UPDATE quest_usdc_claims SET status = 'paid', updated_at = NOW() WHERE id = :id`,
          { id: claimId },
        );
        return dupe.length === 0;
      });

      // Deliver the diamonds onchain from Blue's stash, like every quest
      // reward (fail-soft, never rolls back the approval).
      if (paid && amount > 0) {
        const walletRows = await sqlQuery<Array<{ wallet_address: string | null }>>(
          `SELECT wallet_address FROM users WHERE id = :id LIMIT 1`,
          { id: claim.user_id },
        );
        await deliverDiamondsOnchain({
          userId: claim.user_id,
          walletAddress: walletRows[0]?.wallet_address,
          source: 'quest',
          refId: claim.quest_id,
          amount,
          delivery: 'blue_transfer',
        });
      }

      return NextResponse.json({ ok: true, claim: { status: 'paid' } });
    } catch (err: any) {
      // Roll the claim back to pending so the creator can retry.
      await sqlQuery(
        `UPDATE quest_usdc_claims SET status = 'pending', updated_at = NOW() WHERE id = :id`,
        { id: claimId },
      );
      if (err?.message === 'ESCROW_DEPLETED') {
        return NextResponse.json(
          { error: "Not enough diamonds left in this quest's escrow." },
          { status: 409 },
        );
      }
      console.error('Error approving credit claim:', err);
      return NextResponse.json({ error: 'Failed to approve claim.' }, { status: 500 });
    }
  }

  // USDC payouts move real money. A destination wallet is required.
  if (!claim.recipient_wallet) {
    await sqlQuery(
      `UPDATE quest_usdc_claims SET status = 'pending', updated_at = NOW() WHERE id = :id`,
      { id: claimId },
    );
    return NextResponse.json({ error: 'Completer has no wallet on file for USDC.' }, { status: 409 });
  }

  // Draw the reward from escrow, guarded so we never overpay the funded amount.
  const drawn = await sqlQuery<Array<{ escrow_remaining: string }>>(
    `UPDATE custom_quests
     SET escrow_remaining = escrow_remaining - :amt,
         escrow_status = CASE WHEN escrow_remaining - :amt <= 0 THEN 'depleted' ELSE escrow_status END
     WHERE id = :qid AND escrow_remaining >= :amt
     RETURNING escrow_remaining`,
    { qid: claim.quest_id, amt: amount },
  );
  if (drawn.length === 0) {
    // Not enough escrow left — release the claim back to pending.
    await sqlQuery(
      `UPDATE quest_usdc_claims SET status = 'pending', updated_at = NOW() WHERE id = :id`,
      { id: claimId },
    );
    return NextResponse.json({ error: 'Not enough USDC left in this quest\'s escrow.' }, { status: 409 });
  }

  // Pay the completer from Blue's wallet (the escrow custodian).
  try {
    const { txHashes, failed } = await distributeUSDC([
      { address: claim.recipient_wallet, amount: usdcToUnits(amount) },
    ]);

    if (failed.length > 0 || txHashes.length === 0) {
      // Refund escrow and return the claim to pending so it can be retried.
      await refundAndReset(claim.quest_id, claimId, amount, failed[0]?.error ?? 'USDC transfer failed');
      return NextResponse.json({ error: failed[0]?.error ?? 'USDC transfer failed.' }, { status: 502 });
    }

    // Record the completion so the quest shows as done for the completer.
    try {
      await sqlQuery(
        `INSERT INTO quests (id, user_id, quest_id, shards_awarded)
         VALUES (:id, :userId, :questId, 0)`,
        { id: uuidv4(), userId: claim.user_id, questId: claim.quest_id },
      );
    } catch (insertErr) {
      // A completion row may already exist; payment still succeeded.
      console.warn('[creator-review] completion row insert skipped:', insertErr);
    }

    await sqlQuery(
      `UPDATE quest_usdc_claims SET status = 'paid', tx_hash = :tx, updated_at = NOW() WHERE id = :id`,
      { id: claimId, tx: txHashes[0] },
    );

    return NextResponse.json({ ok: true, claim: { status: 'paid', txHash: txHashes[0] } });
  } catch (err) {
    await refundAndReset(claim.quest_id, claimId, amount, err instanceof Error ? err.message : 'USDC transfer error');
    console.error('Error paying custom USDC claim:', err);
    return NextResponse.json({ error: 'USDC payout failed.' }, { status: 500 });
  }
}

/** Return drawn escrow and reset the claim to pending after a failed payout. */
async function refundAndReset(questId: string, claimId: string, amount: number, note: string) {
  await sqlQuery(
    `UPDATE custom_quests
     SET escrow_remaining = escrow_remaining + :amt,
         escrow_status = CASE WHEN escrow_status = 'depleted' THEN 'funded' ELSE escrow_status END
     WHERE id = :qid`,
    { qid: questId, amt: amount },
  );
  await sqlQuery(
    `UPDATE quest_usdc_claims SET status = 'pending', note = :note, updated_at = NOW() WHERE id = :id`,
    { id: claimId, note },
  );
}
