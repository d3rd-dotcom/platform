# Phase 03 — Verifier Jury (panels + CRE AI juror)

**Status:** Complete (reviewed). Run `db/migration-guide-verification.sql` after the Phase 1 migration.

## Schema (`db/migration-guide-verification.sql`)

- `verifier_credentials` — (user, subject, max_level, earned_via); who may sit on panels, per subject and level tier.
- `verifier_panels` + `verifier_panel_members` — one panel per submission, members drawn randomly.
- `verifier_panel_votes` — decision (`approve`/`reject`) must cite exactly one rubric item (`hierarchy_soundness`, `obvious_errors`, `duplication`, `scope`) and carry a written justification (DB CHECK ≥ 40 chars — the mandatory-feedback business rule enforced at the schema level).

## Flow (`lib/guide-verification-db.ts`, 550 lines)

1. Author submits draft → `submitGuideForVerification` sets status `pending_verification`, draws an odd panel (target 3) at random from credential holders matching the guide's subjects. Even draw → drop one (odd-number mandate, `toOdd()`).
2. Panel members vote via `castPanelVote` — one vote each, rubric + justification required.
3. Majority resolves the panel: guide → `published` or back to `draft`.
4. `getVerificationLog` exposes the full public audit log (votes, rubric citations, justifications, timestamps).

## API & UI

`app/api/guides/verification/{submit,vote,[guideId],cre-score}/route.ts`. `components/guides/VerificationLog.tsx` renders the public audit log — wired into the guide page below "Builds toward."

## CRE AI juror (`cre-workflows/guide-review/`)

New DON workflow modeled on `blue-review` (which is untouched). Cron-triggered (10 min) rather than EVM-log-triggered because guides live off-chain — polls `GET /api/guides?status=pending_verification`, scores each guide via the Eliza API under `consensusIdenticalAggregation` DON consensus, and POSTs `{guideId, score 0-100, summary, sources, donSignature}` to the `cre-score` callback (secret-header auth). The score is **advisory input to the panel, never a vote**. Future on-chain path (new BlueKillStreak action type via `onReport()`) documented in the workflow header; contracts untouched. Registered in `cre-workflows/tsconfig.json` (reviewer fix).

## Review notes

Panel-draw randomness, odd-mandate, and majority logic verified. Justification length is DB-enforced, not just UI-enforced — a verifier cannot silently vote. Wave-2 agents were cut off by a session limit mid-run; on resume all Phase 3 files were verified present and compiling, with only the CRE workflow missing — backfilled this wave.
