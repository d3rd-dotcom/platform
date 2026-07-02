import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import { getVipCourseFullBySlug, type VipCourseFull } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Quizzes are graded server-side (POST /api/vip/courses/[id]/quiz-grade), so
 * the reader payload must not ship the answer key. The builder loads courses
 * through the owner-gated /api/vip/courses/[id] route, which keeps isCorrect.
 */
function stripQuizAnswerKey(config: Record<string, unknown>): Record<string, unknown> {
  const questions = config.questions;
  if (!Array.isArray(questions)) return config;
  return {
    ...config,
    questions: questions.map((q: Record<string, unknown>) => ({
      ...q,
      options: Array.isArray(q.options)
        ? q.options.map((o: Record<string, unknown>) => {
            const { isCorrect: _dropped, ...rest } = o;
            return rest;
          })
        : q.options,
    })),
  };
}

function stripQuizAnswers(course: VipCourseFull): VipCourseFull {
  for (const week of course.weeks) {
    for (const comp of week.components) {
      if (comp.componentType === 'quiz_block') {
        comp.config = stripQuizAnswerKey(comp.config);
      }
      for (const block of comp.blocks ?? []) {
        if (block.blockType === 'quiz_block') {
          block.config = stripQuizAnswerKey(block.config);
        }
      }
    }
  }
  return course;
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    await assertCourseUser();
    const course = await getVipCourseFullBySlug(params.slug);
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    return NextResponse.json({ course: stripQuizAnswers(course) });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
