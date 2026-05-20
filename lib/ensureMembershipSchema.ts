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

  // Crypto checkout columns — added for wallets paying Blue directly in
  // USDC or ETH instead of going through Stripe. Older deployments created
  // the table without these, so each is added conditionally.
  await sqlQuery(
    `ALTER TABLE membership_orders
       ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'stripe'`
  );
  await sqlQuery(
    `ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(8)`
  );
  await sqlQuery(
    `ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS payment_tx_hash VARCHAR(80)`
  );
  await sqlQuery(
    `ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS eth_amount_wei VARCHAR(40)`
  );
  await sqlQuery(
    `ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS usdc_amount VARCHAR(40)`
  );
  // How many times NFT delivery has been attempted — caps retries so a
  // permanently broken order is not retried forever by the reconcile sweep.
  await sqlQuery(
    `ALTER TABLE membership_orders
       ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0`
  );
  // Set the first time the buyer is shown the "welcome to premium" screen.
  await sqlQuery(
    `ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS welcomed_at TIMESTAMP`
  );

  await sqlQuery(
    `CREATE INDEX IF NOT EXISTS idx_membership_orders_status ON membership_orders(status)`
  );
  await sqlQuery(
    `CREATE INDEX IF NOT EXISTS idx_membership_orders_wallet ON membership_orders(LOWER(buyer_wallet))`
  );
  // A single incoming crypto payment can only ever fulfil one order.
  await sqlQuery(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_orders_payment_tx
       ON membership_orders(payment_tx_hash) WHERE payment_tx_hash IS NOT NULL`
  );
}

/**
 * Counts inventory slots that are already spoken for: every transferred or
 * in-flight order, plus one active pending reservation per buyer wallet.
 * Expired pending orders are not counted unless a payment has already been
 * recorded, so abandoned duplicate checkouts free up.
 */
export async function countCommittedMemberships(tokenId: string): Promise<number> {
  const rows = await sqlQuery<Array<{ committed: string }>>(
    `SELECT (
        SELECT COUNT(*)::int
          FROM membership_orders
         WHERE token_id = :tokenId
           AND (
             status IN ('paid', 'transferring', 'transferred')
             OR (status = 'failed' AND delivery_attempts > 0)
             OR (status IN ('pending', 'expired') AND payment_tx_hash IS NOT NULL)
           )
      ) + (
        SELECT COUNT(*)::int
          FROM (
            SELECT DISTINCT LOWER(buyer_wallet)
              FROM membership_orders
             WHERE token_id = :tokenId
               AND status = 'pending'
               AND reserved_until > CURRENT_TIMESTAMP
               AND payment_tx_hash IS NULL
          ) pending_reservations
      ) AS committed`,
    { tokenId }
  );
  return Number(rows[0]?.committed ?? 0);
}

/**
 * Expires abandoned checkouts: pending orders whose reservation has lapsed and
 * which carry no recorded payment. Orders with a payment_tx_hash are left alone
 * — those are paid and belong to the delivery pipeline, not the bin.
 *
 * Returns the number of orders expired.
 */
export async function expireStaleMembershipOrders(): Promise<number> {
  const rows = await sqlQuery<Array<{ id: string }>>(
    `UPDATE membership_orders
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'pending'
        AND reserved_until < CURRENT_TIMESTAMP
        AND payment_tx_hash IS NULL
      RETURNING id`
  );
  return rows.length;
}
