import { sqlQuery } from './db';

/**
 * Self-applying schema for VIP membership purchases.
 *
 * One row per purchase attempt. A row is created in `pending` the moment a
 * Stripe PaymentIntent is opened and holds a slot in Blue's inventory until
 * `reserved_until`. The Stripe webhook drives it through paid -> transferring
 * -> transferred (or failed). On-chain inventory is Blue's ERC-1155 balance;
 * this table only tracks how much of it is already committed.
 */

declare global {
  // eslint-disable-next-line no-var
  var __mwaMembershipSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaMembershipSchemaLock: Promise<void> | undefined;
}

export async function ensureMembershipSchema(): Promise<void> {
  if (globalThis.__mwaMembershipSchemaEnsured) return;

  if (globalThis.__mwaMembershipSchemaLock) {
    await globalThis.__mwaMembershipSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await _ensureMembershipSchemaImpl();
      globalThis.__mwaMembershipSchemaEnsured = true;
    } finally {
      globalThis.__mwaMembershipSchemaLock = undefined;
    }
  })();

  globalThis.__mwaMembershipSchemaLock = lockPromise;
  await lockPromise;
}

async function _ensureMembershipSchemaImpl(): Promise<void> {
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS membership_orders (
      id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id CHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
      buyer_wallet VARCHAR(42) NOT NULL,
      token_id VARCHAR(78) NOT NULL DEFAULT '1',
      amount_cents INTEGER NOT NULL,
      currency VARCHAR(8) NOT NULL DEFAULT 'usd',
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'transferring', 'transferred', 'failed', 'expired')),
      stripe_payment_intent_id VARCHAR(255) UNIQUE,
      tx_hash VARCHAR(80) NULL,
      error TEXT NULL,
      reserved_until TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      transferred_at TIMESTAMP NULL
    )
  `);

  await sqlQuery(
    `CREATE INDEX IF NOT EXISTS idx_membership_orders_status ON membership_orders(status)`
  );
  await sqlQuery(
    `CREATE INDEX IF NOT EXISTS idx_membership_orders_wallet ON membership_orders(LOWER(buyer_wallet))`
  );
}

/**
 * Counts inventory slots that are already spoken for: every transferred or
 * in-flight order, plus pending orders whose reservation has not lapsed.
 * Expired pending orders are not counted, so abandoned checkouts free up.
 */
export async function countCommittedMemberships(tokenId: string): Promise<number> {
  const rows = await sqlQuery<Array<{ committed: string }>>(
    `SELECT COUNT(*)::int AS committed
       FROM membership_orders
      WHERE token_id = :tokenId
        AND (
          status IN ('paid', 'transferring', 'transferred')
          OR (status = 'pending' AND reserved_until > CURRENT_TIMESTAMP)
        )`,
    { tokenId }
  );
  return Number(rows[0]?.committed ?? 0);
}
