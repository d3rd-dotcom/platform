import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { castDisputeVote } from '@/lib/guide-disputes-db';

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

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    disputeId?: unknown;
    verdict?: unknown;
    justification?: unknown;
    originalSubject?: unknown;
    forkSubject?: unknown;
  };

  if (!body.disputeId || typeof body.disputeId !== 'string') {
    return NextResponse.json({ error: 'disputeId is required.' }, { status: 400 });
  }
  if (typeof body.verdict !== 'string') {
    return NextResponse.json({ error: 'verdict is required.' }, { status: 400 });
  }
  if (typeof body.justification !== 'string') {
    return NextResponse.json(
      { error: 'A written justification is required.' },
      { status: 400 },
    );
  }

  try {
    const result = await castDisputeVote({
      disputeId: body.disputeId,
      userId: user.id,
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
    });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
