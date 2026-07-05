# BlueLearn → Mental Wealth Academy: Implementation Plan

**Date:** 2026-07-05
**Verdict on BlueLearn code:** No portable code. Their stack (React 19 / TanStack Start / Hono on Cloudflare Workers / Supabase) is incompatible with our Next.js 14 + raw Postgres app, and their code is AGPL-3.0 (copying it would force us to open-source). Their value is the **spec** — the DAG data model, level computation, verifier rubric, downvote rubric, and re-review triggers in `docs/overall-system.md` are solid. Re-implement clean-room.

**Reuse map (per architecture diagram):**

| BlueLearn concept | We reuse | Path |
|---|---|---|
| Guide levels & content | Course system | `app/course/`, `app/courses/`, `app/course-builder/`, `academy_*` + `vip_courses` tables |
| Jury & disputes | Voting engine | `app/api/voting/`, `proposals` / `proposal_reviews` tables, `contracts/src/BlueKillStreak.sol` |
| AI verification | Chainlink CRE | `cre-workflows/blue-review/` (extend with new action type) |
| Certificates | Existing contract | `contracts/src/SurveyCertificates.sol` |
| Materials marketplace | Shop | `app/shop/`, Diamonds/Stripe flow |

**Untouchable:** `app/shadow-work/` — no changes, no dependencies added to it. Guides may *link into* shadow-work materials (Phase 6) but never modify it.

**Divergence from BlueLearn (intentional):** we are not free-everything (keep Diamonds/VIP gates), and we lead with gamification (leveling-up as the fatigue-killer), not a bare knowledge vector.

---

## Phase 0 — Messaging & feature cut (no schema, 1–2 days)

1. Rewrite `README.md` around three sentences: what MWA is, why gamified leveling beats tutorial-hell, what the knowledge ecosystem guarantees (one definitive guide per topic, verified, level-gated).
2. Apply same copy to landing/homepage: `components/home-bento/`, `components/landing/`, `app/page.tsx`.
3. Feature cut: list every route in `app/` and mark keep / merge / kill against the three sentences above. Candidates to fold into guides or cut: `library`, `guidebook`, `research`, `daily-read` overlap. Decide before Phase 1 so new tables don't serve dead features.

## Phase 1 — Schema: the guide DAG (foundation, blocks everything else)

New migration `db/migration-guides.sql`:

1. `guides` — id, slug, topic_title (unique — enforces one definitive guide per topic), body (MDX/JSON matching `course_components` renderer format), status (`draft`, `pending_verification`, `published`, `unpublished`, `forked`), author_id, canonical_group_id (for spin-offs), created/updated.
2. `guide_edges` — prereq_id → guide_id, unique pair, `CHECK (prereq_id != guide_id)`. Add cycle check via trigger (recursive CTE) — the DAG is only useful if it stays acyclic.
3. `guide_subjects` — many-to-many tags (subjects are filters, not containers).
4. `guide_methods` — parent_guide_id, title, body, sort_order. Methods nest inside the definitive guide, never become separate guides.
5. `guide_votes` — user_id, guide_id, direction, rubric_reason (required for downvotes: `unclear`, `factually_wrong`, `missing_step`, `outdated`, `broken_link`, `prereq_gap`, `wrong_level`, `scope_creep`), optional section pointer. Unique (user_id, guide_id).
6. `guide_progress` — user_id, guide_id, completed_at (drives level gating + XP).
7. Enable RLS consistent with `db/migration-enable-rls-all-tables.sql`.

Level is **computed, not stored**: longest prereq path via recursive CTE. Put it in `lib/` as `getGuideLevels(targetGuideId)` and cache.

## Phase 2 — Hierarchical knowledge base in /courses

1. New route `app/guides/[slug]/page.tsx` reusing `components/course-renderers/` for body content — guides are course content with a DAG on top.
2. Walkthrough view: pick a target guide → render its prereq closure grouped by computed level, bottom-up. "Level 3 of 5" progress indicator — this is the leveling-up hook; wire completions into the existing quests/XP/diamonds loop so each level cleared pays out like a quest.
3. Gate rule: level N+1 guides lock until all level-N guides in the walkthrough are in `guide_progress`. Enforce in API (`app/api/guides/progress/`), display in UI.
4. Authoring: extend `app/course-builder/` with a guide mode — declare prereqs (autocomplete against existing guides; unknown prereqs saved as TODO placeholders), declare subject tags.
5. Dedupe at authoring time: title autocomplete ("did you mean X?") + pg_trgm similarity warning at submit. Verifiers are the final duplicate check (Phase 3).

