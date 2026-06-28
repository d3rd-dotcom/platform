import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import { getVipCourseFullBySlug } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    await assertCourseUser();
    const course = await getVipCourseFullBySlug(params.slug);
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    return NextResponse.json({ course });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
