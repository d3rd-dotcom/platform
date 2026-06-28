import { NextResponse } from 'next/server';
import { assertCourseOwner } from '@/lib/assert-course-auth';
import { getVipCourseFull, updateVipCourse, deleteVipCourse } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCourseOwner(params.id);
    const course = await getVipCourseFull(params.id);
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    return NextResponse.json({ course });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCourseOwner(params.id);
    const body = await request.json() as Record<string, unknown>;
    const input: Record<string, unknown> = {};

    if (body.slug !== undefined) {
      if (typeof body.slug !== 'string' || !body.slug.trim()) {
        return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
      }
      input.slug = body.slug.trim();
    }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'Invalid title.' }, { status: 400 });
      }
      input.title = body.title.trim();
    }
    if (body.focus !== undefined) {
      input.focus = typeof body.focus === 'string' ? body.focus.trim() : '';
    }
    if (body.coverImageUrl !== undefined) {
      input.coverImageUrl = typeof body.coverImageUrl === 'string' ? body.coverImageUrl : null;
    }
    if (body.status !== undefined) {
      const valid = ['draft', 'published', 'archived'];
      if (!valid.includes(body.status as string)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      input.status = body.status;
    }

    const course = await updateVipCourse(params.id, input);
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    return NextResponse.json({ course });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCourseOwner(params.id);
    const deleted = await deleteVipCourse(params.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
