/**
 * POST /api/avatars/custom
 *
 * Set the signed-in user's avatar to a custom image they uploaded via
 * /api/upload. Only accepts URLs that point at our own /uploads/ directory —
 * never an arbitrary or external URL — so avatar_url can't be turned into an
 * SSRF vector or a link to off-site content.
 */
import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A file produced by /api/upload: /uploads/<uuid>.<ext>
const UPLOADED_IMAGE = /^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|gif|webp)$/;

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in. Please authenticate first.' }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const url = body.url;
  if (typeof url !== 'string' || !UPLOADED_IMAGE.test(url)) {
    return NextResponse.json(
      { error: 'Invalid image. Upload a PNG, JPEG, GIF, or WebP first.' },
      { status: 400 },
    );
  }

  try {
    await sqlQuery(
      `UPDATE users SET avatar_url = :avatarUrl WHERE id = :userId`,
      { avatarUrl: url, userId: user.id },
    );
    return NextResponse.json({ ok: true, avatar_url: url });
  } catch (error) {
    console.error('Error setting custom avatar:', error);
    return NextResponse.json({ error: 'Failed to save your photo.' }, { status: 500 });
  }
}
