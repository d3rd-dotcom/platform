import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import { getVipCourses, createVipCourse } from '@/lib/vip-course-db';
import type { VipCourseRecord } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await assertCourseUser();
    const courses: VipCourseRecord[] = await getVipCourses(userId);
    return NextResponse.json({ courses });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await assertCourseUser();
    const body = await request.json() as { slug?: unknown; title?: unknown; focus?: unknown; coverImageUrl?: unknown };

    if (!body.slug || typeof body.slug !== 'string' || !body.slug.trim()) {
      return NextResponse.json({ error: 'slug is required.' }, { status: 400 });
    }
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 });
    }

    // One course per creator: every course is a surface of mintable task
    // rewards, so creators can't stamp out new ones to farm diamonds.
    // Archiving the existing course frees the slot.
    const existing = await getVipCourses(userId);
    if (existing.some((c) => c.status !== 'archived')) {
      return NextResponse.json(
        { error: 'You already have a course. Archive it before starting a new one.' },
        { status: 409 },
      );
    }

    const course = await createVipCourse({
      userId,
      slug: body.slug.trim(),
      title: body.title.trim(),
      focus: typeof body.focus === 'string' ? body.focus.trim() : '',
      coverImageUrl: typeof body.coverImageUrl === 'string' ? body.coverImageUrl : null,
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
