import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getGuideBySlug } from '@/lib/guides-db';
import {
  castVote,
  getVoteTotals,
  isRubricReason,
  type VoteDirection,
} from '@/lib/guide-votes-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/[slug]/vote — public up/down totals only (no rubric breakdown).
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const guide = await getGuideBySlug(params.slug);
  if (!guide) {
    return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  }
  const totals = await getVoteTotals(guide.id);
  return NextResponse.json({ totals });
}

/**
 * POST /api/guides/[slug]/vote — cast (upsert) one vote. Auth via Privy cookie,
 * mirroring app/api/guides/progress/route.ts.
 *
 * Body: { direction: 'up' | 'down', rubricReason?: string, sectionPointer?: string }
 * Downvotes require rubricReason (DB-enforced; surfaced as 400).
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    direction?: unknown;
    rubricReason?: unknown;
    sectionPointer?: unknown;
  };

  if (body.direction !== 'up' && body.direction !== 'down') {
    return NextResponse.json(
      { error: 'direction must be "up" or "down".' },
      { status: 400 },
    );
  }
  const direction = body.direction as VoteDirection;

  const rubricReason =
    direction === 'down' && isRubricReason(body.rubricReason) ? body.rubricReason : null;
  const sectionPointer =
    direction === 'down' && typeof body.sectionPointer === 'string' ? body.sectionPointer : null;

  const guide = await getGuideBySlug(params.slug);
  if (!guide) {
    return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  }

  try {
    const result = await castVote(user.id, guide.id, direction, rubricReason, sectionPointer);
    return NextResponse.json({ ok: true, direction: result.direction, totals: result.totals });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
