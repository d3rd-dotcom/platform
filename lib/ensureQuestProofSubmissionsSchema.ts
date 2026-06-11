import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaQuestProofSubmissionsSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaQuestProofSubmissionsSchemaLock: Promise<void> | undefined;
}

/**
 * Ledger for proof-required quests (e.g. "Stories from the Field").
 *
 * Proof quests cannot be self-attested — diamonds are NOT minted when the user
 * clicks the button. Instead a submission is filed (status 'pending') and a
 * staff member (VIP membership card holder) reviews the work. Only on 'approve'
 * are the quest's diamonds awarded and a `quests` completion row written. The
 * UNIQUE (user_id, quest_id) constraint stops a wallet farming the same proof
 * quest, mirroring quest_usdc_claims.
 */
export async function ensureQuestProofSubmissionsSchema() {
  if (globalThis.__mwaQuestProofSubmissionsSchemaEnsured) return;

  if (globalThis.__mwaQuestProofSubmissionsSchemaLock) {
    await globalThis.__mwaQuestProofSubmissionsSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await _ensureQuestProofSubmissionsSchemaImpl();
      globalThis.__mwaQuestProofSubmissionsSchemaEnsured = true;
    } finally {
      globalThis.__mwaQuestProofSubmissionsSchemaLock = undefined;
    }
  })();

  globalThis.__mwaQuestProofSubmissionsSchemaLock = lockPromise;
  await lockPromise;
}

async function _ensureQuestProofSubmissionsSchemaImpl() {
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS quest_proof_submissions (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      quest_id VARCHAR(120) NOT NULL,
      shards INTEGER NOT NULL DEFAULT 0,
      file_name VARCHAR(255),
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      reviewed_by CHAR(36),
      note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_quest_proof_user_quest UNIQUE (user_id, quest_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  try {
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_quest_proof_status ON quest_proof_submissions(status)`,
    );
    await sqlQuery(
      `CREATE INDEX IF NOT EXISTS idx_quest_proof_user ON quest_proof_submissions(user_id)`,
    );
  } catch {
    // indexes may already exist
  }
}
