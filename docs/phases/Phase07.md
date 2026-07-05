# Phase 07 — Tiered Verifier Testing

**Status:** Complete (reviewed). Run `db/migration-verifier-tests.sql` (adds nullable `purpose` + `metadata` columns to `generated_tests`; existing survey rows untouched).

## Design: reuse the existing AI test engine

Verifier qualification rides the existing `generated_tests` + `app/api/generate-test` flow rather than a parallel testing system. Tests are tagged `purpose = 'verifier_qualification'` with `metadata = {subject, level}` and carry zero shard reward — the credential is the reward.

## Grading (`lib/verifier-tests-db.ts`)

Reuses the exact completion rules from `app/api/generate-test/complete`: all questions answered, short answers ≥ 100 chars. Score = credited/total × 100; pass ≥ 80%. Because 5 of 8 questions are short-answer, skipping written work caps at ~37% — no pass without substantive answers. Grading runs in one transaction with a `FOR UPDATE` lock (no double-grade), and a pass upserts `verifier_credentials` with `max_level = GREATEST(current, tested)` — re-passing is idempotent, passing never demotes.

This is the gate for Phase 3: only credential holders enter panel draws, per subject and level tier (the tiered-verifier-testing business rule).

## API & UI

`app/api/guides/verifier-test/` (request test, get own credentials) and `verifier-test/complete/` (submit + grade). `components/guides/VerifierCredentials.tsx` — credential badges + "Become a verifier" form (subject dropdown derived from published guides' subjects, free-text fallback). Not yet wired into a page — natural home is the profile page or a /courses side panel; James's recent profile-page rework makes that placement his call.

## On-chain certificates (deferred)

`docs/phases/Phase07-certificates-note.md` documents minting credentials via the existing `SurveyCertificates.sol` — explicitly deferred, no contract changes made.

## Review notes

Migration is purely additive (nullable columns + partial index). `lib/ensureGeneratedTestsSchema.ts` extended so local environments self-provision the columns — additive, verified against existing flow.
