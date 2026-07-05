import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { openDispute, getDisputes } from '@/lib/guide-disputes-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/disputes?guideId=...
 * PUBLIC list of disputes on a guide (type, status, resolution note, tally).
 * No auth — dispute history is transparent by design.
 */
export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const guideId = new URL(request.url).searchParams.get('guideId');
  if (!guideId) {
    return NextResponse.json({ error: 'guideId is required.' }, { status: 400 });
  }

  try {
    const disputes = await getDisputes(guideId);
    return NextResponse.json({ disputes });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * POST /api/guides/disputes
 * Opens a dispute against a guide. Auth mirrors app/api/guides/progress
 * (getCurrentUserFromRequestCookie). The standing gate, evidence-length rule and
 * spam guard are enforced in lib/guide-disputes-db.ts openDispute.
 *
 * Body: { guideId, disputeType, evidence }
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    guideId?: unknown;
    disputeType?: unknown;
    evidence?: unknown;
  };

  if (!body.guideId || typeof body.guideId !== 'string') {
    return NextResponse.json({ error: 'guideId is required.' }, { status: 400 });
  }
  if (typeof body.disputeType !== 'string') {
    return NextResponse.json({ error: 'disputeType is required.' }, { status: 400 });
  }
  if (typeof body.evidence !== 'string') {
    return NextResponse.json({ error: 'evidence is required.' }, { status: 400 });
  }

  try {
    const result = await openDispute({
      guideId: body.guideId,
      openerId: user.id,
      disputeType: body.disputeType,
      evidence: body.evidence,
    });
    return NextResponse.json(
      {
        ok: true,
        dispute: result.dispute,
        panelMemberCount: result.memberIds.length,
      },
      { status: 201 },
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
