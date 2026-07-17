import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { checkCourseAccess } from '@/lib/course-access';
import { sqlQuery } from '@/lib/db';
import { ensureCourseContentSchema } from '@/lib/ensureCourseContentSchema';
import { toCourseRecord, toChapterRecord, toLessonRecord } from '@/lib/course-content-db';
import type { CourseRecord, ChapterRecord, LessonRecord } from '@/lib/course-content-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    await ensureCourseContentSchema();

    const courseRows = await sqlQuery<any[]>(
      `SELECT * FROM academy_courses WHERE slug = :slug AND status = 'published' LIMIT 1`,
      { slug: params.slug },
    );

    if (!courseRows[0]) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const course: CourseRecord = toCourseRecord(courseRows[0]);
    const user = await getCurrentUserFromRequestCookie();
    const access = await checkCourseAccess(course.tokenGate, user?.walletAddress);
    // A non-empty but unknown gate must fail closed. checkCourseAccess returns
    // an empty parsed gate for unknown values, which is safe for public callers
    // only when the stored token_gate itself is empty.
    const granted = course.tokenGate
      ? access.granted && Boolean(access.gate)
      : access.granted;

    if (!granted) {
      return NextResponse.json(
        {
          error: 'Course access required.',
          granted: false,
          gate: access.gate,
          tokenGate: course.tokenGate,
        },
        { status: 403 },
      );
    }

    const chapterRows = await sqlQuery<any[]>(
      `SELECT * FROM academy_chapters
       WHERE course_id = :courseId AND status = 'published'
       ORDER BY sort_order ASC`,
      { courseId: course.id },
    );

    const chapters: Array<ChapterRecord & { lessons: LessonRecord[] }> = [];

    for (const chapterRow of chapterRows) {
      const chapter = toChapterRecord(chapterRow);
      const lessonRows = await sqlQuery<any[]>(
        `SELECT * FROM academy_lessons
         WHERE chapter_id = :chapterId AND status = 'published'
         ORDER BY sort_order ASC`,
        { chapterId: chapter.id },
      );
      chapters.push({ ...chapter, lessons: lessonRows.map(toLessonRecord) });
    }

    return NextResponse.json({ course, chapters });
  } catch (err: any) {
    console.error('[course-content] Error fetching course:', err);
    return NextResponse.json({ error: 'Failed to load course.' }, { status: 500 });
  }
}
