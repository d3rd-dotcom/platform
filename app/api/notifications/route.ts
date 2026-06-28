import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureNotificationsSchema } from '@/lib/ensureNotificationsSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  await ensureNotificationsSchema();

  const rows = await sqlQuery<Array<{
    id: number;
    from_username: string;
    message_preview: string;
    read: boolean;
    created_at: string;
  }>>(
    `SELECT id, from_username, message_preview, read, created_at
     FROM chat_notifications
     WHERE user_id = :userId
     ORDER BY created_at DESC
     LIMIT 20`,
    { userId: user.id }
  );

  const unread = await sqlQuery<Array<{ count: string }>>(
    `SELECT COUNT(*)::text AS count
     FROM chat_notifications
     WHERE user_id = :userId AND read = false`,
    { userId: user.id }
  );

  return NextResponse.json({
    notifications: rows,
    unreadCount: Number(unread[0]?.count ?? 0),
  });
}

export async function PATCH(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: { ids?: number[]; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  await ensureNotificationsSchema();

  if (body.markAllRead) {
    await sqlQuery(
      `UPDATE chat_notifications
       SET read = true
       WHERE user_id = :userId AND read = false`,
      { userId: user.id }
    );
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await sqlQuery(
      `UPDATE chat_notifications
       SET read = true
       WHERE user_id = :userId AND id = ANY(:ids)`,
      { userId: user.id, ids: body.ids }
    );
  }

  return NextResponse.json({ ok: true });
}
