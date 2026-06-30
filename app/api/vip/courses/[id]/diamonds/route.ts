import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';

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

  if (!componentId) {
    return NextResponse.json({ error: 'Missing componentId.' }, { status: 400 });
  }

  await sqlQuery(
    `UPDATE users SET shard_count = shard_count + $1 WHERE id = $2`,
    [COMPLETION_REWARD, user.id],
  );

  return NextResponse.json({
    rewarded: true,
    shardsAwarded: COMPLETION_REWARD,
  });
}
