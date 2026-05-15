import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQueryWithClient, withTransaction } from '@/lib/db';
import { ensureGeneratedTestsSchema } from '@/lib/ensureGeneratedTestsSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hasEnoughAnswers(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const answers = Object.values(value as Record<string, unknown>);
  return answers.length >= 8 && answers.every((answer) => (
    typeof answer === 'string'
      ? answer.trim().length > 0
      : typeof answer === 'number' && Number.isFinite(answer)
  ));
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const testId = typeof body?.testId === 'string' ? body.testId : '';

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(testId)) {
    return NextResponse.json({ error: 'Valid test ID is required.' }, { status: 400 });
  }

  if (!hasEnoughAnswers(body?.answers)) {
    return NextResponse.json({ error: 'Complete all questions before submitting.' }, { status: 400 });
  }

  await ensureGeneratedTestsSchema();

  try {
    const result = await withTransaction(async (client) => {
      // Rate limit: only one survey may be completed per user per week.
      const recentRows = await sqlQueryWithClient<Array<{ id: string }>>(
        client,
        `SELECT id
         FROM generated_tests
         WHERE user_id = :userId
           AND id <> :testId
           AND completed_at IS NOT NULL
           AND completed_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
         LIMIT 1`,
        { userId: user.id, testId }
      );

      if (recentRows.length > 0) {
        throw new Error('WEEKLY_LIMIT');
      }

      const testRows = await sqlQueryWithClient<Array<{ shard_reward: number }>>(
        client,
        `UPDATE generated_tests
         SET completed_at = CURRENT_TIMESTAMP
         WHERE id = :testId
           AND user_id = :userId
           AND completed_at IS NULL
         RETURNING shard_reward`,
        { testId, userId: user.id }
      );

      if (testRows.length === 0) {
        throw new Error('TEST_UNAVAILABLE');
      }

      const shardReward = Math.max(0, Number(testRows[0].shard_reward) || 0);
      const userRows = await sqlQueryWithClient<Array<{ shard_count: number }>>(
        client,
        `UPDATE users
         SET shard_count = COALESCE(shard_count, 0) + :shardReward
         WHERE id = :userId
         RETURNING shard_count`,
        { userId: user.id, shardReward }
      );

      return {
        shardsAwarded: shardReward,
        newShardCount: userRows[0]?.shard_count ?? user.shardCount + shardReward,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === 'WEEKLY_LIMIT') {
      return NextResponse.json(
        { error: 'You already earned shards from a survey this week. Come back next week for another.' },
        { status: 429 }
      );
    }

    if (error instanceof Error && error.message === 'TEST_UNAVAILABLE') {
      return NextResponse.json({ error: 'Test already completed or not linked to this account.' }, { status: 409 });
    }

    console.error('generate-test complete error:', error);
    return NextResponse.json({ error: 'Failed to award shards.' }, { status: 500 });
  }
}
