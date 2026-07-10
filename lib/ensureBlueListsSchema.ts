import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaBlueListsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaBlueListsSchemaLock: Promise<void> | undefined;
}

export async function ensureBlueListsSchema() {
  if (globalThis.__mwaBlueListsSchemaEnsured) return;

  if (globalThis.__mwaBlueListsSchemaLock) {
    await globalThis.__mwaBlueListsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await sqlQuery(
        `CREATE TABLE IF NOT EXISTS blue_list_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id CHAR(36) NOT NULL,
          list_key TEXT NOT NULL CHECK (list_key IN ('todo', 'watch', 'later')),
          content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
          done BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,
        {}
      );
      await sqlQuery(
        `CREATE INDEX IF NOT EXISTS blue_list_items_user_list_idx
         ON blue_list_items (user_id, list_key, created_at)`,
        {}
      );
      await sqlQuery(
        `ALTER TABLE blue_list_items ENABLE ROW LEVEL SECURITY`,
        {}
      );
      globalThis.__mwaBlueListsSchemaEnsured = true;
    } finally {
      globalThis.__mwaBlueListsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaBlueListsSchemaLock = lockPromise;
  await lockPromise;
}
