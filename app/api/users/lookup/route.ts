import { NextResponse } from 'next/server';
import { sqlQuery } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username query param required' }, { status: 400 });
    }

    const rows = await sqlQuery<Array<{ username: string; avatar_url: string | null }>>(
      `SELECT username, avatar_url FROM users WHERE LOWER(username) = LOWER(:username) LIMIT 1`,
      { username },
    );

    if (!rows[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
