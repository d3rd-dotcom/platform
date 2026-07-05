import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { castPanelVote } from '@/lib/guide-verification-db';

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

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    panelId?: unknown;
    decision?: unknown;
    rubricItem?: unknown;
    justification?: unknown;
  };

  if (!body.panelId || typeof body.panelId !== 'string') {
    return NextResponse.json({ error: 'panelId is required.' }, { status: 400 });
  }
  if (typeof body.decision !== 'string') {
    return NextResponse.json({ error: 'decision is required.' }, { status: 400 });
  }
  if (typeof body.rubricItem !== 'string') {
    return NextResponse.json({ error: 'rubricItem is required.' }, { status: 400 });
  }
  if (typeof body.justification !== 'string') {
    return NextResponse.json(
      { error: 'A written justification is required.' },
      { status: 400 },
    );
  }

  try {
    const result = await castPanelVote({
      panelId: body.panelId,
      userId: user.id,
      decision: body.decision as 'approve' | 'reject',
      rubricItem: body.rubricItem,
      justification: body.justification,
    });

    return NextResponse.json({
      ok: true,
      resolved: result.resolved,
      panelStatus: result.panelStatus,
      guideStatus: result.guideStatus,
    });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
