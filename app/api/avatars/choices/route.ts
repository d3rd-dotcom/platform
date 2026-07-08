/**
 * GET /api/avatars/choices
 *
 * Returns 6 deterministically assigned toon avatars for the authenticated user.
 * All avatars are generated locally — no network calls, instant response.
 */

import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getAssignedAvatars } from '@/lib/avatars';

// Credits charged per avatar reroll. Shared with the reroll route + UI.
const REROLL_COST = 200;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Database check
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Database is not configured on the server.' },
      { status: 503 }
    );
  }
  await ensureForumSchema();

  // Authentication check
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json(
      { error: 'Not signed in. Please authenticate first.' },
      { status: 401 }
    );
  }

  try {
    const rows = await sqlQuery<Array<{ shard_count: number; avatar_reroll_count: number }>>(
      `SELECT shard_count, avatar_reroll_count FROM users WHERE id = :id`,
      { id: user.id }
    );
    const credits = rows[0]?.shard_count ?? 0;
    const rerollCount = rows[0]?.avatar_reroll_count ?? 0;

    const choices = getAssignedAvatars(user.id, rerollCount);

    return NextResponse.json({
      choices,
      currentAvatar: user.avatarUrl || null,
      credits,
      rerollCost: REROLL_COST,
    });
  } catch (error) {
    console.error('Error fetching avatar choices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch avatar choices.' },
      { status: 500 }
    );
  }
}
