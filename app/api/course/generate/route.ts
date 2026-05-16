import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getPersonalCourse, saveGeneratedCourse, saveIntake } from '@/lib/personal-course-db';
import { buildCourse } from '@/lib/personal-course';
import type { IntakeAnswers } from '@/lib/personal-course';

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

export async function POST(request: Request) {
  let body: { answers?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // body optional for signed-in users with saved intake
  }
  const inlineAnswers = parseAnswers(body.answers);

  let userId: string | null = null;
  if (isDbConfigured()) {
    try {
      const user = await getCurrentUserFromRequestCookie();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  // ── Signed-in: persist ──
  if (userId) {
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
