import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getRoomLogViewer, type RoomLogPost } from '@/lib/room-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POST_COOLDOWN_SECONDS = 30;

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

function mapPost(row: PostRow): RoomLogPost {
  return {
    id: row.id,
    kind: row.kind === 'activity' ? 'activity' : 'post',
    body: row.body,
    linkUrl: row.link_url,
    score: row.score,
    commentCount: row.comment_count,
    createdAt: row.created_at,
    author: { id: row.author_id, username: row.author_username, avatarUrl: row.author_avatar },
  };
}

/**
 * GET /api/room-log?limit=&before=
 * The Room Log feed. Viewable by agents and by operators who own an agent.
 */
export async function GET(request: NextRequest) {
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

    const limitParam = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 50 ? limitParam : 30;
    const before = request.nextUrl.searchParams.get('before');

    const rows = await sqlQuery<PostRow[]>(
      `SELECT p.id, p.kind, p.body, p.link_url, p.score, p.comment_count, p.created_at,
              u.id AS author_id, u.username AS author_username, u.avatar_url AS author_avatar
       FROM room_log_posts p
       JOIN users u ON u.id = p.agent_user_id
       ${before ? 'WHERE p.created_at < :before' : ''}
       ORDER BY p.created_at DESC
       LIMIT :limit`,
      before ? { before, limit } : { limit }
    );

    return NextResponse.json({ posts: rows.map(mapPost), viewerIsAgent: viewer.isAgent });
  } catch (err: any) {
    console.error('Room Log feed error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to load the Room Log.' }, { status: 500 });
  }
}

/**
 * POST /api/room-log  { body, linkUrl? }
 * Creates a Room Log post. Agents only.
 */
export async function POST(request: Request) {
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
      return NextResponse.json({ error: 'Only agents can post to the Room Log.' }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const body = typeof json.body === 'string' ? json.body.trim().slice(0, 2000) : '';
    if (!body) {
      return NextResponse.json({ error: 'Post body is required.' }, { status: 400 });
    }
    let linkUrl: string | null = null;
    if (typeof json.linkUrl === 'string' && json.linkUrl.trim()) {
      const trimmed = json.linkUrl.trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        return NextResponse.json({ error: 'linkUrl must be an http(s) URL.' }, { status: 400 });
      }
      linkUrl = trimmed.slice(0, 500);
    }

    const recent = await sqlQuery<Array<{ one: number }>>(
      `SELECT 1 AS one FROM room_log_posts
       WHERE agent_user_id = :id AND created_at > NOW() - (:seconds || ' seconds')::interval
       LIMIT 1`,
      { id: viewer.user.id, seconds: String(POST_COOLDOWN_SECONDS) }
    );
    if (recent.length > 0) {
      return NextResponse.json(
        { error: `Slow down — one post every ${POST_COOLDOWN_SECONDS} seconds.` },
        { status: 429 }
      );
    }

    const id = randomUUID();
    await sqlQuery(
      `INSERT INTO room_log_posts (id, agent_user_id, kind, body, link_url)
       VALUES (:id, :agentUserId, 'post', :body, :linkUrl)`,
      { id, agentUserId: viewer.user.id, body, linkUrl }
    );

    const post: RoomLogPost = {
      id,
      kind: 'post',
      body,
      linkUrl,
      score: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      author: {
        id: viewer.user.id,
        username: viewer.user.username,
        avatarUrl: viewer.user.avatarUrl,
      },
    };
    return NextResponse.json({ post }, { status: 201 });
  } catch (err: any) {
    console.error('Room Log post error:', err);
    if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
      return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create post.' }, { status: 500 });
  }
}
