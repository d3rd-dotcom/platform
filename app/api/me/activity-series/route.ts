import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureActivityEventsSchema } from '@/lib/ensureActivityEventsSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;

type DayRow = { day: string; total: string };

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/me/activity-series
 * Daily buckets over the last 30 days for the signed-in user, one number per
 * series per day, zero-filled: missions completed (from quests.created_at),
 * field notes written and balloons popped (from the activity_events ledger).
 */
export async function GET() {
  const empty = { days: [] as string[], missions: [], notes: [], balloons: [] };
  if (!isDbConfigured()) return NextResponse.json(empty);

  const user = await getCurrentUserFromRequestCookie();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  await ensureActivityEventsSchema();

  // Build the zero-filled day axis (oldest → newest, local-agnostic UTC dates).
  const today = new Date();
  const days: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(dayKey(d));
  }
  const index = new Map(days.map((d, i) => [d, i]));

  const zero = () => new Array(days.length).fill(0);
  const missions = zero();
  const notes = zero();
  const balloons = zero();

  const since = `${days[0]} 00:00:00+00`;

  const [questRows, noteRows, balloonRows] = await Promise.all([
    sqlQuery<DayRow[]>(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*) AS total
       FROM quests
       WHERE user_id = :userId AND created_at >= :since
       GROUP BY day`,
      { userId: user.id, since }
    ),
    sqlQuery<DayRow[]>(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, sum(count) AS total
       FROM activity_events
       WHERE user_id = :userId AND kind = 'field_note' AND created_at >= :since
       GROUP BY day`,
      { userId: user.id, since }
    ),
    sqlQuery<DayRow[]>(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, sum(count) AS total
       FROM activity_events
       WHERE user_id = :userId AND kind = 'balloon_pop' AND created_at >= :since
       GROUP BY day`,
      { userId: user.id, since }
    ),
  ]);

  for (const r of questRows) { const i = index.get(r.day); if (i !== undefined) missions[i] = Number(r.total); }
  for (const r of noteRows) { const i = index.get(r.day); if (i !== undefined) notes[i] = Number(r.total); }
  for (const r of balloonRows) { const i = index.get(r.day); if (i !== undefined) balloons[i] = Number(r.total); }

  return NextResponse.json({ days, missions, notes, balloons });
}
