import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { requireUser } from '@/lib/guide-api-auth';
import { castPanelVote } from '@/lib/guide-verification-db';
import {
  verificationVoteBodySchema,
  zodErrorBody,
  type VerificationVoteResponse,
} from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/guides/verification/vote
 * A drawn panel member casts a rubric-bound, justified approve/reject vote.
 * On majority, the panel resolves and the guide is published (approve) or sent
 * back to draft (reject). See lib/guide-verification-db.ts castPanelVote.
 *
 * Auth: any authenticated user; membership on the panel is enforced in the DB
 * layer (403 if the caller was not drawn onto this panel).
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

  const parsed = verificationVoteBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(zodErrorBody(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  try {
    const result = await castPanelVote({
      panelId: body.panelId,
      userId,
      decision: body.decision as 'approve' | 'reject',
      rubricItem: body.rubricItem,
      justification: body.justification,
    });

    return NextResponse.json({
      ok: true,
      resolved: result.resolved,
      panelStatus: result.panelStatus,
      guideStatus: result.guideStatus,
    } satisfies VerificationVoteResponse);
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
