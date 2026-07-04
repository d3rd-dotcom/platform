import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensurePrayersSchema } from '@/lib/ensurePrayersSchema';
import { decryptForUser } from '@/lib/encrypt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/daily-notes/count
 * Number of written field notes for the signed-in user — count only, the
 * contents stay sealed behind the burn-to-unseal flow.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ count: 0 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  await ensurePrayersSchema();

  const rows = await sqlQuery<Array<{ progress_data: any }>>(
    `SELECT progress_data FROM prayers
     WHERE user_id = :userId
     LIMIT 1`,
    { userId: user.id }
  );

  if (rows.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  let allWeekPages: Record<string, Array<{ content?: string }>> = {};
  try {
    const pd = rows[0].progress_data;
    if (pd?.encrypted && pd?.data) {
      allWeekPages = JSON.parse(decryptForUser(user.id, pd.data)).allWeekPages ?? {};
    } else {
      allWeekPages = pd?.allWeekPages ?? {};
    }
  } catch {
    return NextResponse.json({ count: 0 });
  }

  let count = 0;
  for (const entries of Object.values(allWeekPages)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (typeof entry?.content === 'string' && entry.content.trim().length > 0) count++;
    }
  }

  return NextResponse.json({ count });
}
