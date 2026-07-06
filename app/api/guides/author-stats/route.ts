import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { listGuides, getAuthorGuideStats } from '@/lib/guides-db';
import type { AuthorStatsResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const authored = await listGuides({ authorId: userId });
  if (authored.length === 0) {
    return NextResponse.json({
      totalAuthored: 0,
      publishedCount: 0,
      draftCount: 0,
      inReviewCount: 0,
      totalLearnerCompletions: 0,
      totalUpvotes: 0,
      totalDownvotes: 0,
      guides: [],
    } satisfies AuthorStatsResponse);
  }

  const stats = await getAuthorGuideStats(userId);
  return NextResponse.json(stats satisfies AuthorStatsResponse);
}
