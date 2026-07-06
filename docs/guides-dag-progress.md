# DAG Improvement Progress

## Task 2 — Reward preview data (user-facing level-up clarity)

**Goal:** Expose diamond payout tiers in the walkthrough API so the frontend can show inline reward badges before a user commits to completing a guide.

### Changes

| File | Change |
|------|--------|
| `lib/guide-rewards-db.ts:8,20-21` | Export `GUIDE_COMPLETE_REWARD`, `LEVEL_CLEAR_REWARD`, `WALKTHROUGH_COMPLETE_REWARD` constants so the walkthrough layer can reference them |
| `lib/guides-db.ts` | Added `WalkthroughRewardPreview` interface and `rewardPreview` field to `Walkthrough` |
| `lib/guides-db.ts` | `getWalkthrough()` now populates `rewardPreview` with tier amounts |
| `components/guides/GuideWalkthrough.tsx` | New reward summary bar showing all three tiers, per-level reward badge on unlocked levels, per-node reward badge next to "Mark complete" button |
| `components/guides/GuideWalkthrough.module.css` | Styles for reward summary panel, level reward badge, node reward badge |

### What this unlocks

- Users see **before** completing a guide what they'll earn: +50 per guide, +150 per level clear, +500 + free spin for full walkthrough clear
- The gamification lever is no longer hidden until post-completion

### What to watch

- The reward summary only renders for `authenticated` users (unauthenticated viewers see the walkthrough without reward info)
- SVG diamond icon from `/icons/ui-diamond.svg` reused to stay consistent with the rest of the app

---

## Task 3 — DAG visualization in the contributor editor (contributor clarity)

**Goal:** Show contributors where their draft will sit in the skill tree so they can make informed prerequisite decisions.

### Changes

| File | Change |
|------|--------|
| `components/course-studio/GuideStudio.tsx` | Added `dagLevel` and `dependents` state; captured from guide detail API on load and on prereq refresh |
| `components/course-studio/GuideStudio.tsx` | `refreshPrereqs` now also re-fetches guide detail to get updated `level` and `dependents` after adding/removing prereqs |
| `components/course-studio/GuideStudio.tsx` | New "Skill tree position" card in the Prerequisites section showing computed level badge, prereq count, dependent count, or "Primitive guide" label |
| `components/course-studio/GuideStudio.module.css` | Styles for DAG position indicator card, level badge, counts |

### What this unlocks

- Contributors see their guide's **computed level** update in real-time as they add/remove prereqs
- They can see how many downstream guides depend on theirs
- Primitive guides (level 0, no prereqs) get labeled so the author understands they're starting a new branch
- No extra API calls — all data already existed in the guide detail endpoint, just wasn't surfaced in the editor

### What to watch

- The DAG position card only appears once the draft has been created (no `currentSlug` yet), matching the existing guard on the prereq picker
- Required adding an extra `GET /api/guides/:slug` call inside `refreshPrereqs` to keep level/dependents in sync

---

## Completed tasks

| # | Area | Status |
|---|------|--------|
| 2 | Reward preview data (walkthrough) | Done — `7c1e31d7` |
| 3 | DAG visualization for contributors (editor) | Done — `7c1e31d7` |
| 1 | Aggregate Knowledge Base progress (dashboard) | Done — `279f64b1` |
| 5 | Contribution-impact analytics (author stats) | Done — `1c559df9` |

## Remaining tasks

| # | Area | Focus | Effort |
|---|------|-------|--------|
| 4 | Prereq placeholder / forward references | Contributor-facing — allow marking "this guide depends on a topic that doesn't exist yet" | High (schema + trigger changes) |
