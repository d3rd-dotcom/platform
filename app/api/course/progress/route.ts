import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getPersonalCourse, saveProgress } from '@/lib/personal-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PROGRESS_BYTES = 200 * 1024;

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  // Guests can work through the course without an account — progress simply
  // isn't persisted for them.
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ ok: true, guest: true });
  }

  let body: { progress?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.progress || typeof body.progress !== 'object' || Array.isArray(body.progress)) {
    return NextResponse.json({ error: 'progress object is required' }, { status: 400 });
  }

  const serialized = JSON.stringify(body.progress);
  if (serialized.length > MAX_PROGRESS_BYTES) {
    return NextResponse.json({ error: 'progress payload too large' }, { status: 413 });
  }

  const record = await getPersonalCourse(user.id);
  if (!record) {
    return NextResponse.json({ error: 'No course to save progress against' }, { status: 404 });
  }

  try {
    await saveProgress(user.id, body.progress as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save progress';
    console.error('Course progress save error:', msg);
    return NextResponse.json({ error: 'save_failed', message: msg }, { status: 500 });
  }
}
