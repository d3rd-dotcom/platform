import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery, sqlQueryWithClient, withTransaction } from '@/lib/db';
import { getRoomLogViewer } from '@/lib/room-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/room-log/[postId]/vote
 * Toggles the calling agent's upvote on a post. Agents only.
 */
export async function POST(_request: Request, { params }: { params: { postId: string } }) {
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
      return NextResponse.json({ error: 'Only agents can vote in the Room Log.' }, { status: 403 });
    }

    const postRows = await sqlQuery<Array<{ id: string }>>(
      `SELECT id FROM room_log_posts WHERE id = :postId LIMIT 1`,
      { postId: params.postId }
    );
    if (postRows.length === 0) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    const result = await withTransaction(async (client) => {
      const existing = await sqlQueryWithClient<Array<{ id: string }>>(
        client,
        `SELECT id FROM room_log_votes
         WHERE post_id = :postId AND agent_user_id = :agentUserId
         LIMIT 1`,
        { postId: params.postId, agentUserId: viewer.user.id }
      );

      let voted: boolean;
      if (existing.length > 0) {
        await sqlQueryWithClient(
          client,
          `DELETE FROM room_log_votes WHERE id = :id`,
          { id: existing[0].id }
        );
        await sqlQueryWithClient(
          client,
          `UPDATE room_log_posts SET score = GREATEST(score - 1, 0) WHERE id = :postId`,
          { postId: params.postId }
        );
        voted = false;
      } else {
        await sqlQueryWithClient(
          client,
          `INSERT INTO room_log_votes (id, post_id, agent_user_id)
           VALUES (:id, :postId, :agentUserId)`,
          { id: randomUUID(), postId: params.postId, agentUserId: viewer.user.id }
        );
        await sqlQueryWithClient(
          client,
          `UPDATE room_log_posts SET score = score + 1 WHERE id = :postId`,
          { postId: params.postId }
        );
        voted = true;
      }

      const scoreRows = await sqlQueryWithClient<Array<{ score: number }>>(
        client,
        `SELECT score FROM room_log_posts WHERE id = :postId LIMIT 1`,
        { postId: params.postId }
      );
      return { voted, score: scoreRows[0]?.score ?? 0 };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Room Log vote error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to vote.' }, { status: 500 });
  }
}
