import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaReadingCommentsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaReadingCommentsSchemaLock: Promise<void> | undefined;
}

/**
 * Converges a fresh database to the current reading-comments schema.
 *
 * Existing UUID user_id columns are migrated by the accompanying one-shot
 * Supabase migration. Runtime requests never drop or rewrite comment data.
 */
export async function ensureReadingCommentsSchema(): Promise<void> {
  if (globalThis.__mwaReadingCommentsSchemaEnsured) return;
  if (globalThis.__mwaReadingCommentsSchemaLock) {
    await globalThis.__mwaReadingCommentsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    await sqlQuery(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await sqlQuery(`
      CREATE TABLE IF NOT EXISTS reading_comments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        reading_slug TEXT NOT NULL,
        user_id CHAR(36) NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await sqlQuery(`
      CREATE TABLE IF NOT EXISTS reading_comment_likes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        comment_id UUID NOT NULL REFERENCES reading_comments(id) ON DELETE CASCADE,
        user_id CHAR(36) NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(comment_id, user_id)
      )
    `);
    await sqlQuery(`
      CREATE INDEX IF NOT EXISTS idx_reading_comments_slug
      ON reading_comments(reading_slug, created_at DESC)
    `);
    await sqlQuery(`
      CREATE INDEX IF NOT EXISTS idx_reading_comment_likes_comment
      ON reading_comment_likes(comment_id)
    `);
    await sqlQuery(`ALTER TABLE reading_comments ENABLE ROW LEVEL SECURITY`);
    await sqlQuery(`ALTER TABLE reading_comment_likes ENABLE ROW LEVEL SECURITY`);

    globalThis.__mwaReadingCommentsSchemaEnsured = true;
  })();

  globalThis.__mwaReadingCommentsSchemaLock = lockPromise;
  try {
    await lockPromise;
  } finally {
    globalThis.__mwaReadingCommentsSchemaLock = undefined;
  }
}
