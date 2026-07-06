-- ============================================================================
-- Forward references for guide prerequisites (BlueLearn integration — Phase 4)
-- ============================================================================
-- Allows contributors to declare "this guide depends on topic X" even when X
-- does not yet exist as a guide. Forward refs live in their own table and are
-- resolved automatically when a guide with a matching topic_title is created.
--
-- Resolution: on INSERT into guides, resolveForwardRefs() checks for any
-- unresolved forward refs whose topic_title matches the new guide's title.
-- When a match is found, an actual guide_edges row is inserted (prereq=new
-- guide, guide=declaring guide) and the forward ref is marked resolved.
--
-- Unresolved forward refs do NOT participate in the DAG level computation or
-- the walkthrough completion gating — they cannot, since the referenced guide
-- does not exist yet. They are purely a planning tool for contributors.
-- ============================================================================

CREATE TABLE IF NOT EXISTS guide_forward_refs (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guide_id CHAR(36) NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  created_by CHAR(36) NOT NULL REFERENCES users(id),
  resolved_guide_id CHAR(36) REFERENCES guides(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (guide_id, topic_title)
);

CREATE INDEX IF NOT EXISTS idx_guide_forward_refs_guide
  ON guide_forward_refs(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_forward_refs_topic
  ON guide_forward_refs(topic_title);
CREATE INDEX IF NOT EXISTS idx_guide_forward_refs_unresolved
  ON guide_forward_refs(resolved_guide_id)
  WHERE resolved_guide_id IS NULL;

ALTER TABLE guide_forward_refs ENABLE ROW LEVEL SECURITY;
