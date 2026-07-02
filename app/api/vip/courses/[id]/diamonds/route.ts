import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, withTransaction } from '@/lib/db';
import { getVipCourseFull } from '@/lib/vip-course-db';
import { deliverDiamondsOnchain } from '@/lib/diamonds-onchain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPLETION_REWARD = 50;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await request.json();
  const { componentId } = body;

  if (!componentId || typeof componentId !== 'string') {
    return NextResponse.json({ error: 'Missing componentId.' }, { status: 400 });
  }

  const course = await getVipCourseFull(params.id);
  if (!course) {
    return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
  }

  let component: (typeof course.weeks)[number]['components'][number] | undefined;
  let weekId: string | undefined;
  for (const week of course.weeks) {
    const found = week.components.find((c) => c.id === componentId);
    if (found) {
      component = found;
      weekId = week.id;
      break;
    }
  }
  if (!component || !weekId) {
    return NextResponse.json({ error: 'Component not found in this course.' }, { status: 404 });
  }
  if (component.componentType === 'rich_text' && component.title === 'Weekly Read') {
    return NextResponse.json({ error: 'The Weekly Read is not a rewardable task.' }, { status: 400 });
  }

  const requiredIds = component.componentType === 'mission_container' && component.blocks.length > 0
    ? component.blocks.map((b) => b.id)
    : [component.id];

  const result = await withTransaction(async (client) => {
    const progress = await client.query(
      `SELECT completed_component_ids FROM vip_progress WHERE user_id = $1 AND course_id = $2 AND week_id = $3`,
      [user.id, params.id, weekId],
    );
    const completed = new Set<string>((progress.rows[0]?.completed_component_ids as string[] | undefined) ?? []);
    if (!requiredIds.every((id) => completed.has(id))) {
      return { status: 400, error: 'Task is not complete yet.' };
    }

    const claim = await client.query(
      `INSERT INTO vip_diamond_claims (user_id, course_id, component_id, shards)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, component_id) DO NOTHING
       RETURNING id`,
      [user.id, params.id, componentId, COMPLETION_REWARD],
    );
    if (claim.rows.length === 0) {
      return { status: 409, error: 'Reward already claimed for this task.' };
    }

    await client.query(
      `UPDATE users SET shard_count = shard_count + $1 WHERE id = $2`,
      [COMPLETION_REWARD, user.id],
    );
    return { status: 200 };
  });

  if (result.status !== 200) {
    return NextResponse.json({ rewarded: false, error: result.error }, { status: result.status });
  }

  // Deliver the claim onchain — Blue's CDP wallet mints $BLUE to the user.
  // Fail-soft: the in-app reward stands even if the chain is unreachable.
  const onchain = await deliverDiamondsOnchain({
    userId: user.id,
    walletAddress: user.walletAddress,
    source: 'course_task',
    refId: componentId,
    amount: COMPLETION_REWARD,
    delivery: 'cdp_mint',
  });

  return NextResponse.json({
    rewarded: true,
    diamondsAwarded: COMPLETION_REWARD,
    shardsAwarded: COMPLETION_REWARD,
    onchain: onchain.delivered ? { txHash: onchain.txHash } : null,
  });
}
