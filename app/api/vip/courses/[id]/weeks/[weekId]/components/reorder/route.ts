import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { reorderCourseComponents } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertVipUser(): Promise<string> {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    throw Object.assign(new Error('Sign in to access courses.'), { status: 401 });
  }
  return user.id;
}

export async function PUT(request: Request, { params }: { params: { id: string; weekId: string } }) {
  try {
    await assertVipUser();
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
