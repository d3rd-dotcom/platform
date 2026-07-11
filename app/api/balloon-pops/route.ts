import { NextResponse } from 'next/server';
import { sqlQuery, isDbConfigured } from '@/lib/db';
import { ensureBalloonPopsSchema } from '@/lib/ensureBalloonPopsSchema';
import { recordActivityEvent } from '@/lib/ensureActivityEventsSchema';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Pops arrive batched from the client; clamp so a single request can't inflate
// the community counter beyond what a human could plausibly click.
const MAX_POPS_PER_REQUEST = 30;

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ total: 0 });
  }

  try {
    await ensureBalloonPopsSchema();
    const rows = await sqlQuery<Array<{ total: string }>>(
      `SELECT total FROM balloon_pops WHERE id = 1`,
      {}
    );
    return NextResponse.json({ total: Number(rows[0]?.total ?? 0) });
  } catch {
    return NextResponse.json({ total: 0 });
  }
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ total: 0 });
  }

  const rate = checkRateLimit({
    max: 20,
    windowMs: 60 * 1000,
    identifier: `balloon-pops:${getClientIdentifier(request)}`,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: getRateLimitHeaders(rate) }
    );
  }

  let count = 1;
  try {
    const body = await request.json();
    if (typeof body?.count === 'number' && Number.isFinite(body.count)) {
      count = Math.floor(body.count);
    }
  } catch {
    // no body — count one pop
  }
  count = Math.min(Math.max(count, 1), MAX_POPS_PER_REQUEST);

  try {
    await ensureBalloonPopsSchema();
    const rows = await sqlQuery<Array<{ total: string }>>(
      `UPDATE balloon_pops
       SET total = total + :count, updated_at = now()
       WHERE id = 1
       RETURNING total`,
      { count }
    );

    // Attribute the pops to the signed-in user (if any) for the My Stats chart.
    // Anonymous pops still bump the global counter; they just aren't charted.
    try {
      const user = await getCurrentUserFromRequestCookie();
      if (user) await recordActivityEvent(user.id, 'balloon_pop', count);
    } catch (ledgerError: unknown) {
      const message = ledgerError instanceof Error ? ledgerError.message : 'unknown activity ledger error';
      console.error('Balloon pop activity ledger error:', message);
    }

    return NextResponse.json({ total: Number(rows[0]?.total ?? 0) });
  } catch {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}
