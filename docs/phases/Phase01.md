# Phase 01 — Guide DAG Schema

**Status:** Complete (reviewed). SQL not yet executed — run `db/migration-guides.sql` then `db/seed-guides.sql` in the Supabase SQL editor.

## Tables (`db/migration-guides.sql`)

- `guides` — slug + topic_title both UNIQUE (enforces one definitive guide per topic at the DB level), `body` JSONB in the course-renderer component-array format, status lifecycle `draft → pending_verification → published → unpublished/forked`, `canonical_group_id` reserved for Phase 5 spin-offs.
- `guide_edges` — the prerequisite DAG. `CHECK (prereq_id != guide_id)`, unique pair, and a BEFORE INSERT/UPDATE trigger (`guide_edges_reject_cycle`) that walks dependents of the new edge's guide via recursive CTE and rejects any insert that would reach back to the prereq — the DAG cannot go cyclic.
- `guide_subjects` — many-to-many tags. Subjects are filters, not containers (BlueLearn's key insight).
- `guide_methods` — alternate approaches nested inside their parent definitive guide, never separate guides.
- `guide_progress` — per-user completions; drives level gating.
- `guide_votes` — one vote per (user, guide). DB-enforced: downvotes MUST carry one of 8 rubric reasons (`unclear`, `factually_wrong`, `missing_step`, `outdated`, `broken_link`, `prereq_gap`, `wrong_level`, `scope_creep`); upvotes must not. Optional `section_pointer` for per-section flagging (feeds Phase 4 triggers).

RLS enabled on all six tables matching the repo convention (locked-down, app connects via BYPASSRLS role). FK indexes throughout. `updated_at` triggers reuse the existing `update_updated_at_column()`.

## Level computation (computed, never stored)

Level = longest prerequisite path from a primitive. Implemented in `lib/guides-db.ts` `getWalkthrough()`: recursive CTE builds the target's transitive prereq closure, keeps only in-closure edges, seeds primitives at level 0, relaxes upward, takes `MAX(level)` per node. Reviewed for correctness — this was flagged as the highest-risk item in the integration plan.

## Seed & cleanup

- `db/seed-guides.sql` — idempotent 7-guide, 3-level starter DAG (Attention Basics, Emotional Vocabulary → Journaling Practice, Cognitive Reframing, Mindful Breathing → Building a Daily Practice, Values Clarification) with subjects, methods, and edges. Valid `rich_text` bodies. No shadow-work references.
- `db/cleanup-custom-courses.sql` — optional, commented, NOT auto-run script to remove existing custom community/VIP courses if you decide to replace them. Deliberately left as a manual decision.

## Review notes

Cycle-trigger direction verified (walks forward from `NEW.guide_id`, rejects on reaching `NEW.prereq_id` — correct). Vote check constraints verified against the BlueLearn rubric spec. `char(36)` ids match the repo's existing key style. No existing tables modified.
