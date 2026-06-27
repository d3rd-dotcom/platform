import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { updateCourseWeek, deleteCourseWeek } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertVipUser(): Promise<string> {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    throw Object.assign(new Error('Sign in to access courses.'), { status: 401 });
  }
  return user.id;
}

export async function PATCH(request: Request, { params }: { params: { id: string; weekId: string } }) {
  try {
    await assertVipUser();
    const body = await request.json() as Record<string, unknown>;
    const input: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'Invalid title.' }, { status: 400 });
      }
      input.title = body.title.trim();
    }
    if (body.theme !== undefined) {
      input.theme = typeof body.theme === 'string' ? body.theme.trim() : '';
    }
    if (body.weekNumber !== undefined) {
      if (typeof body.weekNumber !== 'number') {
        return NextResponse.json({ error: 'Invalid weekNumber.' }, { status: 400 });
      }
      input.weekNumber = body.weekNumber;
    }
    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== 'number') {
        return NextResponse.json({ error: 'Invalid sortOrder.' }, { status: 400 });
      }
      input.sortOrder = body.sortOrder;
    }
    if (body.status !== undefined) {
      const valid = ['draft', 'published', 'archived'];
      if (!valid.includes(body.status as string)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      input.status = body.status;
    }

    const week = await updateCourseWeek(params.weekId, input);
    if (!week) {
      return NextResponse.json({ error: 'Week not found.' }, { status: 404 });
    }
    return NextResponse.json({ week });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string; weekId: string } }) {
  try {
    await assertVipUser();
    const deleted = await deleteCourseWeek(params.weekId);
    if (!deleted) {
      return NextResponse.json({ error: 'Week not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
