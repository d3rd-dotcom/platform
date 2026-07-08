-- ============================================================================
-- Guide Author Verification Reward Migration (BlueLearn — money path)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
--
-- One-time diamond reward paid to a guide's AUTHOR when a verifier panel approves
-- their guide and it flips to published. Authoring a verified guide is worth more
-- than completing one (50) or clearing a level (150), and less than clearing a
-- whole walkthrough (500): GUIDE_VERIFIED_AUTHOR_REWARD = 250, the single source
-- of truth in lib/guide-rewards-db.ts.
--
-- Why a SEPARATE ledger table (not a new claim_type on guide_diamond_claims):
-- that table's UNIQUE (user_id, guide_id, claim_type) and its claim_type CHECK
-- (guide_complete / level_clear / walkthrough_complete) are load-bearing and must
-- not be altered (20260705090500_guide_rewards.sql). This ledger keys on the
-- GUIDE ALONE — UNIQUE (guide_id) — so the author is paid exactly once per guide
-- EVER, across resubmissions and re-verifications, even if the guide is rejected
-- and re-approved later. The idempotent credit follows the same pattern as
-- guide_diamond_claims: INSERT ... ON CONFLICT DO NOTHING, then credit
-- users.shard_count only when a row was actually inserted, inside the same
-- transaction that publishes the guide (lib/guide-verification-db.ts castPanelVote).
--
-- RLS style matches db/migration-guides.sql: the app connects as the `postgres`
-- role (BYPASSRLS) via lib/db.ts, so RLS is enabled with no policies to lock out
-- the anon/authenticated Data API roles.
--
-- Does NOT modify any existing table.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── guide_author_claims ──────────────────────────────────────────────────────
-- Idempotent one-per-guide author payout ledger. UNIQUE (guide_id) is what makes
-- the payout safe to attempt on every panel approval: a second approval (after a
-- reject-and-resubmit cycle, or a re-verification) inserts nothing and therefore
-- credits nothing. user_id records who was paid (the author at approval time).
CREATE TABLE IF NOT EXISTS guide_author_claims (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guide_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  diamonds INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (guide_id)
);

-- ── Indexes on foreign keys ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guide_author_claims_user ON guide_author_claims(user_id);
-- guide_id is already covered by the UNIQUE (guide_id) constraint's index.

-- ── Enable RLS (locked down, no policies — matches repo convention) ──────────
ALTER TABLE guide_author_claims ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
