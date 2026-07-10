import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { getFrontierGuides } from '@/lib/guides-db';
import type { FrontierGuidesResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/frontier — the caller's "next unlocks": published guides not
 * yet completed whose direct prereqs are all satisfied. Powers the "Next
 * unlocks" row on /home and the home dashboard's Knowledge Base card.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const guides = await getFrontierGuides(userId);
  return NextResponse.json({ guides } satisfies FrontierGuidesResponse);
}
