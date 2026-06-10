import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { deletePersonalCourse, getPersonalCourse } from '@/lib/personal-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Course state must never be served stale by any layer (browser, CDN, proxy) —
// a deleted course that keeps showing reads as data loss the user can't trust.
const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

// Always returns 200 — a missing account or load failure just means "no saved
// course yet", which drops the visitor into the intake flow.
export async function GET() {
  try {
    if (!isDbConfigured()) {
      return jsonNoStore({ course: null, guest: true });
    }

    const user = await getCurrentUserFromRequestCookie();
    if (!user) {
      return jsonNoStore({ course: null, guest: true });
    }

    const course = await getPersonalCourse(user.id);
    return jsonNoStore({ course });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Personal course load error:', msg);
    return jsonNoStore({ course: null, guest: true });
  }
}

// Unlike GET, deletion fails loudly — the caller must be able to tell the user
// truthfully whether the course is gone.
export async function DELETE() {
  try {
    if (!isDbConfigured()) {
      return jsonNoStore({ error: 'Database not configured' }, 503);
    }

    const user = await getCurrentUserFromRequestCookie();
    if (!user) {
      return jsonNoStore({ error: 'Not authenticated' }, 401);
    }

    const deleted = await deletePersonalCourse(user.id);
    // Read back to prove the row is actually gone before telling the caller —
    // "deleted" must mean deleted, not "the query probably worked".
    const remaining = await getPersonalCourse(user.id);
    if (remaining) {
      console.error('Personal course delete verification failed: row still present', { userId: user.id });
      return jsonNoStore({ error: 'delete_failed' }, 500);
    }
    return jsonNoStore({ deleted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Personal course delete error:', msg);
    return jsonNoStore({ error: 'delete_failed' }, 500);
  }
}
