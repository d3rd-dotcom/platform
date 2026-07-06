import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { getGuideBySlug } from '@/lib/guides-db';
import {
  castVote,
  getVoteTotals,
  isRubricReason,
  type VoteDirection,
} from '@/lib/guide-votes-db';
import {
  voteBodySchema,
  zodErrorBody,
  type VoteTotalsResponse,
  type VoteCastResponse,
} from '@/lib/guide-api-schemas';

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
  return NextResponse.json({ totals } satisfies VoteTotalsResponse);
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
  let userId: string;
  try {
    ({ userId } = await requireUser(request));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const parsed = voteBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(zodErrorBody(parsed.error), { status: 400 });
  }
  const body = parsed.data;

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
    const result = await castVote(userId, guide.id, direction, rubricReason, sectionPointer);
    return NextResponse.json(
      { ok: true, direction: result.direction, totals: result.totals } satisfies VoteCastResponse,
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
