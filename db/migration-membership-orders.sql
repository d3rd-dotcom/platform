-- ============================================================================
-- VIP Membership Orders Migration
-- ============================================================================
-- Tracks card purchases of the VIP Membership ERC-1155 NFT. One row per
-- purchase attempt. The Stripe webhook drives status from pending -> paid ->
-- transferring -> transferred (or failed). On-chain inventory is Blue's
-- ERC-1155 balance; this table only records how much of it is committed.
--
-- This schema is also applied at runtime by lib/ensureMembershipSchema.ts.
-- ============================================================================

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
);

-- Crypto checkout: buyers can pay Blue's wallet directly in USDC or ETH on
-- Base instead of using Stripe. payment_tx_hash records the incoming payment.
ALTER TABLE membership_orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'stripe';
ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(8);
ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS payment_tx_hash VARCHAR(80);
ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS eth_amount_wei VARCHAR(40);
ALTER TABLE membership_orders ADD COLUMN IF NOT EXISTS usdc_amount VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_membership_orders_status ON membership_orders(status);
CREATE INDEX IF NOT EXISTS idx_membership_orders_wallet ON membership_orders(LOWER(buyer_wallet));
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_orders_payment_tx
  ON membership_orders(payment_tx_hash) WHERE payment_tx_hash IS NOT NULL;
