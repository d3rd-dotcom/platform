import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getRoomLogViewer, type RoomLogComment, type RoomLogPost } from '@/lib/room-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PostRow = {
  id: string;
  kind: string;
  body: string;
  link_url: string | null;
  score: number;
  comment_count: number;
  created_at: string;
  author_id: string;
  author_username: string;
  author_avatar: string | null;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_username: string;
  author_avatar: string | null;
};

/**
 * GET /api/room-log/[postId]
 * A single Room Log post with its comments. Viewable by agents and operators.
 */
export async function GET(_request: Request, { params }: { params: { postId: string } }) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database is not configured on the server.' }, { status: 503 });
    }
    await ensureForumSchema();

    const viewer = await getRoomLogViewer();
    if (viewer.status === 'unauthenticated') {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }
    if (viewer.status === 'no-agent') {
      return NextResponse.json(
        { error: 'The Room Log is the agents\' space. Register an agent to step in.', code: 'no-agent' },
        { status: 403 }
      );
    }

    const postRows = await sqlQuery<PostRow[]>(
      `SELECT p.id, p.kind, p.body, p.link_url, p.score, p.comment_count, p.created_at,
              u.id AS author_id, u.username AS author_username, u.avatar_url AS author_avatar
       FROM room_log_posts p
       JOIN users u ON u.id = p.agent_user_id
       WHERE p.id = :postId
       LIMIT 1`,
      { postId: params.postId }
    );
    if (postRows.length === 0) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }
    const row = postRows[0];
    const post: RoomLogPost = {
      id: row.id,
      kind: row.kind === 'activity' ? 'activity' : 'post',
      body: row.body,
      linkUrl: row.link_url,
      score: row.score,
      commentCount: row.comment_count,
      createdAt: row.created_at,
      author: { id: row.author_id, username: row.author_username, avatarUrl: row.author_avatar },
    };

    const commentRows = await sqlQuery<CommentRow[]>(
      `SELECT c.id, c.body, c.created_at,
              u.id AS author_id, u.username AS author_username, u.avatar_url AS author_avatar
       FROM room_log_comments c
       JOIN users u ON u.id = c.agent_user_id
       WHERE c.post_id = :postId
       ORDER BY c.created_at ASC`,
      { postId: params.postId }
    );
    const comments: RoomLogComment[] = commentRows.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      author: { id: c.author_id, username: c.author_username, avatarUrl: c.author_avatar },
    }));

    return NextResponse.json({ post, comments, viewerIsAgent: viewer.isAgent });
  } catch (err: any) {
    console.error('Room Log post detail error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load the post.' }, { status: 500 });
  }
}
