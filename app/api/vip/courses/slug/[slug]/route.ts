import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getVipCourseFullBySlug } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const user = await getCurrentUserFromRequestCookie();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to access courses.' }, { status: 401 });
    }

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
