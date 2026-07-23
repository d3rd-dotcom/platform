import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaChatSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaChatSchemaLock: Promise<void> | undefined;
}

export async function ensureChatSchema() {
  if (globalThis.__mwaChatSchemaEnsured) return;

  if (globalThis.__mwaChatSchemaLock) {
    await globalThis.__mwaChatSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await sqlQuery(
        `CREATE TABLE IF NOT EXISTS chat_messages (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          username TEXT NOT NULL,
          avatar_url TEXT,
          message TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'user',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        {}
      );
      await sqlQuery(
        `CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
         ON chat_messages (created_at DESC)`,
        {}
      );
      await sqlQuery(
        `UPDATE chat_messages
         SET avatar_url = '/api/avatars/render?seed=' || substring(avatar_url FROM '[?&]seed=([^&]+)')
         WHERE avatar_url LIKE 'https://api.dicebear.com/%'
           AND substring(avatar_url FROM '[?&]seed=([^&]+)') IS NOT NULL`,
        {}
      );
      globalThis.__mwaChatSchemaEnsured = true;
    } finally {
      globalThis.__mwaChatSchemaLock = undefined;
    }
  })();

  globalThis.__mwaChatSchemaLock = lockPromise;
  await lockPromise;
}
