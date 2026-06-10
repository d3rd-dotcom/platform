import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { deletePersonalCourse, getPersonalCourse } from '@/lib/personal-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Always returns 200 — a missing account or load failure just means "no saved
// course yet", which drops the visitor into the intake flow.
export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ course: null, guest: true });
    }

    const user = await getCurrentUserFromRequestCookie();
    if (!user) {
      return NextResponse.json({ course: null, guest: true });
    }

    const course = await getPersonalCourse(user.id);
    return NextResponse.json({ course });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Personal course load error:', msg);
    return NextResponse.json({ course: null, guest: true });
  }
}

// Unlike GET, deletion fails loudly — the caller must be able to tell the user
// truthfully whether the course is gone.
export async function DELETE() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const user = await getCurrentUserFromRequestCookie();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const deleted = await deletePersonalCourse(user.id);
    return NextResponse.json({ deleted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Personal course delete error:', msg);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
