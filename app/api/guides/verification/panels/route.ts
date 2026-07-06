import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { requireUser } from '@/lib/guide-api-auth';
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

  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  try {
    const panels = await getPanelsForMember(userId);
    return NextResponse.json({ panels });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
