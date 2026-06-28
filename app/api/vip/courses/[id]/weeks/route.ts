import { NextResponse } from 'next/server';
import { assertCourseOwner } from '@/lib/assert-course-auth';
import { createCourseWeek } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertCourseOwner(params.id);
    const body = await request.json() as { weekNumber?: unknown; title?: unknown; theme?: unknown; sortOrder?: unknown };

    if (body.weekNumber === undefined || typeof body.weekNumber !== 'number') {
      return NextResponse.json({ error: 'weekNumber is required and must be a number.' }, { status: 400 });
    }
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 });
    }

    const week = await createCourseWeek({
      courseId: params.id,
      weekNumber: body.weekNumber,
      title: body.title.trim(),
      theme: typeof body.theme === 'string' ? body.theme.trim() : '',
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
    });

    return NextResponse.json({ week }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
