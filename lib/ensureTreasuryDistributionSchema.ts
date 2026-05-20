import { sqlQuery } from './db';

let schemaEnsured = false;

export async function ensureTreasuryDistributionSchema() {
  if (schemaEnsured) return;

  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS treasury_distributions (
      epoch_key VARCHAR(32) PRIMARY KEY,
      requested_epoch_pnl_usdc NUMERIC(20,6) NOT NULL,
      realized_epoch_pnl_usdc NUMERIC(20,6) NOT NULL,
      realized_source VARCHAR(120) NOT NULL,
      wallet_address VARCHAR(255) NOT NULL,
      wallet_balance_usdc NUMERIC(20,6) NOT NULL,
      balance_cap_pct NUMERIC(8,6) NOT NULL,
      balance_cap_usdc NUMERIC(20,6) NOT NULL,
      hard_cap_usdc NUMERIC(20,6) NULL,
      approved_epoch_pnl_usdc NUMERIC(20,6) NOT NULL,
      distributable_usdc NUMERIC(20,6) NOT NULL,
      retained_usdc NUMERIC(20,6) NOT NULL,
      post_distribution_balance_usdc NUMERIC(20,6) NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      recipients_processed INTEGER NOT NULL DEFAULT 0,
      tx_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
      failed JSONB NOT NULL DEFAULT '[]'::jsonb,
      block_number BIGINT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ NULL,
      CONSTRAINT valid_treasury_distribution_status CHECK (
        status IN ('pending', 'completed', 'partial_failed', 'failed')
      )
    )
  `);

  await sqlQuery(`
    CREATE INDEX IF NOT EXISTS idx_treasury_distributions_created_at
      ON treasury_distributions(created_at DESC)
  `);

  schemaEnsured = true;
}
