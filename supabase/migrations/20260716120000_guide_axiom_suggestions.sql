-- ============================================================================
-- Guide Axiom Suggestions Migration (Assemble game — VIP rewrite proposals)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
--
-- VIP members reviewing a guide's assembly can propose a rewrite of an axiom
-- instead of merely flagging it. A suggestion is stored alongside the member's
-- flag verdict (the verdict keeps the community signal and the run progress;
-- the suggestion carries the proposed replacement text). Suggestions queue as
-- 'pending' for Blue to fold into the guide; 'applied' / 'declined' record her
-- decision. This table is additive — it does not modify guide_assembly_* or
-- any CHECK constraint they own.
--
-- One live suggestion per (user, axiom): resubmitting replaces the text and
-- resets status to 'pending'.
--
-- RLS style matches the guides migrations: the app connects as the `postgres`
-- role (BYPASSRLS) via lib/db.ts, so RLS is enabled with no policies.
-- ============================================================================

CREATE TABLE IF NOT EXISTS guide_axiom_suggestions (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  node_id CHAR(36) NOT NULL,
  guide_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  suggested_statement TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES guide_assembly_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, node_id),
  CONSTRAINT guide_axiom_suggestions_status_check
    CHECK (status IN ('pending', 'applied', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_guide_axiom_suggestions_guide
  ON guide_axiom_suggestions(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_axiom_suggestions_node
  ON guide_axiom_suggestions(node_id);
CREATE INDEX IF NOT EXISTS idx_guide_axiom_suggestions_user
  ON guide_axiom_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_axiom_suggestions_status
  ON guide_axiom_suggestions(status);

DROP TRIGGER IF EXISTS update_guide_axiom_suggestions_updated_at ON guide_axiom_suggestions;
CREATE TRIGGER update_guide_axiom_suggestions_updated_at
  BEFORE UPDATE ON guide_axiom_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE guide_axiom_suggestions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
