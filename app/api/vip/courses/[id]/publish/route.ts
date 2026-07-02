import { NextResponse } from 'next/server';
import { assertCourseOwner } from '@/lib/assert-course-auth';
import { getVipCourseFull, updateVipCourse } from '@/lib/vip-course-db';
import { validateCourseContent } from '@/lib/course-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCourseOwner(params.id);

    const course = await getVipCourseFull(params.id);
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const issues = validateCourseContent(course.weeks);
    if (issues.length > 0) {
      return NextResponse.json(
        { error: 'Course is not ready to publish.', issues },
        { status: 400 },
      );
    }

    const updated = await updateVipCourse(params.id, { status: 'published' });
    if (!updated) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    return NextResponse.json({ course: updated });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
