import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getVipProgress, upsertVipProgress } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const progress = await getVipProgress(user.id, params.id);
  return NextResponse.json({ progress });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await request.json();
  const { weekId, completedComponentIds, componentData, isSealed } = body;

  if (!weekId) {
    return NextResponse.json({ error: 'Missing weekId.' }, { status: 400 });
  }

  const record = await upsertVipProgress(user.id, params.id, weekId, {
    completedComponentIds,
    componentData,
    isSealed,
  });

  return NextResponse.json({ progress: record });
}
