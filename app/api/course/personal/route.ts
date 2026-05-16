import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getPersonalCourse } from '@/lib/personal-course-db';
import { isImageGenerationConfigured } from '@/lib/personal-course';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The course builder is free to use without an account. Signed-in users get a
// persisted course; guests get an ephemeral session. This endpoint therefore
// always returns 200 — a missing account or load failure simply means "no
// saved course yet", which drops the visitor into the intake flow.
export async function GET() {
  const imageGenerationEnabled = isImageGenerationConfigured();

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ course: null, imageGenerationEnabled, guest: true });
    }

    const user = await getCurrentUserFromRequestCookie();
    if (!user) {
      return NextResponse.json({ course: null, imageGenerationEnabled, guest: true });
    }

    const course = await getPersonalCourse(user.id);
    return NextResponse.json({ course, imageGenerationEnabled });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Personal course load error:', msg);
    return NextResponse.json({ course: null, imageGenerationEnabled, guest: true });
  }
}
