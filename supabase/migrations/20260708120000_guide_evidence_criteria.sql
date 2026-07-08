-- ============================================================================
-- Guide Evidence Criteria Migration (BlueLearn integration — verification aid)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
--
-- Adds observable "evidence criteria" to a guide: a short list of plain-language
-- statements a learner should be able to demonstrate once they have the topic
-- ("The learner can name three cognitive distortions in their own thinking").
-- Authors write them in the studio; verifier juries read them as part of judging
-- scope and soundness; the guide page renders them as a "what you'll be able to
-- do" list. They are guidance and display only — NOT a new rubric item, and they
-- do not touch the verification CHECK constraints.
--
-- Additive and nullable: existing guides keep NULL until an author fills them in.
-- No existing constraint, trigger, or column is altered. RLS is already enabled
-- on guides (20260705090000_guides_dag.sql); adding a column needs no RLS change.
--
-- Does NOT modify any constraint. Does NOT touch shadow-work.
-- ============================================================================

-- ── guides.evidence_criteria ────────────────────────────────────────────────
-- JSONB array of short observable strings, e.g.
--   ["The learner can name three cognitive distortions in their own thinking"]
-- Nullable: NULL means the author has not supplied criteria yet. The app clamps
-- the list to 2–5 entries at write time (lib/guides-db.ts); the column itself is
-- deliberately unconstrained so legacy/imported data can never fail to migrate.
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS evidence_criteria JSONB NULL;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
