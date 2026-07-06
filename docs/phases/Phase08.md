# Phase 08 — Gamification Wave (diamonds, skill-tree, Blue, prestige)

**Status:** Complete (reviewed, migration applied to production Supabase). Streak task (#2 from the proposal) intentionally skipped per James.

## 1. Diamond payouts on completion

- `db/migration-guide-rewards.sql` → `guide_diamond_claims` ledger, mirrors `vip_diamond_claims`: one immutable row per reward, `ON CONFLICT DO NOTHING` idempotency. **Applied to production.**
- `lib/guide-rewards-db.ts` — tiers: guide complete = 50 (matches VIP `COMPLETION_REWARD`), level clear = 150 (3×), walkthrough complete = 500 + 10 spin-equivalent (loot-box has no persistent spin ledger — spins are shard-funded at cost 10 — so the free spin is credited as diamonds; documented in code). All credit `users.shard_count`, same balance as VIP.
- `app/api/guides/progress/route.ts` — POST response gains additive fields `{diamonds, levelCleared, walkthroughComplete, spinGranted}`.
- Payout toast in the guideCard language, implemented inline in `components/guides/GuideWalkthrough.tsx` (reward state + toast markup in the completion flow). A standalone `RewardToast.tsx` component was built but never wired up and has been removed.

## 2. Skill-tree constellation view

- `components/guides/GuideSkillTree.tsx` — the walkthrough DAG as an SVG constellation: level bands bottom-up, curved edges to direct prereqs, node states (completed = glowing pulse, available = tinted + hover glow, locked = dashed + padlock), target ring animation, "you are here" marker, keyboard accessible, `prefers-reduced-motion` respected. Vertical "Level N of M" progress rail with per-level ticks.
- Stylesheet completed by reviewer after the build agent's connection dropped mid-run (`GuideSkillTree.module.css`, all 23 classes, dark variants).
- `GuideWalkthrough.tsx` — Tree ⇄ List pill toggle (`toggle-on`/`toggle-off` sounds); tree default ≥ 900px. Mark-complete lives in list view; the tree is the map. List stays mounted (hidden) so state persists across toggles.
- Walkthrough API/lib extended additively with `prereqIds` per node + `targetId` to feed the tree.

## 3. Blue guide companion

- `components/guides/BlueGuideCompanion.tsx` — wraps the existing BlueChatBubble (compact, context "Guide"). One message per page view, priority: verification status (jury reviewing / back with author) → signed-out invite → first-missing-prereq nudge (names the guide, suggests climbing from the bottom) → 4 rotating ready-to-climb lines (deterministic by guide-id hash, no per-render randomness). Static lines in Blue's Brand-Editorial voice — no AI calls. `pop` sound once on entrance, reduced-motion safe.
- Wired into the guide page directly below the header.

## 4. Verifier prestige track

- `lib/verifier-prestige-db.ts` — upheld-rate: vote matched the panel's final decision AND the guide wasn't later dispute-overturned. Leaderboard rank = panels served × upheld rate.
- APIs: `app/api/guides/verifier-test/stats/` (own stats), `app/api/leaderboard/verifiers/` (public top verifiers, same conventions as the main leaderboard).
- `components/guides/VerifierBadges.tsx` — per-subject credential chips with Roman-numeral level rings, panels-served count, upheld-rate meter. Tiers: Reader (≤1) → Verifier (2) → Arbiter (≥3).
- Profile page: one added `shell` section — VerifierBadges + the previously-unwired VerifierCredentials ("Become a verifier" finally has a home).
- `Phase07-certificates-note.md` — appended the top-tier SurveyCertificates mint as the future capstone.

## Review notes

tsc clean. Three agent interruptions across this wave (session limits + one dropped connection); all partial work was audited, the missing stylesheet and integrations finished by the reviewer. The `guide_diamond_claims` migration is live in production; all other Phase 8 pieces are code-only and ship with the next deploy.
