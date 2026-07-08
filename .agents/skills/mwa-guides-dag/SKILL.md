---
name: mwa-guides-dag
description: Guardrails and invariants for the guides knowledge DAG. Use before ANY change to guides, guide_edges, prerequisites, walkthroughs, levels, the knowledge map, guide rewards, verification panels, or guide content in the database — schema, queries, API routes, scripts, or seed data. Protects acyclicity, computed levels, the published-only contract, and the diamond reward money path.
version: 1.0.0
user-invocable: true
---

The guides DAG is the knowledge backbone of Mental Wealth Academy: one definitive guide per topic, connected by prerequisite edges, with computed levels, jury verification, and onchain-bound diamond rewards. It is easy to corrupt from a distance — several queries must agree with each other exactly, and one of them pays money. Read this whole file before touching anything it names.

## Mental model

- `guides` — one row per topic; `topic_title` is UNIQUE (this IS the dedupe mechanism). Status: draft, pending_verification, published, unpublished, forked.
- `guide_edges` — `prereq_id -> guide_id`, "prereq must be completed before guide."
- **Level is computed, never stored** — longest path from a primitive (guide with no prereqs = level 0), via recursive CTE. There is no level column and there must never be one.
- Walkthrough = the full prerequisite closure of a target guide, gated level-by-level.
- Frontier = published, uncompleted guides whose direct published prereqs are all complete.
- Knowledge map = the whole published graph with globally computed levels.

## Invariants — breaking any of these is a production incident

1. **Acyclicity is enforced by the database.** The `guide_edges_cycle_check` trigger (supabase/migrations/20260705090000_guides_dag.sql) rejects any edge that would create a cycle. If an insert fails with a cycle error, that is the system working: report it, do not drop, disable, or route around the trigger, and do not "fix" it by deleting other edges without being asked.

2. **The published-only lockstep.** These functions all traverse published-to-published edges only, and they must stay in agreement: `completeGuide` (gate), `getWalkthrough` (closure), `awardGuideRewards` (payout closure), `getFrontierGuides`, `getKnowledgeMap` — all in lib/guides-db.ts and lib/guide-rewards-db.ts. If you change status semantics in one, mirror it in all of them in the same commit, or bonuses strand / drafts leak into gating.

3. **The reward path is a money path — fail-closed, idempotent, trustless toward its caller.** `awardGuideRewards` re-checks inside its own transaction that the guide exists, is published, and is not authored by the completing user, and every payout is guarded by `ON CONFLICT DO NOTHING` against `guide_diamond_claims` UNIQUE (user_id, guide_id, claim_type). Never remove a re-check because "the route already checks it." Never credit `users.shard_count` outside that transaction. The exploit this design closed: a self-created draft with no prereqs paid all three tiers (710 diamonds) repeatably. Do not reintroduce that class.

4. **Reward amounts have one source.** `GUIDE_COMPLETE_REWARD` and the multipliers in lib/guide-rewards-db.ts are exported and consumed by the walkthrough reward preview. Change amounts there only; never hardcode a diamond number in UI or a second constant.

5. **One definitive guide per topic.** Duplicates are prevented by the UNIQUE `topic_title` and resolved by verifiers/disputes, with forks sharing a `canonical_group_id`. Never work around a title collision by tweaking the title ("Journaling Practice 2") — that defeats the entire model.

6. **Forward refs are planning data, not edges.** `guide_forward_refs` rows do not participate in levels, gating, or closures. They auto-resolve into real edges when a guide with a matching `topic_title` is inserted — if you touch guide creation, preserve the `resolveForwardRefs` call path.

7. **Verification is transactional and fail-closed.** `submitGuideForVerification` flips status and draws an odd-numbered panel in one transaction; an empty verifier pool throws before any write. Panels draw from `verifier_credentials` (earned via test, or seeded with scripts/seed-verifier-credentials.ts). The CRE score is ADVISORY, server-generated via Eliza — the Chainlink DON path is documented but unimplemented; do not build on it without asking.

8. **Schema changes are additive migrations only.** New migration file in supabase/migrations/, never ALTER existing constraints or the status CHECK enum casually, RLS enabled with no policies (app connects as postgres, per repo convention). Never modify tables owned by other systems (proposals, users) for a guides feature.

9. **Untouchables.** app/shadow-work: no changes, no new dependencies. components/course-renderers/ComponentRenderer.tsx is shared with courses: style guides only through scoped overrides (see the guide-wikipedia-style skill). Deployed contracts are immutable.

## Making changes safely

- **New graph query:** copy the recursive-CTE pattern from `getWalkthrough` (closure walk, then longest-path relaxation with a final MAX GROUP BY). Join `guides` on status='published' inside the recursive step, so unpublished nodes prune the walk.
- **New API route:** mirror app/api/guides/progress/route.ts exactly — `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `isDbConfigured` guard, `requireUser` from lib/guide-api-auth.ts, request/response schemas in lib/guide-api-schemas.ts.
- **Content edits (guide bodies):** `guides.body` is JSONB in the course_components renderer format. Bulk edits go through a script in scripts/ (copy an existing script's env-loading convention); pair a data fix with a render-side guard so bad legacy data cannot resurface.
- **Seeding graph data:** insert guides first, then edges (the cycle trigger needs both endpoints to exist); set status explicitly — remember only published guides gate, pay, or appear on the map.
- **Tests:** tests/integration/db.test.ts and rewards.test.ts contain verbatim ports of the closure/level CTEs — if you change a CTE, update the port in the same commit. They gate on `TEST_DATABASE_URL` and skip without it; `npx tsc --noEmit` is the minimum bar, say honestly what did and did not run.

## Deliberately deferred — do not build without an explicit ask

- Fractional/weighted prerequisite edges (breaks the boolean gating contract; a required/helpful two-value edge type is the agreed future shape).
- Stored levels or any denormalized graph metric without an agreed recompute story (centrality, if built, recomputes on edge-write into its own table — never a frequent cron; Vercel Hobby allows daily-or-less only).
- New reward tiers, emission pools, or changes to what actions pay diamonds.
- The Chainlink DON / on-chain CRE score path.
- A second, parallel DAG or "node" system — extend guides instead.

## Before you finish

- `npx tsc --noEmit` passes.
- Every function in the published-only lockstep list still agrees with the others.
- No new code path credits diamonds without a `guide_diamond_claims` row created in the same transaction.
- The cycle trigger, unique constraints, and status CHECK are untouched.
- If anything in this file blocked what you were asked to do, say so plainly instead of working around it.
