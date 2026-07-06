-- ============================================================================
-- Guide Rewards Migration (BlueLearn integration — gamification wave)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
--
-- Diamond payouts for the guide walkthrough system. Mirrors the VIP claim
-- ledger (vip_diamond_claims): one immutable row per distinct reward, credited
-- once and only once via ON CONFLICT DO NOTHING. Diamonds are credited to the
-- same balance column the VIP flow uses — users.shard_count.
--
-- claim_type distinguishes the three payout tiers awarded as a walkthrough is
-- worked through:
--   guide_complete       — per-guide completion reward (matches the VIP
--                          COMPLETION_REWARD of 50)
--   level_clear          — 3x bonus when a completion finishes every guide at
--                          that level within the target's walkthrough closure
--   walkthrough_complete — 10x bonus (plus a spin's worth of diamonds) when the
--                          entire closure is complete
--
-- RLS style matches db/migration-guides.sql: the app connects as the `postgres`
-- role (BYPASSRLS) via lib/db.ts, so RLS is enabled with no policies to lock
-- out the anon/authenticated Data API roles.
--
-- Does NOT modify any existing table.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── guide_diamond_claims ─────────────────────────────────────────────────────
-- Idempotent reward ledger. The UNIQUE (user_id, guide_id, claim_type) constraint
-- is what makes awardGuideRewards safe to call on every completion: a second call
-- inserts nothing (ON CONFLICT DO NOTHING) and therefore credits nothing.
CREATE TABLE IF NOT EXISTS guide_diamond_claims (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id CHAR(36) NOT NULL,
  guide_id CHAR(36) NOT NULL,
  claim_type VARCHAR(24) NOT NULL,
  diamonds INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  UNIQUE (user_id, guide_id, claim_type),
  CONSTRAINT guide_diamond_claims_claim_type_check CHECK (
    claim_type IN ('guide_complete', 'level_clear', 'walkthrough_complete')
  )
);

-- ── Indexes on foreign keys ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guide_diamond_claims_user ON guide_diamond_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_diamond_claims_guide ON guide_diamond_claims(guide_id);

-- ── Enable RLS (locked down, no policies — matches repo convention) ──────────
ALTER TABLE guide_diamond_claims ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
