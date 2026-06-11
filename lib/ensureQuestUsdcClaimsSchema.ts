import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaQuestUsdcClaimsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaQuestUsdcClaimsSchemaLock: Promise<void> | undefined;
}

/**
 * Ledger for Blue-funded, staff-approved USDC quest bounties.
 *
 * A claim is created when an Academic Angel holder submits a flagged quest for
 * review (status 'pending'). A staff member (VIP membership card holder) either
 * rejects it or approves it, at which point Blue sends the USDC and the row is
 * marked 'paid' with the transaction hash. The UNIQUE (user_id, quest_id)
 * constraint guarantees a wallet can only ever be paid once per quest.
 */
export async function ensureQuestUsdcClaimsSchema() {
  if (globalThis.__mwaQuestUsdcClaimsSchemaEnsured) return;

  if (globalThis.__mwaQuestUsdcClaimsSchemaLock) {
    await globalThis.__mwaQuestUsdcClaimsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await _ensureQuestUsdcClaimsSchemaImpl();
      globalThis.__mwaQuestUsdcClaimsSchemaEnsured = true;
    } finally {
      globalThis.__mwaQuestUsdcClaimsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaQuestUsdcClaimsSchemaLock = lockPromise;
  await lockPromise;
}

async function _ensureQuestUsdcClaimsSchemaImpl() {
  // Despite the name, this table now backs creator-reviewed claims for BOTH
  // reward kinds. `reward_kind` = 'usdc' pays real money from Blue's wallet;
  // 'credits' draws the creator's escrowed diamonds. `usdc_amount` holds the
  // per-completion reward for either kind. recipient_wallet is only required for
  // USDC payouts, so it is nullable (credit completers may have no wallet).
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS quest_usdc_claims (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      quest_id VARCHAR(120) NOT NULL,
      recipient_wallet VARCHAR(255),
      usdc_amount NUMERIC(12, 6) NOT NULL,
      reward_kind VARCHAR(10) NOT NULL DEFAULT 'usdc',
      proof_text TEXT,
      proof_url TEXT,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      tx_hash VARCHAR(120),
      reviewed_by CHAR(36),
      note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_quest_usdc_claim_user_quest UNIQUE (user_id, quest_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Idempotent migrations for tables that predate the credit generalization.
  try {
    await sqlQuery(
      `ALTER TABLE quest_usdc_claims ADD COLUMN IF NOT EXISTS reward_kind VARCHAR(10) NOT NULL DEFAULT 'usdc'`,
    );
    await sqlQuery(
      `ALTER TABLE quest_usdc_claims ADD COLUMN IF NOT EXISTS proof_text TEXT`,
    );
    await sqlQuery(
      `ALTER TABLE quest_usdc_claims ADD COLUMN IF NOT EXISTS proof_url TEXT`,
    );
    await sqlQuery(
      `ALTER TABLE quest_usdc_claims ALTER COLUMN recipient_wallet DROP NOT NULL`,
    );
  } catch {
    // column/constraint may already be in the target state
  }

  try {
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_quest_usdc_claims_status ON quest_usdc_claims(status)`,
    );
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_quest_usdc_claims_user ON quest_usdc_claims(user_id)`,
    );
  } catch {
    // indexes may already exist
  }
}
