import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { runRevisionCheck } from '@/lib/guide-votes-db';
import type { RevisionCheckResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST|GET /api/guides/revision-check — the auto-revision sweep.
 *
 * Scans published guides and unpublishes any that cross a downvote-share,
 * weighted-rubric, or single-section flag-density threshold within the rolling
 * window (provided they clear the vote floor — brigade protection).
 *
 * Auth mirrors app/api/voting/proposal/review-sweep: accepts either
 * `Authorization: Bearer ${CRON_SECRET}` (Vercel cron issues GET) or
 * `x-internal-secret: ${INTERNAL_API_SECRET}` (internal calls).
 */
export async function GET(request: Request) {
  return handleRevisionCheck(request);
}

export async function POST(request: Request) {
  return handleRevisionCheck(request);
}

async function handleRevisionCheck(request: Request) {
  const authHeader = request.headers.get('authorization');
  const internalSecret = request.headers.get('x-internal-secret');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
  const isInternalAuth =
    Boolean(internalSecret) && internalSecret === process.env.INTERNAL_API_SECRET;

  if (!isCronAuth && !isInternalAuth) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const result = await runRevisionCheck();
    if (result.unpublished.length > 0) {
      console.log(
        `[guides] revision-check unpublished ${result.unpublished.length}/${result.scanned}:`,
        result.unpublished.map((u) => `${u.slug} (${u.reasons.join(', ')})`).join('; '),
      );
    }
    return NextResponse.json({ ok: true, ...result } satisfies RevisionCheckResponse);
  } catch (error) {
    console.error('[guides] revision-check failed:', error);
    return NextResponse.json({ error: 'Revision check failed.' }, { status: 500 });
  }
}
