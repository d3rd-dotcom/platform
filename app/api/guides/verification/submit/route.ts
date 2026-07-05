import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { submitGuideForVerification } from '@/lib/guide-verification-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/guides/verification/submit
 * Author submits their own DRAFT guide for verification. Draws an odd-numbered
 * verifier panel and flips the guide to `pending_verification`.
 *
 * Auth mirrors the guide-authoring routes (assertCourseUser). Ownership is
 * enforced here: a user may only submit a guide they authored.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const userId = await assertCourseUser();

    const body = (await request.json().catch(() => ({}))) as { guideId?: unknown };
    if (!body.guideId || typeof body.guideId !== 'string') {
      return NextResponse.json({ error: 'guideId is required.' }, { status: 400 });
    }

    // Ownership check — only the author may submit their draft.
    const rows = await sqlQuery<Array<{ author_id: string | null }>>(
      `SELECT author_id FROM guides WHERE id = :guideId`,
      { guideId: body.guideId },
    );
    if (!rows[0]) {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }
    if (rows[0].author_id !== userId) {
      return NextResponse.json(
        { error: 'Only the author can submit this guide for verification.' },
        { status: 403 },
      );
    }

    const panel = await submitGuideForVerification(body.guideId);

    // Fire-and-forget: kick the CRE guide-review advisory workflow. In production
    // the DON also picks this up from the guide-verification submission; this
    // local trigger keeps the advisory score fresh even without the on-chain path.
    // Failures are non-fatal — the panel can proceed without the advisory score.
    void triggerCreReview(request, body.guideId, panel.id);

    return NextResponse.json(
      {
        ok: true,
        panelId: panel.id,
        memberCount: panel.memberIds.length,
        status: panel.status,
      },
      { status: 201 },
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * Notify the CRE score callback that a new panel needs an advisory score.
 * The actual AI scoring happens in cre-workflows/guide-review (DON) or via the
 * server-side fallback the callback route performs. We just signal it here.
 */
async function triggerCreReview(request: Request, guideId: string, panelId: string): Promise<void> {
  try {
    const baseUrl = request.url.split('/api')[0];
    await fetch(`${baseUrl}/api/guides/verification/cre-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cre-callback-secret': process.env.CRE_CALLBACK_SECRET || process.env.INTERNAL_API_SECRET || '',
        'x-cre-trigger': 'server',
      },
      body: JSON.stringify({ guideId, panelId, trigger: true }),
    });
  } catch (e) {
    console.error('CRE advisory trigger failed (non-fatal):', e);
  }
}
