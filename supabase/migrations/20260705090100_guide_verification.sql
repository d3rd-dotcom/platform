-- ============================================================================
-- Guide Verification Migration (BlueLearn integration — Phase 3: Verifier Jury)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query), AFTER
-- db/migration-guides.sql and db/migration-proposals.sql.
--
-- Introduces the verifier-jury layer on top of the Phase 1 guide DAG:
--   * verifier_credentials  — who may sit on a panel, and for which subject/level
--   * verifier_panels       — one odd-numbered jury per guide submission
--   * verifier_panel_members— the drawn jurors for a panel
--   * verifier_panel_votes  — rubric-bound, justified approve/reject votes
--   * guide_cre_scores      — DON-signed ADVISORY AI score shown to the panel
--
-- DESIGN NOTE — why panels are STANDALONE (proposal_id nullable):
--   The integration plan suggested routing guide submissions through the existing
--   `proposals` pipeline with a new `guide_verification` type. In practice the
--   proposals table is welded to on-chain FUNDING: `wallet_address` is NOT NULL,
--   the create route hard-requires a valid on_chain_proposal_id + tx hash, and
--   `valid_status` / `proposal_reviews.valid_token_allocation` CHECK constraints
--   encode allocation-percentage semantics that make no sense for a guide.
--   Reusing it would force either destructive constraint edits (forbidden) or
--   fake wallet/on-chain values. So panels are standalone. `proposal_id` is kept
--   as a NULLABLE, ON DELETE SET NULL FK so a panel CAN be associated with a
--   proposal row later if the two systems ever converge — without any change to
--   the proposals table or its constraints. Nothing here alters existing tables.
--
-- RLS style matches db/migration-enable-rls-all-tables.sql: the app connects as
-- the postgres (BYPASSRLS) role via lib/db.ts, so RLS is enabled with no
-- policies to lock out the anon/authenticated Data API roles.
--
-- Does NOT modify any existing table. Does NOT touch shadow-work.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── verifier_credentials ─────────────────────────────────────────────────────
-- A user who passed the verifier test for a subject may sit on panels for that
-- subject up to max_level. Drawn from here at panel-selection time.
-- earned_via records HOW the credential was granted (e.g. 'test', 'seed',
-- 'admin_grant') for the audit trail feeding Phase 7 certificates.
CREATE TABLE IF NOT EXISTS verifier_credentials (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id CHAR(36) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  max_level INTEGER NOT NULL DEFAULT 0,
  earned_via TEXT NOT NULL DEFAULT 'test',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, subject),
  CONSTRAINT verifier_credentials_max_level_check CHECK (max_level >= 0)
);

-- ── verifier_panels ──────────────────────────────────────────────────────────
-- One jury per guide submission. proposal_id is NULLABLE (see design note).
-- status lifecycle: 'open' → 'approved' | 'rejected' once a majority is reached.
CREATE TABLE IF NOT EXISTS verifier_panels (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guide_id CHAR(36) NOT NULL,
  proposal_id CHAR(36) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL,
  CONSTRAINT verifier_panels_status_check CHECK (status IN ('open', 'approved', 'rejected'))
);

-- ── verifier_panel_members ───────────────────────────────────────────────────
-- The odd-numbered set of jurors drawn for a panel. One row per juror.
CREATE TABLE IF NOT EXISTS verifier_panel_members (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  panel_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (panel_id) REFERENCES verifier_panels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (panel_id, user_id)
);

-- ── verifier_panel_votes ─────────────────────────────────────────────────────
-- Rubric-bound votes. Business rule: a WRITTEN JUSTIFICATION is MANDATORY —
-- enforced at the DB level with a >= 40 character CHECK. A vote missing its
-- justification is invalid (and application logic counts it as a strike toward
-- credential revocation). Each juror votes at most once (unique panel_id,user_id).
CREATE TABLE IF NOT EXISTS verifier_panel_votes (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  panel_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  decision VARCHAR(8) NOT NULL,
  rubric_item VARCHAR(24) NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (panel_id) REFERENCES verifier_panels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (panel_id, user_id),
  CONSTRAINT verifier_panel_votes_decision_check CHECK (decision IN ('approve', 'reject')),
  CONSTRAINT verifier_panel_votes_rubric_item_check CHECK (
    rubric_item IN ('hierarchy_soundness', 'obvious_errors', 'duplication', 'scope')
  ),
  -- Mandatory written justification (business rule).
  CONSTRAINT verifier_panel_votes_justification_len CHECK (char_length(justification) >= 40)
);

-- ── guide_cre_scores ─────────────────────────────────────────────────────────
-- The DON-signed ADVISORY score from the cre-workflows/guide-review workflow.
-- This is INPUT DISPLAYED TO THE PANEL, never a panel vote. Written back via the
-- authenticated cre-score callback route (secret-header auth). One score per
-- panel (latest wins via upsert on panel_id).
CREATE TABLE IF NOT EXISTS guide_cre_scores (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  panel_id CHAR(36) NOT NULL,
  guide_id CHAR(36) NOT NULL,
  score INTEGER NOT NULL,
  summary TEXT NULL,
  sources JSONB NULL,
  don_signature TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (panel_id) REFERENCES verifier_panels(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  UNIQUE (panel_id),
  CONSTRAINT guide_cre_scores_range CHECK (score BETWEEN 0 AND 100)
);

-- ── Indexes on foreign keys ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_verifier_credentials_user ON verifier_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_verifier_credentials_subject ON verifier_credentials(subject);

CREATE INDEX IF NOT EXISTS idx_verifier_panels_guide ON verifier_panels(guide_id);
CREATE INDEX IF NOT EXISTS idx_verifier_panels_proposal ON verifier_panels(proposal_id);
CREATE INDEX IF NOT EXISTS idx_verifier_panels_status ON verifier_panels(status);

CREATE INDEX IF NOT EXISTS idx_verifier_panel_members_panel ON verifier_panel_members(panel_id);
CREATE INDEX IF NOT EXISTS idx_verifier_panel_members_user ON verifier_panel_members(user_id);

CREATE INDEX IF NOT EXISTS idx_verifier_panel_votes_panel ON verifier_panel_votes(panel_id);
CREATE INDEX IF NOT EXISTS idx_verifier_panel_votes_user ON verifier_panel_votes(user_id);

CREATE INDEX IF NOT EXISTS idx_guide_cre_scores_panel ON guide_cre_scores(panel_id);
CREATE INDEX IF NOT EXISTS idx_guide_cre_scores_guide ON guide_cre_scores(guide_id);

-- ── updated_at triggers (reuse existing update_updated_at_column) ────────────
DROP TRIGGER IF EXISTS update_verifier_credentials_updated_at ON verifier_credentials;
CREATE TRIGGER update_verifier_credentials_updated_at
  BEFORE UPDATE ON verifier_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_verifier_panels_updated_at ON verifier_panels;
CREATE TRIGGER update_verifier_panels_updated_at
  BEFORE UPDATE ON verifier_panels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Enable RLS (locked down, no policies — matches repo convention) ──────────
ALTER TABLE verifier_credentials    ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifier_panels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifier_panel_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifier_panel_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_cre_scores        ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
