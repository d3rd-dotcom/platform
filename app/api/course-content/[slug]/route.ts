import { NextResponse } from 'next/server';
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

    const chapterRows = await sqlQuery<any[]>(
      `SELECT * FROM academy_chapters WHERE course_id = :courseId ORDER BY sort_order ASC`,
      { courseId: course.id },
    );

    const chapters: Array<ChapterRecord & { lessons: LessonRecord[] }> = [];

    for (const chapterRow of chapterRows) {
      const chapter = toChapterRecord(chapterRow);
      const lessonRows = await sqlQuery<any[]>(
        `SELECT * FROM academy_lessons WHERE chapter_id = :chapterId ORDER BY sort_order ASC`,
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
