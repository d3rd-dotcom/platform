import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { openDispute, getDisputes } from '@/lib/guide-disputes-db';
import {
  openDisputeBodySchema,
  zodErrorBody,
  type DisputesListResponse,
  type DisputeOpenResponse,
} from '@/lib/guide-api-schemas';

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
    return NextResponse.json({ disputes } satisfies DisputesListResponse);
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * POST /api/guides/disputes
 * Opens a dispute against a guide. Auth mirrors app/api/guides/progress
 * (requireUser). The standing gate, evidence-length rule and
 * spam guard are enforced in lib/guide-disputes-db.ts openDispute.
 *
 * Body: { guideId, disputeType, evidence }
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  let userId: string;
  try {
    ({ userId } = await requireUser(request));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const parsed = openDisputeBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(zodErrorBody(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  try {
    const result = await openDispute({
      guideId: body.guideId,
      openerId: userId,
      disputeType: body.disputeType,
      evidence: body.evidence,
    });
    return NextResponse.json(
      {
        ok: true,
        dispute: result.dispute,
        panelMemberCount: result.memberIds.length,
      } satisfies DisputeOpenResponse,
      { status: 201 },
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
