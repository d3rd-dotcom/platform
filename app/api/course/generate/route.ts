import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import {
  getPersonalCourse,
  markGenerating,
  saveGeneratedCourse,
  saveIntake,
} from '@/lib/personal-course-db';
import { generateCourse } from '@/lib/personal-course';
import type { IntakeAnswers } from '@/lib/personal-course';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function parseAnswers(raw: unknown): IntakeAnswers {
  const answers: IntakeAnswers = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        answers[key.slice(0, 64)] = value.trim().slice(0, 2000);
      }
    }
  }
  return answers;
}

export async function POST(request: Request) {
  // Generation is expensive and available without an account — rate limit it.
  const rl = checkRateLimit({
    max: 6,
    windowMs: 10 * 60 * 1000,
    identifier: `course-generate:${getClientIdentifier(request)}`,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many course builds. Try again in a few minutes.' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  // No hard AI-key requirement: generateCourse falls back to a deterministic
  // template course when no provider is configured, so the flow always works.

  let body: { answers?: unknown; regenerate?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional for signed-in users with saved intake
  }
  const inlineAnswers = parseAnswers(body.answers);

  // Resolve the (optional) signed-in user.
  let userId: string | null = null;
  if (isDbConfigured()) {
    try {
      const user = await getCurrentUserFromRequestCookie();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  // ── Signed-in: persist the course ──
  if (userId) {
    const existing = await getPersonalCourse(userId);
    if (existing?.status === 'ready' && existing.courseData && !body.regenerate) {
      return NextResponse.json({ course: existing });
    }

    let intake: IntakeAnswers = existing?.intakeData ?? {};
    if (Object.keys(inlineAnswers).length) {
      intake = inlineAnswers;
      await saveIntake(userId, inlineAnswers);
    }
    if (Object.keys(intake).length === 0) {
      return NextResponse.json(
        { error: 'no_intake', message: 'Complete the intake before generating a course.' },
        { status: 400 }
      );
    }

    try {
      await markGenerating(userId);
      const courseData = await generateCourse(intake);
      const course = await saveGeneratedCourse(userId, courseData);
      return NextResponse.json({ course });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Course generation failed';
      console.error('Course generation error:', msg);
      try {
        await saveIntake(userId, intake);
      } catch {
        // best-effort status rollback
      }
      return NextResponse.json({ error: 'generation_failed', message: msg }, { status: 502 });
    }
  }

  // ── Guest: generate an ephemeral, non-persisted course ──
  if (Object.keys(inlineAnswers).length === 0) {
    return NextResponse.json(
      { error: 'no_intake', message: 'Complete the intake before generating a course.' },
      { status: 400 }
    );
  }

  try {
    const courseData = await generateCourse(inlineAnswers);
    return NextResponse.json({
      course: {
        status: 'ready',
        intakeData: inlineAnswers,
        courseData,
        progressData: {},
      },
      guest: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Course generation failed';
    console.error('Course generation error (guest):', msg);
    return NextResponse.json({ error: 'generation_failed', message: msg }, { status: 502 });
  }
}
