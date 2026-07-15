-- ============================================================================
-- Guide Assembly Theory Migration (BlueLearn — the Assemble game)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
--
-- A published guide is decomposed into its atomic claims ("axioms") grouped
-- under section "assemblies" (Assembly Theory framing). A learner steps through
-- every axiom, approving or flagging each one, thereby re-authoring the document
-- from its building blocks. Completing a full pass pays a one-time diamond
-- reward. The per-axiom verdicts double as a community-notes signal on the guide.
--
-- Decomposition is DETERMINISTIC and derived from guides.body (see
-- lib/guide-assembly.ts) — this migration stores the materialized result, it
-- does not compute it. content_version is a hash of the body the nodes were
-- derived from, so a changed body re-materializes cleanly.
--
-- Money path: guide_assembly_claims is a SEPARATE idempotent ledger, keyed
-- UNIQUE (user_id, guide_id) — one assembly reward per learner per guide, ever.
-- It deliberately does NOT touch guide_diamond_claims or its load-bearing
-- claim_type CHECK (20260705090500_guide_rewards.sql); it follows the same
-- INSERT ... ON CONFLICT DO NOTHING, then credit users.shard_count only when a
-- row was inserted, inside one transaction (lib/guide-rewards-db.ts).
--
-- RLS style matches the guides migrations: the app connects as the `postgres`
-- role (BYPASSRLS) via lib/db.ts, so RLS is enabled with no policies to lock out
-- the anon/authenticated Data API roles.
--
-- Does NOT modify any existing table. Does NOT touch shadow-work.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── guide_assembly_nodes ─────────────────────────────────────────────────────
-- The materialized decomposition of a guide. Two kinds:
--   assembly — a section grouping (parent_id NULL, label = section title)
--   axiom    — an atomic claim leaf (parent_id → its assembly, statement = text)
-- position orders siblings. axiom_hash is a normalized sha256 of the statement,
-- for cheap cross-guide reuse/dedup signals. content_version ties every node to
-- the guide body revision it was derived from (idempotent re-materialization).
CREATE TABLE IF NOT EXISTS guide_assembly_nodes (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guide_id CHAR(36) NOT NULL,
  parent_id CHAR(36) NULL,
  kind VARCHAR(16) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  label TEXT NULL,
  statement TEXT NULL,
  axiom_hash CHAR(64) NULL,
  content_version CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES guide_assembly_nodes(id) ON DELETE CASCADE,
  CONSTRAINT guide_assembly_nodes_kind_check CHECK (kind IN ('assembly', 'axiom'))
);

-- ── guide_assembly_runs ──────────────────────────────────────────────────────
-- One learner's pass over a guide's assembly. started_at is set on the first
-- verdict (drives the anti-instant-farm time gate). completed_at is stamped when
-- the reward is awarded. One run per (user, guide); content_version tracks which
-- decomposition the run is against.
CREATE TABLE IF NOT EXISTS guide_assembly_runs (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id CHAR(36) NOT NULL,
  guide_id CHAR(36) NOT NULL,
  content_version CHAR(64) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  UNIQUE (user_id, guide_id)
);

-- ── guide_assembly_verdicts ──────────────────────────────────────────────────
-- A learner's verdict on one axiom within their run. approve = endorse the claim
-- into their reconstruction; flag = mark it doubtful (feeds the community signal
-- + future dispute feeds). One verdict per (run, node); re-answering updates it.
CREATE TABLE IF NOT EXISTS guide_assembly_verdicts (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id CHAR(36) NOT NULL,
  node_id CHAR(36) NOT NULL,
  verdict VARCHAR(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES guide_assembly_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES guide_assembly_nodes(id) ON DELETE CASCADE,
  UNIQUE (run_id, node_id),
  CONSTRAINT guide_assembly_verdicts_verdict_check CHECK (verdict IN ('approve', 'flag'))
);

-- ── guide_assembly_claims ────────────────────────────────────────────────────
-- Idempotent one-per-(user, guide) reward ledger for a completed assembly pass.
-- UNIQUE (user_id, guide_id) is what makes awardAssemblyReward safe to attempt
-- on every completion: a second call inserts nothing and credits nothing.
CREATE TABLE IF NOT EXISTS guide_assembly_claims (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id CHAR(36) NOT NULL,
  guide_id CHAR(36) NOT NULL,
  diamonds INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  UNIQUE (user_id, guide_id)
);

-- ── Indexes on foreign keys / hot paths ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guide_assembly_nodes_guide ON guide_assembly_nodes(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_assembly_nodes_parent ON guide_assembly_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_guide_assembly_nodes_guide_kind ON guide_assembly_nodes(guide_id, kind);
CREATE INDEX IF NOT EXISTS idx_guide_assembly_nodes_hash ON guide_assembly_nodes(axiom_hash);

CREATE INDEX IF NOT EXISTS idx_guide_assembly_runs_user ON guide_assembly_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_assembly_runs_guide ON guide_assembly_runs(guide_id);

CREATE INDEX IF NOT EXISTS idx_guide_assembly_verdicts_run ON guide_assembly_verdicts(run_id);
CREATE INDEX IF NOT EXISTS idx_guide_assembly_verdicts_node ON guide_assembly_verdicts(node_id);

CREATE INDEX IF NOT EXISTS idx_guide_assembly_claims_user ON guide_assembly_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_assembly_claims_guide ON guide_assembly_claims(guide_id);

-- ── updated_at trigger (reuse existing update_updated_at_column) ──────────────
DROP TRIGGER IF EXISTS update_guide_assembly_verdicts_updated_at ON guide_assembly_verdicts;
CREATE TRIGGER update_guide_assembly_verdicts_updated_at
  BEFORE UPDATE ON guide_assembly_verdicts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Enable RLS (locked down, no policies — matches repo convention) ──────────
ALTER TABLE guide_assembly_nodes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_assembly_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_assembly_verdicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_assembly_claims   ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
