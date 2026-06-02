import { NextResponse } from 'next/server';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureEventRegistrationsSchema } from '@/lib/ensureEventRegistrationsSchema';
import { getEventById, getEventsStartingWithin } from '@/lib/events';
import { sendEventReminderEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET|POST /api/events/reminders
 *
 * Daily cron (Hobby plan caps cron frequency at daily). Finds events starting
 * within the next 48h, then emails every registrant who has an email and hasn't
 * been reminded yet, stamping reminder_sent_at so each user is nudged at most
 * once per event. The 48h window plus a daily run reliably catches the
 * day-before slot even though the cron only fires once a day.
 *
 * Protected by CRON_SECRET (Vercel cron sends it as a bearer token); accepts
 * x-internal-secret for manual/internal triggers, matching the other crons.
 */
export async function GET(request: Request) {
  return handleReminders(request);
}

export async function POST(request: Request) {
  return handleReminders(request);
}

async function handleReminders(request: Request) {
  const authHeader = request.headers.get('authorization');
  const internalSecret = request.headers.get('x-internal-secret');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isInternalAuth = internalSecret && internalSecret === process.env.INTERNAL_API_SECRET;

  if (!isCronAuth && !isInternalAuth) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  await ensureEventRegistrationsSchema();

  const upcoming = getEventsStartingWithin();
  if (upcoming.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0, message: 'No events in the reminder window.' });
  }

  const eventIds = upcoming.map((ev) => ev.id);
  const due = await sqlQuery<Array<{ id: string; event_id: string; email: string }>>(
    `SELECT id, event_id, email FROM event_registrations
     WHERE event_id = ANY(:eventIds)
       AND email IS NOT NULL
       AND reminder_sent_at IS NULL`,
    { eventIds },
  );

  let sent = 0;
  for (const row of due) {
    const event = getEventById(row.event_id);
    if (!event) continue;
    const ok = await sendEventReminderEmail(row.email, event);
    if (!ok) continue;
    await sqlQuery(
      `UPDATE event_registrations SET reminder_sent_at = CURRENT_TIMESTAMP WHERE id = :id`,
      { id: row.id },
    );
    sent += 1;
  }

  return NextResponse.json({ checked: due.length, sent, events: eventIds });
}
