import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getVerifierStats } from '@/lib/verifier-prestige-db';

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
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  try {
    const stats = await getVerifierStats(user.id);
    return NextResponse.json({ stats });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
