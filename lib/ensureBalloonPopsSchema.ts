import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaBalloonPopsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaBalloonPopsSchemaLock: Promise<void> | undefined;
}

export async function ensureBalloonPopsSchema() {
  if (globalThis.__mwaBalloonPopsSchemaEnsured) return;

  if (globalThis.__mwaBalloonPopsSchemaLock) {
    await globalThis.__mwaBalloonPopsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await sqlQuery(
        `CREATE TABLE IF NOT EXISTS balloon_pops (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          total BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        {}
      );
      await sqlQuery(
        `INSERT INTO balloon_pops (id, total) VALUES (1, 0)
         ON CONFLICT (id) DO NOTHING`,
        {}
      );
      globalThis.__mwaBalloonPopsSchemaEnsured = true;
    } finally {
      globalThis.__mwaBalloonPopsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaBalloonPopsSchemaLock = lockPromise;
  await lockPromise;
}
