import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import { matchTemplate } from '@/lib/course-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await assertCourseUser();

    const body = await request.json().catch(() => ({})) as { prompt?: unknown };
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return NextResponse.json({ error: 'Tell Blue what course you want to create.' }, { status: 400 });
    }

    const course = matchTemplate(prompt);
    return NextResponse.json({ course });
  } catch (err: any) {
    console.error('[vip/courses/generate] error:', err);
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message ?? 'Course generation failed.' }, { status });
  }
}
