import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { castDisputeVote } from '@/lib/guide-disputes-db';
import {
  disputeVoteBodySchema,
  zodErrorBody,
  type DisputeVoteResponse,
} from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/guides/disputes/vote
 * A drawn dispute-panel moderator casts a justified verdict
 * ('uphold' | 'overturn' | 'fork' | 'dismiss'). On plurality the dispute
 * resolves — a 'fork' verdict executes the spin-off. Panel membership is
 * enforced in the DB layer (403 if the caller was not drawn onto this panel).
 *
 * Auth: any authenticated user.
 * Body: { disputeId, verdict, justification, originalSubject?, forkSubject? }
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

  const parsed = disputeVoteBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(zodErrorBody(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  try {
    const result = await castDisputeVote({
      disputeId: body.disputeId,
      userId,
      verdict: body.verdict,
      justification: body.justification,
      originalSubject:
        typeof body.originalSubject === 'string' ? body.originalSubject : null,
      forkSubject: typeof body.forkSubject === 'string' ? body.forkSubject : null,
    });

    return NextResponse.json({
      ok: true,
      resolved: result.resolved,
      status: result.status,
      forkGuideId: result.forkGuideId,
    } satisfies DisputeVoteResponse);
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
