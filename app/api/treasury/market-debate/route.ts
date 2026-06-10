import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_LENGTH = 500;
const VALID_STANCES = ['yes', 'no'] as const;
type Stance = (typeof VALID_STANCES)[number];

async function ensureMarketDebateTable() {
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS market_debate_posts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      market_id TEXT NOT NULL,
      market_title TEXT NULL,
      user_id CHAR(36) NOT NULL REFERENCES users(id),
      stance VARCHAR(8) NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await sqlQuery(`
    CREATE INDEX IF NOT EXISTS idx_market_debate_market ON market_debate_posts(market_id, created_at DESC)
  `);
}

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ posts: [] });
  }

  await ensureMarketDebateTable();

  const marketId = request.nextUrl.searchParams.get('marketId');
  if (!marketId) {
    return NextResponse.json({ error: 'Missing marketId' }, { status: 400 });
  }

  const user = await getCurrentUserFromRequestCookie();

  const posts = await sqlQuery<Array<{
    id: string;
    stance: Stance;
    body: string;
    created_at: string;
    user_id: string;
    username: string | null;
    avatar_url: string | null;
  }>>(
    `SELECT p.id, p.stance, p.body, p.created_at, p.user_id, u.username, u.avatar_url
     FROM market_debate_posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.market_id = :marketId
     ORDER BY p.created_at DESC
     LIMIT 100`,
    { marketId }
  );

  return NextResponse.json({
    posts: posts.map((post) => ({
      ...post,
      is_own: user ? post.user_id === user.id : false,
    })),
  });
}

export async function POST(request: NextRequest) {
  const rlResult = checkRateLimit({
    max: 10,
    windowMs: 60 * 1000,
    identifier: `market-debate:${getClientIdentifier(request)}`,
  });
  if (!rlResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rlResult) }
    );
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
  }

  await ensureMarketDebateTable();

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { marketId, marketTitle, stance, body } = await request.json();

  if (!marketId || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'Missing marketId or body' }, { status: 400 });
  }
  if (!VALID_STANCES.includes(stance)) {
    return NextResponse.json({ error: 'Stance must be yes or no' }, { status: 400 });
  }
  if (body.trim().length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: `Post too long (max ${MAX_BODY_LENGTH} chars)` }, { status: 400 });
  }

  const rows = await sqlQuery<Array<{ id: string; created_at: string }>>(
    `INSERT INTO market_debate_posts (market_id, market_title, user_id, stance, body)
     VALUES (:marketId, :marketTitle, :userId, :stance, :body)
     RETURNING id, created_at`,
    {
      marketId,
      marketTitle: typeof marketTitle === 'string' ? marketTitle.slice(0, 300) : null,
      userId: user.id,
      stance,
      body: body.trim(),
    }
  );

  return NextResponse.json({
    ok: true,
    post: {
      id: rows[0].id,
      stance,
      body: body.trim(),
      created_at: rows[0].created_at,
      user_id: user.id,
      username: user.username,
      avatar_url: user.avatarUrl,
      is_own: true,
    },
  });
}

export async function DELETE(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
  }

  await ensureMarketDebateTable();

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { postId } = await request.json();
  if (!postId) {
    return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
  }

  const deleted = await sqlQuery<Array<{ id: string }>>(
    `DELETE FROM market_debate_posts WHERE id = :postId AND user_id = :userId RETURNING id`,
    { postId, userId: user.id }
  );

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Post not found or not yours' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
