import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { completeGuide, getUserGuideProgress } from '@/lib/guides-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const completed = await getUserGuideProgress(user.id);
  return NextResponse.json({ completedGuideIds: Array.from(completed) });
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { guideId?: unknown };
  if (!body.guideId || typeof body.guideId !== 'string') {
    return NextResponse.json({ error: 'guideId is required.' }, { status: 400 });
  }

  try {
    // completeGuide enforces the gate server-side: all direct prereqs must be
    // completed by this user, otherwise it throws with .status = 409.
    const result = await completeGuide(user.id, body.guideId);
    return NextResponse.json({ ok: true, completedAt: result.completedAt });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
