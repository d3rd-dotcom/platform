import { NextResponse } from 'next/server';
import { sqlQuery } from '@/lib/db';
import { ensureCourseContentSchema } from '@/lib/ensureCourseContentSchema';
import { toCourseRecord } from '@/lib/course-content-db';
import type { CourseRecord } from '@/lib/course-content-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureCourseContentSchema();

    const rows = await sqlQuery<any[]>(
      `SELECT * FROM academy_courses WHERE status = 'published' ORDER BY sort_order ASC, created_at ASC`,
    );

    const courses: CourseRecord[] = rows.map(toCourseRecord);
    return NextResponse.json({ courses });
  } catch (err: any) {
    console.error('[course-content] Error listing courses:', err);
    return NextResponse.json({ error: 'Failed to load courses.' }, { status: 500 });
  }
}
