import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaActivityEventsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaActivityEventsSchemaLock: Promise<void> | undefined;
}

/**
 * A lightweight per-user activity ledger for the "My Stats" chart.
 *
 * One row per event, so the home dashboard can plot a real daily time-series
 * for field-note writes and balloon pops. Field-note *content* stays sealed in
 * the encrypted `prayers` blob — this table only records that a note was
 * written and when, never what it said. Missions come from `quests.created_at`
 * directly and are not duplicated here.
 */
export async function ensureActivityEventsSchema() {
  if (globalThis.__mwaActivityEventsSchemaEnsured) return;

  if (globalThis.__mwaActivityEventsSchemaLock) {
    await globalThis.__mwaActivityEventsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await sqlQuery(
        `CREATE TABLE IF NOT EXISTS activity_events (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          user_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('field_note', 'balloon_pop')),
          count INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        {}
      );
      await sqlQuery(
        `CREATE INDEX IF NOT EXISTS idx_activity_events_user_created
         ON activity_events (user_id, created_at)`,
        {}
      );
      globalThis.__mwaActivityEventsSchemaEnsured = true;
    } finally {
      globalThis.__mwaActivityEventsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaActivityEventsSchemaLock = lockPromise;
  await lockPromise;
}

/**
 * Record an activity event. Fail-soft: a logging failure must never break the
 * user-facing write that triggered it, so callers wrap this and swallow errors.
 */
export async function recordActivityEvent(
  userId: string,
  kind: 'field_note' | 'balloon_pop',
  count = 1,
) {
  if (!userId || count <= 0) return;
  await ensureActivityEventsSchema();
  await sqlQuery(
    `INSERT INTO activity_events (user_id, kind, count)
     VALUES (:userId, :kind, :count)`,
    { userId, kind, count: Math.floor(count) }
  );
}
