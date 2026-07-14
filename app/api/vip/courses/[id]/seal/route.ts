import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, withTransaction } from '@/lib/db';
import { getVipCourseFull, getRequiredTaskIds } from '@/lib/vip-course-db';
import { deliverDiamondsOnchain } from '@/lib/diamonds-onchain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Kept in line with the main pathway week seal: the prestige is the sealed
// week itself, not the token. A small, fixed diamond bonus on top of the
// 50-per-task rewards.
const SEAL_REWARD = 100;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await request.json();
  const { weekId } = body;

  if (!weekId) {
    return NextResponse.json({ error: 'Missing weekId.' }, { status: 400 });
  }

  const course = await getVipCourseFull(params.id);
  if (!course) {
    return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
  }
  // Same gates as task claims: live courses only, never the author.
  if (course.status !== 'published') {
    return NextResponse.json({ error: 'Rewards unlock when the course is published.' }, { status: 403 });
  }
  if (course.userId === user.id) {
    return NextResponse.json({ error: 'Course authors cannot claim rewards on their own course.' }, { status: 403 });
  }

  const week = course.weeks.find((w) => w.id === weekId);
  if (!week) {
    return NextResponse.json({ error: 'Week not found.' }, { status: 404 });
  }

  const requiredIds = getRequiredTaskIds(week);
  if (requiredIds.length === 0) {
    return NextResponse.json({ error: 'This week has no completable tasks.' }, { status: 400 });
  }

  const result = await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT * FROM vip_progress WHERE user_id = $1 AND course_id = $2 AND week_id = $3`,
      [user.id, params.id, weekId],
    );

    if (existing.rows.length > 0 && existing.rows[0].is_sealed) {
      return { alreadySealed: true, shardsAwarded: 0, incomplete: false };
    }

    const completed = new Set<string>((existing.rows[0]?.completed_component_ids as string[] | undefined) ?? []);
    if (!requiredIds.every((id) => completed.has(id))) {
      return { alreadySealed: false, shardsAwarded: 0, incomplete: true };
    }

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE vip_progress SET is_sealed = true, sealed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [existing.rows[0].id],
      );
    } else {
      await client.query(
        `INSERT INTO vip_progress (user_id, course_id, week_id, is_sealed, sealed_at)
         VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)`,
        [user.id, params.id, weekId],
      );
    }

    await client.query(
      `UPDATE users SET shard_count = shard_count + $1 WHERE id = $2`,
      [SEAL_REWARD, user.id],
    );

    return { alreadySealed: false, shardsAwarded: SEAL_REWARD, incomplete: false };
  });

  if (result.alreadySealed) {
    return NextResponse.json({ error: 'Week already sealed.', alreadySealed: true }, { status: 409 });
  }
  if (result.incomplete) {
    return NextResponse.json({ error: 'Complete every task in this week before sealing it.' }, { status: 400 });
  }

  // Deliver the seal bonus onchain — Blue sends it from her own stash (fail-soft).
  const onchain = await deliverDiamondsOnchain({
    userId: user.id,
    walletAddress: user.walletAddress,
    source: 'course_seal',
    refId: weekId,
    amount: SEAL_REWARD,
    delivery: 'blue_transfer',
  });

  return NextResponse.json({
    sealed: true,
    diamondsAwarded: result.shardsAwarded,
    shardsAwarded: result.shardsAwarded,
    onchain: onchain.delivered ? { txHash: onchain.txHash } : null,
  });
}
