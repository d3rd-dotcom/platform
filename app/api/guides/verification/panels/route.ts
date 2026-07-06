import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getPanelsForMember } from '@/lib/guide-verification-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/verification/panels
 * The signed-in user's verification-panel assignment queue: every panel they
 * were drawn onto, with the guide, the panel status, and whether they have voted.
 * Auth via Privy cookie/JWT, mirroring the vote route and verifier-test route.
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
    const panels = await getPanelsForMember(user.id);
    return NextResponse.json({ panels });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
