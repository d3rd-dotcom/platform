import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaCustomQuestsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaCustomQuestsSchemaLock: Promise<void> | undefined;
}

export async function ensureCustomQuestsSchema() {
  if (globalThis.__mwaCustomQuestsSchemaEnsured) return;

  if (globalThis.__mwaCustomQuestsSchemaLock) {
    await globalThis.__mwaCustomQuestsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await _ensureCustomQuestsSchemaImpl();
      globalThis.__mwaCustomQuestsSchemaEnsured = true;
    } finally {
      globalThis.__mwaCustomQuestsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaCustomQuestsSchemaLock = lockPromise;
  await lockPromise;
}

async function _ensureCustomQuestsSchemaImpl() {
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS custom_quests (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      description TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 50,
      quest_type VARCHAR(40) NOT NULL DEFAULT 'no-proof',
      target_count INTEGER NOT NULL DEFAULT 1,
      created_by CHAR(36) NOT NULL,
      creator_wallet VARCHAR(255) NOT NULL,
      creator_handle VARCHAR(64),
      assignee_wallet VARCHAR(255),
      expires_at TIMESTAMP,
      archived_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Escrow columns — added in the Blue chat "Quest forge" work. A creator now
  // funds the reward up front and Blue holds it until a completer is paid.
  //   reward_kind     'credits' (in-app shards) or 'usdc' (real money on Base)
  //   reward_amount   what each completer receives (credits as a whole number,
  //                   or USDC with up to 6 dp)
  //   escrow_total    reward_amount × target_count — the full amount Blue holds
  //   escrow_remaining what is left to pay out; decremented on each payout
  //   escrow_status   'pending_funding' (USDC awaiting on-chain deposit),
  //                   'funded' (live and payable), or 'depleted'
  //   funding_tx_hash the creator's USDC deposit transaction to Blue's wallet
  //
  // Legacy rows created before escrow keep reward_amount / escrow_remaining
  // NULL; the completion flow treats a NULL escrow as "mint credits as before",
  // so nothing changes for quests that predate this feature.
  const addColumns: Array<[string, string]> = [
    ['reward_kind', `VARCHAR(10) NOT NULL DEFAULT 'credits'`],
    ['reward_amount', 'NUMERIC(14, 6)'],
    ['escrow_total', 'NUMERIC(16, 6)'],
    ['escrow_remaining', 'NUMERIC(16, 6)'],
    ['escrow_status', `VARCHAR(20) NOT NULL DEFAULT 'funded'`],
    ['funding_tx_hash', 'VARCHAR(66)'],
  ];
  for (const [name, type] of addColumns) {
    try {
      await sqlQuery(`ALTER TABLE custom_quests ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    } catch {
      // column may already exist on older Postgres without IF NOT EXISTS support
    }
  }

  try {
    await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_custom_quests_created_by ON custom_quests(created_by)`);
    await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_custom_quests_assignee ON custom_quests(LOWER(assignee_wallet))`);
    await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_custom_quests_active ON custom_quests(archived_at) WHERE archived_at IS NULL`);
  } catch {
    // indexes may already exist
  }
}
