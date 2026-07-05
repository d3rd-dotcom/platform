-- ============================================================================
-- Guide DAG Migration (BlueLearn integration — Phase 1)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
--
-- Introduces the hierarchical "guide" knowledge base: one definitive guide per
-- topic, connected by prerequisite edges forming a DAG. Level is COMPUTED at
-- query time (longest prereq path), never stored — see lib/guides-db.ts.
--
-- RLS style matches db/migration-enable-rls-all-tables.sql: the app connects as
-- the `postgres` role (BYPASSRLS) via lib/db.ts, so RLS is enabled with no
-- policies to lock out the anon/authenticated Data API roles. Add explicit
-- policies only if client-side anon access is ever introduced.
--
-- Does NOT modify any existing table. Does NOT touch shadow-work.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── guides ──────────────────────────────────────────────────────────────────
-- topic_title is UNIQUE: this enforces "one definitive guide per topic".
-- body is JSONB holding an array of components in the course_components renderer
-- format ({ id, componentType, title, config }) consumed by
-- components/course-renderers/ComponentRenderer.tsx.
-- canonical_group_id groups a guide with its spin-off forks (Phase 5).
CREATE TABLE IF NOT EXISTS guides (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug VARCHAR(160) NOT NULL UNIQUE,
  topic_title VARCHAR(255) NOT NULL UNIQUE,
  body JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  author_id CHAR(36) NULL,
  canonical_group_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT guides_status_check CHECK (
    status IN ('draft', 'pending_verification', 'published', 'unpublished', 'forked')
  )
);

-- ── guide_edges ─────────────────────────────────────────────────────────────
-- prereq_id → guide_id: "prereq_id must be completed before guide_id".
CREATE TABLE IF NOT EXISTS guide_edges (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  prereq_id CHAR(36) NOT NULL,
  guide_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prereq_id) REFERENCES guides(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  UNIQUE (prereq_id, guide_id),
  CONSTRAINT guide_edges_no_self_loop CHECK (prereq_id != guide_id)
);

-- Cycle guard: before inserting edge (prereq_id → guide_id), a cycle is created
-- iff guide_id can already reach prereq_id through existing edges. Walk the
-- prereq-closure forward from guide_id with a recursive CTE and reject if we
-- ever reach the proposed prereq_id.
CREATE OR REPLACE FUNCTION guide_edges_reject_cycle()
RETURNS TRIGGER AS $$
DECLARE
  creates_cycle BOOLEAN;
BEGIN
  WITH RECURSIVE reachable AS (
    -- guides that NEW.guide_id is a prerequisite of (its dependents, walking down)
    SELECT e.guide_id AS node
    FROM guide_edges e
    WHERE e.prereq_id = NEW.guide_id
    UNION
    SELECT e.guide_id
    FROM guide_edges e
    JOIN reachable r ON e.prereq_id = r.node
  )
  SELECT EXISTS (
    SELECT 1 FROM reachable WHERE node = NEW.prereq_id
  ) INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION 'guide_edges: inserting % -> % would create a cycle in the guide DAG',
      NEW.prereq_id, NEW.guide_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guide_edges_cycle_check ON guide_edges;
CREATE TRIGGER guide_edges_cycle_check
  BEFORE INSERT OR UPDATE ON guide_edges
  FOR EACH ROW
  EXECUTE FUNCTION guide_edges_reject_cycle();

-- ── guide_subjects ──────────────────────────────────────────────────────────
-- Many-to-many subject tags (filters, not containers).
CREATE TABLE IF NOT EXISTS guide_subjects (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guide_id CHAR(36) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  UNIQUE (guide_id, subject)
);

-- ── guide_methods ───────────────────────────────────────────────────────────
-- Methods nest inside a definitive guide; they never become separate guides.
-- body is JSONB in the same renderer format as guides.body.
CREATE TABLE IF NOT EXISTS guide_methods (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parent_guide_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_guide_id) REFERENCES guides(id) ON DELETE CASCADE
);

-- ── guide_progress ──────────────────────────────────────────────────────────
-- Drives level gating + XP. One completion row per (user, guide).
CREATE TABLE IF NOT EXISTS guide_progress (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id CHAR(36) NOT NULL,
  guide_id CHAR(36) NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  UNIQUE (user_id, guide_id)
);

-- ── guide_votes ─────────────────────────────────────────────────────────────
-- Upvote = one click. Downvote requires a rubric_reason. Optional section
-- pointer for per-section flagging. One vote per (user, guide).
CREATE TABLE IF NOT EXISTS guide_votes (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id CHAR(36) NOT NULL,
  guide_id CHAR(36) NOT NULL,
  direction VARCHAR(8) NOT NULL,
  rubric_reason VARCHAR(24) NULL,
  section_pointer TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  UNIQUE (user_id, guide_id),
  CONSTRAINT guide_votes_direction_check CHECK (direction IN ('up', 'down')),
  CONSTRAINT guide_votes_rubric_reason_check CHECK (
    rubric_reason IS NULL OR rubric_reason IN (
      'unclear', 'factually_wrong', 'missing_step', 'outdated',
      'broken_link', 'prereq_gap', 'wrong_level', 'scope_creep'
    )
  ),
  -- Downvotes MUST cite a rubric reason; upvotes MUST NOT.
  CONSTRAINT guide_votes_downvote_requires_reason CHECK (
    (direction = 'down' AND rubric_reason IS NOT NULL) OR
    (direction = 'up' AND rubric_reason IS NULL)
  )
);

-- ── Indexes on foreign keys ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guides_author ON guides(author_id);
CREATE INDEX IF NOT EXISTS idx_guides_canonical_group ON guides(canonical_group_id);
CREATE INDEX IF NOT EXISTS idx_guides_status ON guides(status);

CREATE INDEX IF NOT EXISTS idx_guide_edges_prereq ON guide_edges(prereq_id);
CREATE INDEX IF NOT EXISTS idx_guide_edges_guide ON guide_edges(guide_id);

CREATE INDEX IF NOT EXISTS idx_guide_subjects_guide ON guide_subjects(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_subjects_subject ON guide_subjects(subject);

CREATE INDEX IF NOT EXISTS idx_guide_methods_parent ON guide_methods(parent_guide_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_guide_progress_user ON guide_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_progress_guide ON guide_progress(guide_id);

CREATE INDEX IF NOT EXISTS idx_guide_votes_user ON guide_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_guide_votes_guide ON guide_votes(guide_id);

-- ── updated_at triggers (reuse existing update_updated_at_column) ────────────
DROP TRIGGER IF EXISTS update_guides_updated_at ON guides;
CREATE TRIGGER update_guides_updated_at
  BEFORE UPDATE ON guides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_guide_methods_updated_at ON guide_methods;
CREATE TRIGGER update_guide_methods_updated_at
  BEFORE UPDATE ON guide_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_guide_votes_updated_at ON guide_votes;
CREATE TRIGGER update_guide_votes_updated_at
  BEFORE UPDATE ON guide_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Enable RLS (locked down, no policies — matches repo convention) ──────────
ALTER TABLE guides         ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_edges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_methods  ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_votes    ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
