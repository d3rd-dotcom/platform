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

## Verifier credential seeding (bootstrap the jury pool)

**Goal:** `createVerifierPanel` / `submitGuideForVerification` in `lib/guide-verification-db.ts` draws its jury from `verifier_credentials`, and the only path that ever wrote to that table was passing a tiered verifier test (`lib/verifier-tests-db.ts`). At launch nobody holds a credential, so the first guide submission always dead-ends on "No verifiers are credentialed for this subject yet." The verification migration's comments anticipated `earned_via` values `'seed'` and `'admin_grant'`, but no code granted them.

### Changes

| File | Change |
|------|--------|
| `scripts/seed-verifier-credentials.ts` | New script — grants `verifier_credentials` rows with `earned_via = 'seed'`, idempotent on `(user_id, subject)`. Also supports `--list` to audit who holds credentials per subject |
| `lib/guide-verification-db.ts` | Reworded the empty-pool error in `submitGuideForVerification` to be clearer and warmer; added a comment documenting that the check runs before any write in the transaction, so an empty pool never leaves a guide stranded in `pending_verification` |

### Usage

```
npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts \
  --user=<id|email|wallet> --subject="Anxiety" --subject="Sleep hygiene" [--max-level=5]

npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts \
  --user=james@example.com --subjects="Anxiety,Sleep hygiene,Boundaries"

npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts --list
npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts --list --subject="Anxiety"
```

`--user` accepts a user id, email, or wallet address (auto-detected). `--max-level` defaults to 5 (the top tier reachable via the test path), so a seeded verifier is fully qualified out of the gate. Re-running with the same user and subject is a no-op — it will not raise an existing credential's level; use the tiered test path for that.

### What this unlocks

- James (or any trusted early contributor) can seat an initial jury pool per subject before the first guide is ever submitted, so `submitGuideForVerification` has someone to draw from
- `--list` gives a quick audit of coverage — which subjects have verifiers, and how many

### What to watch

- `submitGuideForVerification` already ran the empty-pool check before any INSERT/UPDATE inside its `withTransaction` block, so this was already fail-closed at the DB level — the fix here is purely about giving the pool a way to be non-empty, plus a clearer author-facing message
- Seeded credentials carry no test-taking history — treat them as a manual trust decision, same as any other admin action

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
