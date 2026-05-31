import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaCertMintsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaCertMintsSchemaLock: Promise<void> | undefined;
}

export async function ensureSurveyCertificateMintsSchema() {
  if (globalThis.__mwaCertMintsSchemaEnsured) return;

  if (globalThis.__mwaCertMintsSchemaLock) {
    await globalThis.__mwaCertMintsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await _impl();
      globalThis.__mwaCertMintsSchemaEnsured = true;
    } finally {
      globalThis.__mwaCertMintsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaCertMintsSchemaLock = lockPromise;
  await lockPromise;
}

async function _impl() {
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS survey_certificate_mints (
      id           CHAR(36)     PRIMARY KEY,
      user_id      CHAR(36)     NOT NULL,
      survey_id    VARCHAR(64)  NOT NULL,
      token_id     INTEGER      NOT NULL,
      wallet       VARCHAR(255) NOT NULL,
      image_uri    TEXT,
      metadata_uri TEXT,
      tx_hash      VARCHAR(120),
      status       VARCHAR(16)  NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_cert_mint_user_survey UNIQUE (user_id, survey_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  try {
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_cert_mints_wallet ON survey_certificate_mints(wallet)`,
    );
  } catch {
    // index may already exist
  }
}
