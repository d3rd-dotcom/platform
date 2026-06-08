/**
 * POST /api/avatars/reroll
 *
 * Spends REROLL_COST credits to shift the user to a fresh set of 6 avatar
 * options. The deduction and reroll-count bump happen in one transaction so a
 * user is never charged without getting new choices (and vice versa).
 */

import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, withTransaction, sqlQueryWithClient } from '@/lib/db';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { getAssignedAvatars } from '@/lib/avatars';
import { REROLL_COST } from '../choices/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
  }
  await ensureForumSchema();

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in. Please authenticate first.' }, { status: 401 });
  }

  // Rate limit: 20 rerolls per hour per user.
  const rl = checkRateLimit({ max: 20, windowMs: 60 * 60 * 1000, identifier: `avatar-reroll:${user.id}` });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: getRateLimitHeaders(rl) });
  }

  try {
    const result = await withTransaction(async (client) => {
      // Atomically deduct credits and bump the reroll generation. The WHERE
      // guard means no row comes back if the user can't afford it.
      const rows = await sqlQueryWithClient<Array<{ shard_count: number; avatar_reroll_count: number }>>(
        client,
        `UPDATE users
         SET shard_count = shard_count - :cost,
             avatar_reroll_count = avatar_reroll_count + 1
         WHERE id = :id AND shard_count >= :cost
         RETURNING shard_count, avatar_reroll_count`,
        { id: user.id, cost: REROLL_COST }
      );
      return rows[0] ?? null;
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Insufficient diamonds', message: `Rerolling costs ${REROLL_COST} diamonds.` },
        { status: 402 }
      );
    }

    const choices = getAssignedAvatars(user.id, result.avatar_reroll_count);

    return NextResponse.json({
      ok: true,
      choices,
      credits: result.shard_count,
      rerollCost: REROLL_COST,
    });
  } catch (error) {
    console.error('Error rerolling avatars:', error);
    return NextResponse.json({ error: 'Failed to reroll avatars.' }, { status: 500 });
  }
}
