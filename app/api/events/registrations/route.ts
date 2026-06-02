import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureEventRegistrationsSchema } from '@/lib/ensureEventRegistrationsSchema';
import { getEventById, isRegisterableEvent } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/events/registrations
 * The event IDs the current user is registered for — used to hydrate the
 * "Registered" state on the dashboard.
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ eventIds: [] });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ eventIds: [] });
  }

  await ensureEventRegistrationsSchema();
  const rows = await sqlQuery<Array<{ event_id: string }>>(
    `SELECT event_id FROM event_registrations WHERE user_id = :userId`,
    { userId: user.id },
  );
  return NextResponse.json({ eventIds: rows.map((r) => r.event_id) });
}

/**
 * POST /api/events/registrations
 * Body: { eventId: string, email?: string }
 * Registers the current user for an event and stores an email for the reminder.
 */
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === 'string' ? body.eventId : '';
  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';

  const event = getEventById(eventId);
  if (!event || !isRegisterableEvent(event)) {
    return NextResponse.json({ error: 'Unknown or non-registerable event.' }, { status: 400 });
  }

  const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : null;
  if (rawEmail && !email) {
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
  }

  await ensureEventRegistrationsSchema();

  // Upsert: registering again (e.g. to add an email later) updates the email
  // without clobbering an already-sent reminder stamp.
  await sqlQuery(
    `INSERT INTO event_registrations (id, user_id, event_id, email)
     VALUES (:id, :userId, :eventId, :email)
     ON CONFLICT ON CONSTRAINT uq_event_registration_user_event
     DO UPDATE SET email = COALESCE(EXCLUDED.email, event_registrations.email)`,
    { id: randomUUID(), userId: user.id, eventId, email },
  );

  return NextResponse.json({ registered: true, eventId, hasEmail: Boolean(email) });
}

/**
 * DELETE /api/events/registrations
 * Body: { eventId: string } — unregister the current user from an event.
 */
export async function DELETE(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === 'string' ? body.eventId : '';
  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId.' }, { status: 400 });
  }

  await ensureEventRegistrationsSchema();
  await sqlQuery(
    `DELETE FROM event_registrations WHERE user_id = :userId AND event_id = :eventId`,
    { userId: user.id, eventId },
  );

  return NextResponse.json({ registered: false, eventId });
}
