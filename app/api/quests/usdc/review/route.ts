import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { ensureQuestUsdcClaimsSchema } from '@/lib/ensureQuestUsdcClaimsSchema';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import { walletHoldsAcademicAngel } from '@/lib/academic-angels';
import { getQuestDefinition } from '@/lib/quest-definitions';
import { blueWallet } from '@/lib/blue-wallet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const USDC_DECIMALS = 6;

interface ClaimRow {
  id: string;
  user_id: string;
  quest_id: string;
  recipient_wallet: string;
  usdc_amount: string;
  status: string;
  tx_hash: string | null;
  note: string | null;
  created_at: string;
  username: string | null;
}

/** Staff = holder of the VIP membership card. */
async function requireStaff() {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const isStaff = await walletHoldsVipMembershipCard(user.walletAddress);
  if (!isStaff) {
    return { error: NextResponse.json({ error: 'Staff only.' }, { status: 403 }) };
  }
  return { user };
}

function questTitle(questId: string): string {
  return getQuestDefinition(questId)?.title ?? questId;
}

/**
 * GET /api/quests/usdc/review
 * Staff-only. Lists pending USDC claims awaiting approval.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }
  await ensureForumSchema();
  await ensureQuestUsdcClaimsSchema();

  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const rows = await sqlQuery<ClaimRow[]>(
    `SELECT c.id, c.user_id, c.quest_id, c.recipient_wallet, c.usdc_amount,
            c.status, c.tx_hash, c.note, c.created_at, u.username
     FROM quest_usdc_claims c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.status = 'pending'
     ORDER BY c.created_at ASC`,
  );

  return NextResponse.json({
    claims: rows.map((r) => ({
      id: r.id,
      questId: r.quest_id,
      questTitle: questTitle(r.quest_id),
      recipientWallet: r.recipient_wallet,
      usdcAmount: Number(r.usdc_amount),
      username: r.username,
      createdAt: r.created_at,
    })),
  });
}

/**
 * POST /api/quests/usdc/review  { claimId, action: 'approve' | 'reject', note? }
 * Staff-only. Reject closes the claim. Approve re-verifies the recipient still
 * holds an Academic Angel, reserves the claim, then has Blue send the USDC.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }
  await ensureForumSchema();
  await ensureQuestUsdcClaimsSchema();

  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const staff = gate.user!;

  const body = await request.json().catch(() => ({}));
  const claimId = typeof body?.claimId === 'string' ? body.claimId : null;
  const action = body?.action === 'approve' || body?.action === 'reject' ? body.action : null;
  const note = typeof body?.note === 'string' ? body.note.slice(0, 600) : null;

  if (!claimId || !action) {
    return NextResponse.json({ error: 'claimId and action are required.' }, { status: 400 });
  }

  const rows = await sqlQuery<ClaimRow[]>(
    `SELECT id, user_id, quest_id, recipient_wallet, usdc_amount, status, tx_hash, note, created_at,
            NULL AS username
     FROM quest_usdc_claims WHERE id = :id LIMIT 1`,
    { id: claimId },
  );
  const claim = rows[0];
  if (!claim) {
    return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
  }
  if (claim.status !== 'pending') {
    return NextResponse.json(
      { error: `Claim is already ${claim.status}.`, claim: { status: claim.status } },
      { status: 409 },
    );
  }

  if (action === 'reject') {
    await sqlQuery(
      `UPDATE quest_usdc_claims
       SET status = 'rejected', reviewed_by = :staff, note = :note, updated_at = NOW()
       WHERE id = :id AND status = 'pending'`,
      { id: claimId, staff: staff.id, note },
    );
    return NextResponse.json({ ok: true, claim: { status: 'rejected' } });
  }

  // Approve: re-verify on-chain eligibility before moving any money.
  const stillEligible = await walletHoldsAcademicAngel(claim.recipient_wallet);
  if (!stillEligible) {
    return NextResponse.json(
      { error: 'Recipient no longer holds an Academic Angel NFT.' },
      { status: 409 },
    );
  }

  // Reserve the claim atomically so two staff approvals cannot both pay out.
  const reserved = await sqlQuery<Array<{ id: string }>>(
    `UPDATE quest_usdc_claims
     SET status = 'approved', reviewed_by = :staff, note = :note, updated_at = NOW()
     WHERE id = :id AND status = 'pending'
     RETURNING id`,
    { id: claimId, staff: staff.id, note },
  );
  if (reserved.length === 0) {
    return NextResponse.json({ error: 'Claim is no longer pending.' }, { status: 409 });
  }

  const amountUnits = BigInt(Math.round(Number(claim.usdc_amount) * 10 ** USDC_DECIMALS)).toString();

  try {
    const { txHashes, failed } = await blueWallet.distributeUSDC([
      { address: claim.recipient_wallet, amount: amountUnits },
    ]);

    if (failed.length > 0 || txHashes.length === 0) {
      // Payment failed — return the claim to pending so it can be retried.
      await sqlQuery(
        `UPDATE quest_usdc_claims
         SET status = 'pending', note = :note, updated_at = NOW()
         WHERE id = :id`,
        { id: claimId, note: failed[0]?.error ?? 'USDC transfer failed' },
      );
      return NextResponse.json(
        { error: failed[0]?.error ?? 'USDC transfer failed.' },
        { status: 502 },
      );
    }

    await sqlQuery(
      `UPDATE quest_usdc_claims
       SET status = 'paid', tx_hash = :tx, updated_at = NOW()
       WHERE id = :id`,
      { id: claimId, tx: txHashes[0] },
    );

    return NextResponse.json({ ok: true, claim: { status: 'paid', txHash: txHashes[0] } });
  } catch (err) {
    await sqlQuery(
      `UPDATE quest_usdc_claims
       SET status = 'pending', note = :note, updated_at = NOW()
       WHERE id = :id`,
      { id: claimId, note: err instanceof Error ? err.message : 'USDC transfer error' },
    );
    console.error('Error paying USDC claim:', err);
    return NextResponse.json({ error: 'USDC payout failed.' }, { status: 500 });
  }
}