## Phase 3 — Verifier jury (reuse voting engine + CRE)

1. Submission flow: guide submit creates a row in `proposals` with a new type `guide_verification` (reuse `db/migration-proposals.sql` pipeline rather than a parallel system).
2. Panel selection: new `verifier_panels` table — odd-numbered (n=3 to start), randomly drawn from users who passed the verifier test for that subject+level (`verifier_credentials` table: user_id, subject, max_level, earned_via test). If pool draw is even, drop one (business rule).
3. Rubric-bound votes: verifiers vote approve/reject citing exactly one rubric item (hierarchy soundness, obvious errors, duplication, scope). **Written justification required; missing justification = vote invalid + strike toward credential revocation.** Store in `proposal_reviews`.
4. CRE as the AI juror: extend `cre-workflows/blue-review/` with a new action type (`guide_review`) — DON-signed multi-source verification score written on-chain via the existing `BlueKillStreak` `onReport()` path. CRE score is advisory input shown to the panel, not a panel vote.
5. Public audit log: verification decisions + justifications rendered on the guide page (reuse proposal detail UI from `app/api/voting/proposal`).

## Phase 4 — User voting & auto-revision

1. Upvote = one click. Downvote = rubric reason required (Phase 1 table already enforces).
2. Public display: totals only. Moderator view: full rubric + per-section breakdown.
3. Auto-revision trigger (cron or `workers/`): if within a rolling window a guide crosses **any** of — downvote ratio threshold, weighted-rubric threshold (weight `factually_wrong`/`missing_step`/`prereq_gap` heavier), or single-section flag density — **and** total votes exceed a minimum floor, set status `unpublished` and notify author. Low-volume guides can't trigger (brigade protection).

## Phase 5 — Disputes & spin-offs

1. `disputes` table: guide_id, opener_id (must be in good standing — reuse existing standing/reputation checks; spam-flagging authority for auditors), evidence text, status.
2. Dispute panels: odd-numbered moderator pool via the same `verifier_panels` mechanism, auto-eject one on even count, written justifications required, conflict-of-interest exclusion (author, original verifiers).
3. Spin-off resolution: on `fork` verdict, duplicate the guide row, assign both the same `canonical_group_id`, tag each fork to its niche subject. Prereq edges copy to both; future edges must pick a fork explicitly.

## Phase 6 — Contextual materials marketplace

1. `guide_materials` table: guide_id, product name, image, link (internal `app/shop/` item or external), rationale text.
2. "Materials" section component on guide pages (e.g. shadow-work-adjacent guides list notebook, journal, jar — linking near shadow-work without touching it).
3. Enforce contextual matching: materials attach only to guides that actually use them — make rationale a required field and include materials in verifier scope.
4. Monetization hook (our divergence from BlueLearn): shop items purchasable with Diamonds/Stripe as already built.

## Phase 7 — Verifier testing & certificates

1. Tiered verifier tests per subject+level — reuse `generated_tests` table + `app/api/generate-test/`. Pass → insert `verifier_credentials` row.
2. Optional: mint credential via `SurveyCertificates.sol` so verifier status is on-chain and portable.

---

## Sequencing & effort

```
P0 messaging ──┐
P1 schema ─────┼─→ P2 knowledge base ─→ P3 jury ─→ P4 voting ─→ P5 disputes
               └────────────────────────────────→ P6 marketplace (parallel after P1)
                                        P7 tests (parallel after P3 panel tables)
```

Rough effort: P0–P2 ≈ 2–3 weeks (bulk of user-visible value), P3 ≈ 1–2 weeks (mostly reuse), P4–P7 ≈ 1 week each. Highest-risk item: DAG cycle-prevention + level computation correctness — write SQL tests for it first. Lowest-value-per-effort: P5 disputes — defer until guide volume justifies it.
