import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaGuidesSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaGuidesSchemaLock: Promise<void> | undefined;
}

export async function ensureGuidesSchema() {
  if (globalThis.__mwaGuidesSchemaEnsured) return;
  if (globalThis.__mwaGuidesSchemaLock) {
    await globalThis.__mwaGuidesSchemaLock;
    return;
  }

  const lock = (async () => {
    await sqlQuery(`ALTER TABLE guides ADD COLUMN IF NOT EXISTS education_levels TEXT[] NOT NULL DEFAULT '{}'`);
    await sqlQuery(`ALTER TABLE guides ADD COLUMN IF NOT EXISTS goals TEXT[] NOT NULL DEFAULT '{}'`);
    await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_guides_education_levels ON guides USING GIN (education_levels)`);
    await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_guides_goals ON guides USING GIN (goals)`);
    globalThis.__mwaGuidesSchemaEnsured = true;
  })();

  globalThis.__mwaGuidesSchemaLock = lock;
  try {
    await lock;
  } finally {
    globalThis.__mwaGuidesSchemaLock = undefined;
  }
}
