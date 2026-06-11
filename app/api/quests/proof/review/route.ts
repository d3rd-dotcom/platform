import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery, withTransaction, sqlQueryWithClient } from '@/lib/db';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { ensureQuestProofSubmissionsSchema } from '@/lib/ensureQuestProofSubmissionsSchema';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import { getQuestDefinition } from '@/lib/quest-definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubmissionRow {
  id: string;
  user_id: string;
  quest_id: string;
  shards: number;
  proof_text: string | null;
  status: string;
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
 * GET /api/quests/proof/review
 * Staff-only. Lists pending proof submissions awaiting approval.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }
  await ensureForumSchema();
  await ensureQuestProofSubmissionsSchema();

  const gate = await requireStaff();
  if (gate.error) return gate.error;

  const rows = await sqlQuery<SubmissionRow[]>(
    `SELECT s.id, s.user_id, s.quest_id, s.shards, s.proof_text, s.status, s.note, s.created_at,
            u.username
     FROM quest_proof_submissions s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.status = 'pending'
     ORDER BY s.created_at ASC`,
  );

  return NextResponse.json({
    submissions: rows.map((r) => ({
      id: r.id,
      questId: r.quest_id,
      questTitle: questTitle(r.quest_id),
      shards: r.shards,
      proofText: r.proof_text,
      username: r.username,
      createdAt: r.created_at,
    })),
  });
}

/**
 * POST /api/quests/proof/review  { submissionId, action: 'approve' | 'reject', note? }
 * Staff-only. Reject closes the submission (the member may resubmit). Approve
 * reserves the row, then awards the quest's diamonds and writes a completion row.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }
  await ensureForumSchema();
  await ensureQuestProofSubmissionsSchema();

  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const staff = gate.user!;

  const body = await request.json().catch(() => ({}));
  const submissionId = typeof body?.submissionId === 'string' ? body.submissionId : null;
  const action = body?.action === 'approve' || body?.action === 'reject' ? body.action : null;
  const note = typeof body?.note === 'string' ? body.note.slice(0, 600) : null;

  if (!submissionId || !action) {
    return NextResponse.json({ error: 'submissionId and action are required.' }, { status: 400 });
  }

  const rows = await sqlQuery<SubmissionRow[]>(
    `SELECT id, user_id, quest_id, shards, proof_text, status, note, created_at,
            NULL AS username
     FROM quest_proof_submissions WHERE id = :id LIMIT 1`,
    { id: submissionId },
  );
  const submission = rows[0];
  if (!submission) {
    return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  }
  if (submission.status !== 'pending') {
    return NextResponse.json(
      { error: `Submission is already ${submission.status}.`, submission: { status: submission.status } },
      { status: 409 },
    );
  }

  if (action === 'reject') {
    await sqlQuery(
      `UPDATE quest_proof_submissions
       SET status = 'rejected', reviewed_by = :staff, note = :note, updated_at = NOW()
       WHERE id = :id AND status = 'pending'`,
      { id: submissionId, staff: staff.id, note },
    );
    return NextResponse.json({ ok: true, submission: { status: 'rejected' } });
  }

  // Approve: reserve the row, then award diamonds + record completion atomically.
  try {
    const awarded = await withTransaction(async (client) => {
      const reserved = await sqlQueryWithClient<Array<{ id: string; user_id: string; quest_id: string; shards: number }>>(
        client,
        `UPDATE quest_proof_submissions
         SET status = 'approved', reviewed_by = :staff, note = :note, updated_at = NOW()
         WHERE id = :id AND status = 'pending'
         RETURNING id, user_id, quest_id, shards`,
        { id: submissionId, staff: staff.id, note },
      );
      if (reserved.length === 0) {
        throw new Error('SUBMISSION_NOT_PENDING');
      }
      const row = reserved[0];

      // Don't double-pay if a completion row somehow already exists.
      const dupe = await sqlQueryWithClient<Array<{ id: string }>>(
        client,
        `SELECT id FROM quests WHERE user_id = :userId AND quest_id = :questId LIMIT 1`,
        { userId: row.user_id, questId: row.quest_id },
      );
      if (dupe.length === 0) {
        await sqlQueryWithClient(
          client,
          `UPDATE users SET shard_count = shard_count + :shards WHERE id = :id`,
          { id: row.user_id, shards: row.shards },
        );
        await sqlQueryWithClient(
          client,
          `INSERT INTO quests (id, user_id, quest_id, shards_awarded)
           VALUES (:id, :userId, :questId, :shards)`,
          { id: uuidv4(), userId: row.user_id, questId: row.quest_id, shards: row.shards },
        );
      }
      return row.shards;
    });

    return NextResponse.json({ ok: true, submission: { status: 'approved' }, shardsAwarded: awarded });
  } catch (err: any) {
    if (err?.message === 'SUBMISSION_NOT_PENDING') {
      return NextResponse.json({ error: 'Submission is no longer pending.' }, { status: 409 });
    }
    console.error('Error approving proof submission:', err);
    return NextResponse.json({ error: 'Failed to approve submission.' }, { status: 500 });
  }
}
