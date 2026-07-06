import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { requestVerifierTest, getCredentials } from '@/lib/verifier-tests-db';
import {
  verifierTestRequestBodySchema,
  zodErrorBody,
  type VerifierCredentialsResponse,
  type VerifierTestResponse,
} from '@/lib/guide-api-schemas';

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
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }
  try {
    const credentials = await getCredentials(userId);
    return NextResponse.json({ credentials } satisfies VerifierCredentialsResponse);
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
  let userId: string;
  try {
    ({ userId } = await requireUser(request));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const parsed = verifierTestRequestBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(zodErrorBody(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  try {
    const test = await requestVerifierTest(userId, body.subject, body.level);
    return NextResponse.json({ test } satisfies VerifierTestResponse, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
