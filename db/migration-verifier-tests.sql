-- ============================================================================
-- Verifier Tests Migration (BlueLearn integration — Phase 7: Tiered Verifier
-- Testing)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query), AFTER
-- the base schema (db/schema.sql creates `generated_tests`) and
-- db/migration-guide-verification.sql (creates `verifier_credentials`).
--
-- Phase 7 reuses the existing AI test-generation flow (`generated_tests` +
-- `app/api/generate-test/`) for tiered VERIFIER-QUALIFICATION tests. A verifier
-- test is just a generated_tests row that is tagged so the verifier-test grader
-- can find it and know which subject/level it qualifies the user for.
--
-- The base `generated_tests` table has no tag column, so we add two NULLABLE
-- columns. Existing rows keep NULL `purpose` and are unaffected — the normal
-- survey flow never sets these, and the verifier grader only ever looks at rows
-- WHERE purpose = 'verifier_qualification'.
--
--   * purpose  — NULL for ordinary surveys; 'verifier_qualification' for the
--                tiered verifier tests this phase introduces.
--   * metadata — arbitrary JSON side-channel. For verifier tests it holds
--                { "subject": "...", "level": N } so grading knows which
--                credential to upsert on a pass. NULL for ordinary surveys.
--
-- Does NOT modify verifier_credentials. Does NOT drop/rename any column. Does
-- NOT touch shadow-work. Purely additive.
-- ============================================================================

ALTER TABLE generated_tests ADD COLUMN IF NOT EXISTS purpose  VARCHAR(40) NULL;
ALTER TABLE generated_tests ADD COLUMN IF NOT EXISTS metadata JSONB       NULL;

-- Partial index: the verifier grader always filters by purpose, so only index
-- the (small) verifier-test slice, not every survey row.
CREATE INDEX IF NOT EXISTS idx_generated_tests_verifier
  ON generated_tests(user_id, purpose)
  WHERE purpose = 'verifier_qualification';

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
