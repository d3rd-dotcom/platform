import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensurePrayersSchema } from '@/lib/ensurePrayersSchema';
import { decryptForUser } from '@/lib/encrypt';
import { getDateKeyInTimeZone, isValidTimeZone, shiftDateKey } from '@/lib/date-key';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FieldNoteEntry {
  day: number;
  date: string;
  submittedAt: number;
}

/**
 * GET /api/daily-notes/streak
 * Returns the current consecutive-day streak and which days of the
 * current week have been completed.
 */
export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ streak: 0, completedDays: [] });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ streak: 0, completedDays: [] });
  }

  await ensurePrayersSchema();

  const rows = await sqlQuery<Array<{ progress_data: any }>>(
    `SELECT progress_data FROM prayers
     WHERE user_id = :userId
     LIMIT 1`,
    { userId: user.id }
  );

  if (rows.length === 0) {
    return NextResponse.json({ streak: 0, completedDays: [] });
  }

  let allWeekPages: Record<string, FieldNoteEntry[]> = {};
  const pd = rows[0].progress_data;

  if (pd?.encrypted && pd?.data) {
    try {
      const decrypted = decryptForUser(user.id, pd.data);
      const parsed = JSON.parse(decrypted);
      allWeekPages = parsed.allWeekPages ?? {};
    } catch {
      return NextResponse.json({ streak: 0, completedDays: [] });
    }
  } else {
    allWeekPages = pd?.allWeekPages ?? {};
  }

  // Collect all dates with completed entries across all weeks
  const allDates = new Set<string>();
  for (const pages of Object.values(allWeekPages)) {
    for (const entry of pages) {
      if (entry.date) allDates.add(entry.date);
    }
  }

  // Entries are written with the browser's local calendar date. Reuse that
  // timezone here so the server's UTC clock cannot move a user's day forward
  // or backward around midnight.
  const requestedTimeZone = new URL(request.url).searchParams.get('tz');
  const timeZone = requestedTimeZone && isValidTimeZone(requestedTimeZone)
    ? requestedTimeZone
    : 'UTC';
  const todayStr = getDateKeyInTimeZone(new Date(), timeZone);

  let streak = 0;
  let checkDate = todayStr;

  // If today is not done, start from yesterday
  if (!allDates.has(todayStr)) {
    checkDate = shiftDateKey(checkDate, -1);
  }

  while (allDates.has(checkDate)) {
    streak++;
    checkDate = shiftDateKey(checkDate, -1);
  }

  // Get day-of-week completions for the current 5-day display
  // Show the last 5 days (today and 4 before)
  const completedDays: boolean[] = [];
  for (let i = 4; i >= 0; i--) {
    completedDays.push(allDates.has(shiftDateKey(todayStr, -i)));
  }

  return NextResponse.json({ streak, completedDays });
}
