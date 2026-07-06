import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getDisputePanelsForMember } from '@/lib/guide-disputes-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/disputes/panels
 * The signed-in user's dispute-panel assignment queue: every dispute they were
 * drawn onto as a moderator, with the guide, the dispute, its status, and whether
 * they have cast a verdict. Auth via Privy cookie/JWT, mirroring the vote route.
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
    const disputes = await getDisputePanelsForMember(user.id);
    return NextResponse.json({ disputes });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
