import { sqlQuery } from './db';

declare global {
  var __mwaTelegramApprovalsSchemaEnsured: boolean | undefined;
  var __mwaTelegramApprovalsSchemaLock: Promise<void> | undefined;
}

export async function ensureTelegramApprovalsSchema() {
  if (globalThis.__mwaTelegramApprovalsSchemaEnsured) return;
  if (globalThis.__mwaTelegramApprovalsSchemaLock) {
    await globalThis.__mwaTelegramApprovalsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await _ensureTelegramApprovalsSchemaImpl();
      globalThis.__mwaTelegramApprovalsSchemaEnsured = true;
    } finally {
      globalThis.__mwaTelegramApprovalsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaTelegramApprovalsSchemaLock = lockPromise;
  await lockPromise;
}

async function _ensureTelegramApprovalsSchemaImpl() {
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS telegram_approvals (
      telegram_id VARCHAR(64) PRIMARY KEY,
      wallet_address VARCHAR(255) NOT NULL,
      mwa_user_id CHAR(36),
      approved INTEGER NOT NULL DEFAULT 0,
      nft_contract VARCHAR(255),
      verified_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_telegram_approvals_wallet ON telegram_approvals(wallet_address)`
    );
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_telegram_approvals_approved ON telegram_approvals(approved)`
    );
  } catch {
    // indexes may already exist
  }
}
