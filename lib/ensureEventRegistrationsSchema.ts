import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaEventRegistrationsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaEventRegistrationsSchemaLock: Promise<void> | undefined;
}

/**
 * Per-user RSVP ledger for the events shown on /dao.
 *
 * One row per (user, event). `email` is captured at registration time — sourced
 * from the user's Privy-linked address, or asked for inline when they're
 * wallet-only — because the users table has no email column. The reminder cron
 * (app/api/events/reminders) reads `email` to send the day-before nudge and
 * stamps `reminder_sent_at` so a given user is reminded at most once per event.
 */
export async function ensureEventRegistrationsSchema() {
  if (globalThis.__mwaEventRegistrationsSchemaEnsured) return;

  if (globalThis.__mwaEventRegistrationsSchemaLock) {
    await globalThis.__mwaEventRegistrationsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await _ensureEventRegistrationsSchemaImpl();
      globalThis.__mwaEventRegistrationsSchemaEnsured = true;
    } finally {
      globalThis.__mwaEventRegistrationsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaEventRegistrationsSchemaLock = lockPromise;
  await lockPromise;
}

async function _ensureEventRegistrationsSchemaImpl() {
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS event_registrations (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      event_id VARCHAR(120) NOT NULL,
      email VARCHAR(255),
      reminder_sent_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_event_registration_user_event UNIQUE (user_id, event_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  try {
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id)`,
    );
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON event_registrations(user_id)`,
    );
  } catch {
    // indexes may already exist
  }
}
