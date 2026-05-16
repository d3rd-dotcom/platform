import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { saveIntake } from '@/lib/personal-course-db';
import type { IntakeAnswers } from '@/lib/personal-course';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ANSWER_LENGTH = 2000;

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  // Guests can use the intake flow without an account — nothing to persist.
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ course: null, guest: true });
  }

  let body: { answers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
    return NextResponse.json({ error: 'answers object is required' }, { status: 400 });
  }

  const answers: IntakeAnswers = {};
  for (const [key, value] of Object.entries(body.answers as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) {
      answers[key.slice(0, 64)] = value.trim().slice(0, MAX_ANSWER_LENGTH);
    }
  }

  try {
    const course = await saveIntake(user.id, answers);
    return NextResponse.json({ course });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save intake';
    console.error('Course intake save error:', msg);
    return NextResponse.json({ error: 'save_failed', message: msg }, { status: 500 });
  }
}
