import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getPersonalCourse } from '@/lib/personal-course-db';

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
