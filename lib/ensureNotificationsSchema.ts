import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaNotificationsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaNotificationsSchemaLock: Promise<void> | undefined;
}

export async function ensureNotificationsSchema() {
  if (globalThis.__mwaNotificationsSchemaEnsured) return;

  if (globalThis.__mwaNotificationsSchemaLock) {
    await globalThis.__mwaNotificationsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await sqlQuery(
        `CREATE TABLE IF NOT EXISTS chat_notifications (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          from_user_id TEXT NOT NULL,
          from_username TEXT NOT NULL,
          message_id BIGINT NOT NULL,
          message_preview TEXT NOT NULL,
          read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        {}
      );
      await sqlQuery(
        `CREATE INDEX IF NOT EXISTS idx_chat_notifications_user
         ON chat_notifications (user_id, read, created_at DESC)`,
        {}
      );
      globalThis.__mwaNotificationsSchemaEnsured = true;
    } finally {
      globalThis.__mwaNotificationsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaNotificationsSchemaLock = lockPromise;
  await lockPromise;
}
