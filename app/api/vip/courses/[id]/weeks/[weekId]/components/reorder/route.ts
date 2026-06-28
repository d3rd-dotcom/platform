import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import { reorderCourseComponents } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { id: string; weekId: string } }) {
  try {
    await assertCourseUser();
    const body = await request.json() as { orderedIds?: unknown };

    if (!Array.isArray(body.orderedIds) || !body.orderedIds.every((id): id is string => typeof id === 'string')) {
      return NextResponse.json({ error: 'orderedIds must be a string array of component IDs.' }, { status: 400 });
    }

    const components = await reorderCourseComponents(params.weekId, body.orderedIds);
    return NextResponse.json({ components });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
