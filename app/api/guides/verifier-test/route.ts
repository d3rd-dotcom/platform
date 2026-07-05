import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { requestVerifierTest, getCredentials } from '@/lib/verifier-tests-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/verifier-test — the signed-in user's own verifier credentials.
 * Auth via Privy cookie, mirroring app/api/guides/[slug]/vote and progress.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  try {
    const credentials = await getCredentials(user.id);
    return NextResponse.json({ credentials });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * POST /api/guides/verifier-test — request a tiered verifier-qualification test
 * for { subject, level }. Generates and persists a `generated_tests` row tagged
 * for verifier qualification and returns its questions for the candidate to sit.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { subject?: unknown; level?: unknown };

  try {
    const test = await requestVerifierTest(user.id, body.subject, body.level);
    return NextResponse.json({ test }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
