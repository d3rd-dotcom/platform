-- ============================================================================
-- Guide Disputes & Spin-offs Migration (BlueLearn integration — Phase 5)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query), AFTER
-- db/migration-guides.sql and db/migration-guide-verification.sql.
--
-- Introduces the dispute layer on top of the verified guide DAG:
--   * guide_disputes        — one dispute a user opens against a guide
--   * dispute_panel_members — the odd-numbered moderator jury drawn per dispute
--   * dispute_panel_votes   — rubric-free but JUSTIFIED verdict votes
--
-- Panels mirror the verifier-panel mechanism (db/migration-guide-verification.sql):
-- odd-numbered random draw, drop-one on even, written justification mandatory,
-- with a conflict-of-interest exclusion (the guide's author and anyone who voted
-- on the guide's verifier panel can never sit on its dispute panel).
--
-- The `fork` verdict executes a SPIN-OFF: the guide row is duplicated, both the
-- original and the fork are stamped with a shared `canonical_group_id`
-- (guides.canonical_group_id, added in Phase 1), and each fork may be assigned a
-- distinct niche subject by the resolution. See lib/guide-disputes-db.ts.
--
-- RLS style matches db/migration-enable-rls-all-tables.sql: the app connects as
-- the postgres (BYPASSRLS) role via lib/db.ts, so RLS is enabled with no
-- policies to lock out the anon/authenticated Data API roles.
--
-- Does NOT modify any existing table. Does NOT touch shadow-work.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── guide_disputes ───────────────────────────────────────────────────────────
-- A user in good standing opens a dispute against a published guide.
--   dispute_type:
--     'factual'             — the guide contains a factual error
--     'cross_niche'         — the topic actually spans two niches (fork candidate)
--     'verification_appeal' — the original verification decision is challenged
--     'rereview_appeal'     — an auto-revision / re-review outcome is challenged
--   evidence: a written case, DB-enforced >= 80 chars (no drive-by disputes).
--   status lifecycle:
--     'open' → 'panel_drawn' → one of
--       'resolved_upheld'      (majority 'uphold'   — the dispute stands)
--       'resolved_overturned'  (majority 'overturn' — the guide is unpublished)
--       'resolved_forked'      (majority 'fork'     — spin-off executed)
--       'dismissed'            (majority 'dismiss'  — the dispute is thrown out)
CREATE TABLE IF NOT EXISTS guide_disputes (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guide_id CHAR(36) NOT NULL,
  opener_id CHAR(36) NOT NULL,
  dispute_type VARCHAR(24) NOT NULL,
  evidence TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  resolution_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  FOREIGN KEY (opener_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT guide_disputes_type_check CHECK (
    dispute_type IN ('factual', 'cross_niche', 'verification_appeal', 'rereview_appeal')
  ),
  CONSTRAINT guide_disputes_status_check CHECK (
    status IN (
      'open', 'panel_drawn',
      'resolved_upheld', 'resolved_overturned', 'resolved_forked', 'dismissed'
    )
  ),
  -- Written case mandatory: no drive-by disputes.
  CONSTRAINT guide_disputes_evidence_len CHECK (char_length(evidence) >= 80)
);

-- ── dispute_panel_members ────────────────────────────────────────────────────
-- The odd-numbered moderator jury drawn for a dispute. One row per juror.
CREATE TABLE IF NOT EXISTS dispute_panel_members (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dispute_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dispute_id) REFERENCES guide_disputes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (dispute_id, user_id)
);

-- ── dispute_panel_votes ──────────────────────────────────────────────────────
-- A drawn juror's verdict. Business rule: a WRITTEN JUSTIFICATION is MANDATORY —
-- enforced at the DB level with a >= 40 character CHECK. Each juror votes at most
-- once (unique dispute_id, user_id).
CREATE TABLE IF NOT EXISTS dispute_panel_votes (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dispute_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  verdict VARCHAR(8) NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dispute_id) REFERENCES guide_disputes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (dispute_id, user_id),
  CONSTRAINT dispute_panel_votes_verdict_check CHECK (
    verdict IN ('uphold', 'overturn', 'fork', 'dismiss')
  ),
  CONSTRAINT dispute_panel_votes_justification_len CHECK (char_length(justification) >= 40)
);

-- ── Indexes on foreign keys ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guide_disputes_guide ON guide_disputes(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_disputes_opener ON guide_disputes(opener_id);
CREATE INDEX IF NOT EXISTS idx_guide_disputes_status ON guide_disputes(status);

CREATE INDEX IF NOT EXISTS idx_dispute_panel_members_dispute ON dispute_panel_members(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_panel_members_user ON dispute_panel_members(user_id);

CREATE INDEX IF NOT EXISTS idx_dispute_panel_votes_dispute ON dispute_panel_votes(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_panel_votes_user ON dispute_panel_votes(user_id);

-- ── updated_at trigger (reuse existing update_updated_at_column) ──────────────
DROP TRIGGER IF EXISTS update_guide_disputes_updated_at ON guide_disputes;
CREATE TRIGGER update_guide_disputes_updated_at
  BEFORE UPDATE ON guide_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Enable RLS (locked down, no policies — matches repo convention) ──────────
ALTER TABLE guide_disputes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_panel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_panel_votes   ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
