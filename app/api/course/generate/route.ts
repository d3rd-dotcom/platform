import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getPersonalCourse, saveGeneratedCourse, saveIntake } from '@/lib/personal-course-db';
import { walletHasMembershipAccess } from '@/lib/membership-access';
import { buildCourse } from '@/lib/personal-course';
import type { IntakeAnswers, CourseData } from '@/lib/personal-course';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseAnswers(raw: unknown): IntakeAnswers {
  const answers: IntakeAnswers = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        answers[key.slice(0, 64)] = value.trim().slice(0, 4000);
      }
    }
  }
  return answers;
}

function isValidCourseData(data: unknown): data is CourseData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.title === 'string' &&
    typeof d.focus === 'string' &&
    Array.isArray(d.weeks) &&
    (d.weeks as unknown[]).length === 4
  );
}

export async function POST(request: Request) {
  let body: { answers?: unknown; courseData?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // body optional for signed-in users with saved intake
  }
  const inlineAnswers = parseAnswers(body.answers);
  const prebuiltCourse = isValidCourseData(body.courseData) ? body.courseData : null;

  let userId: string | null = null;
  let userWallet: string | null = null;
  if (isDbConfigured()) {
    try {
      const user = await getCurrentUserFromRequestCookie();
      userId = user?.id ?? null;
      userWallet = user?.walletAddress ?? null;
    } catch {
      userId = null;
    }
  }

  // ── Signed-in: persist ──
  if (userId) {
    // Path A: pre-built course data from Blue's course builder.
    // Building a real course is a VIP-membership perk — gate the save fail-closed.
    if (prebuiltCourse) {
      const hasMembership = await walletHasMembershipAccess(userWallet);
      if (!hasMembership) {
        return NextResponse.json(
          { error: 'A VIP membership is required to build a course.', code: 'vip_required' },
          { status: 403 },
        );
      }
      const syntheticIntake: IntakeAnswers = { goal: prebuiltCourse.focus, source: 'blue-generated' };
      await saveIntake(userId, syntheticIntake);
      const course = await saveGeneratedCourse(userId, prebuiltCourse);
      return NextResponse.json({ course });
    }

    // Path B: classic intake answers
    const existing = await getPersonalCourse(userId);
    let intake: IntakeAnswers = existing?.intakeData ?? {};
    if (Object.keys(inlineAnswers).length) {
      intake = inlineAnswers;
      await saveIntake(userId, inlineAnswers);
    }
    if (Object.keys(intake).length === 0) {
      return NextResponse.json(
        { error: 'no_intake', message: 'Complete the intake first.' },
        { status: 400 }
      );
    }
    const courseData = buildCourse(intake);
    const course = await saveGeneratedCourse(userId, courseData);
    return NextResponse.json({ course });
  }

  // ── Guest: ephemeral course ──
  if (prebuiltCourse) {
    return NextResponse.json({
      course: { status: 'ready', intakeData: {}, courseData: prebuiltCourse, progressData: {} },
      guest: true,
    });
  }
  if (Object.keys(inlineAnswers).length === 0) {
    return NextResponse.json(
      { error: 'no_intake', message: 'Complete the intake first.' },
      { status: 400 }
    );
  }
  const courseData = buildCourse(inlineAnswers);
  return NextResponse.json({
    course: { status: 'ready', intakeData: inlineAnswers, courseData, progressData: {} },
    guest: true,
  });
}
