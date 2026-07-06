import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { getVerifierStats } from '@/lib/verifier-prestige-db';
import type { VerifierStatsResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/verifier-test/stats — the signed-in user's own verifier
 * prestige stats (credentials, panels served, votes cast, upheld rate).
 * Auth via Privy cookie, mirroring the sibling verifier-test route.
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
    const stats = await getVerifierStats(userId);
    return NextResponse.json({ stats } satisfies VerifierStatsResponse);
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
