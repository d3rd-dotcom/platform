import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { gradeVerifierTest } from '@/lib/verifier-tests-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/guides/verifier-test/complete — submit answers for a verifier test,
 * grade it, and (on a pass) upsert the verifier credential.
 *
 * Body: { testId: string, answers: Record<questionId, string | number> }
 *
 * Grading is delegated to gradeVerifierTest in lib/verifier-tests-db, which
 * reuses the same completeness rules as app/api/generate-test/complete (every
 * question answered; short answers clear the character minimum). The credential
 * upsert and the completed_at write happen in one transaction there.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { testId?: unknown; answers?: unknown };
  const testId = typeof body.testId === 'string' ? body.testId : '';
  if (!UUID_RE.test(testId)) {
    return NextResponse.json({ error: 'A valid testId is required.' }, { status: 400 });
  }

  const answers =
    body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
      ? (body.answers as Record<string, unknown>)
      : null;
  if (!answers) {
    return NextResponse.json({ error: 'answers must be an object keyed by question id.' }, { status: 400 });
  }

  try {
    const result = await gradeVerifierTest(testId, user.id, answers);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
