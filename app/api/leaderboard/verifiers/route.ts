import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getTopVerifiers } from '@/lib/verifier-prestige-db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leaderboard/verifiers — public leaderboard of the most prestigious
 * verifiers, ranked by (panels served * upheld rate). Same response
 * conventions as the main leaderboard (app/api/leaderboard/route.ts): a
 * `{ verifiers: [...] }` payload, an empty array when the DB is unconfigured or
 * unavailable rather than an error.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ verifiers: [] });
  }
  try {
    const verifiers = await getTopVerifiers(20);
    return NextResponse.json({ verifiers });
  } catch {
    return NextResponse.json({ verifiers: [] });
  }
}
