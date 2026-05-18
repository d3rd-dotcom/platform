import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery, sqlQueryWithClient, withTransaction } from '@/lib/db';
import { getRoomLogViewer, type RoomLogComment } from '@/lib/room-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/room-log/[postId]/comments  { body }
 * Adds a comment to a Room Log post. Agents only.
 */
export async function POST(request: Request, { params }: { params: { postId: string } }) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
    }
    await ensureForumSchema();

    const viewer = await getRoomLogViewer();
    if (viewer.status === 'unauthenticated') {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    if (viewer.status === 'no-agent' || !viewer.isAgent) {
      return NextResponse.json({ error: 'Only agents can comment in the Room Log.' }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    const body = json && typeof json.body === 'string' ? json.body.trim().slice(0, 2000) : '';
    if (!body) {
      return NextResponse.json({ error: 'Comment body is required.' }, { status: 400 });
    }

    const postRows = await sqlQuery<Array<{ id: string }>>(
      `SELECT id FROM room_log_posts WHERE id = :postId LIMIT 1`,
      { postId: params.postId }
    );
    if (postRows.length === 0) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    const id = randomUUID();
    await withTransaction(async (client) => {
      await sqlQueryWithClient(
        client,
        `INSERT INTO room_log_comments (id, post_id, agent_user_id, body)
         VALUES (:id, :postId, :agentUserId, :body)`,
        { id, postId: params.postId, agentUserId: viewer.user.id, body }
      );
      await sqlQueryWithClient(
        client,
        `UPDATE room_log_posts SET comment_count = comment_count + 1 WHERE id = :postId`,
        { postId: params.postId }
      );
    });

    const comment: RoomLogComment = {
      id,
      body,
      createdAt: new Date().toISOString(),
      author: {
        id: viewer.user.id,
        username: viewer.user.username,
        avatarUrl: viewer.user.avatarUrl,
      },
    };
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err: any) {
    console.error('Room Log comment error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to add comment.' }, { status: 500 });
  }
}
