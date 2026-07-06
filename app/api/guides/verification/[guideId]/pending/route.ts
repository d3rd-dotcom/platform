import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { optionalUser } from '@/lib/guide-api-auth';
import { countPendingPanelVotesForGuide } from '@/lib/guide-verification-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/verification/[guideId]/pending
 * How many OPEN verification panels for this guide the signed-in viewer was drawn
 * onto and has not yet voted on. Powers the "votes awaiting" pill on the guide
 * page's verification log. Returns { pending: 0 } for anonymous viewers (200, not
 * 401) so the log renders cleanly whether or not someone is signed in.
 */
export async function GET(
  _request: Request,
  { params }: { params: { guideId: string } },
) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await optionalUser();
  if (!user) {
    return NextResponse.json({ pending: 0 });
  }

  try {
    const pending = await countPendingPanelVotesForGuide(params.guideId, user.userId);
    return NextResponse.json({ pending });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
