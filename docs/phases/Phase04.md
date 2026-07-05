# Phase 04 — User Voting & Auto-Revision

**Status:** Complete (reviewed). No new migration — `guide_votes` shipped in Phase 1.

## Voting (`lib/guide-votes-db.ts`)

- `castVote` — upsert, one vote per (user, guide). Upvote is one click; downvote requires one of the 8 rubric reasons plus an optional section pointer (DB-enforced from Phase 1).
- `getVoteTotals` — public: up/down counts only, no rubric breakdown (matches BlueLearn's public-display rule).
- `getModeratorBreakdown` — full rubric + per-section counts, for moderator tooling.

## Auto-revision trigger (`runRevisionCheck`)

Runs over votes in a 30-day window, only for published guides with ≥ 20 total window votes (floor env-configurable via `GUIDE_REVISION_VOTE_FLOOR` — brigade protection: low-volume guides can't trigger). A guide is auto-unpublished when ANY path crosses:

- **Ratio:** downvote share > 60% — catches slow quality drift.
- **Weighted rubric:** `factually_wrong` / `missing_step` / `prereq_gap` weighted 3×, others 1× — catches sharp factual problems faster.
- **Section density:** any single section accumulates > 8 downvote flags — one bad step in an otherwise sound guide.

Wired to `POST /api/guides/revision-check` (CRON_SECRET-protected) with a vercel.json cron at 02:00 daily.

## UI

`components/guides/GuideVoteBar.tsx` — upvote button, downvote opens rubric picker (8 human-labeled reasons + optional section dropdown fed from the guide's body section titles). Public totals only. Wired into the guide page header (reviewer), with section titles derived from the body component array.

## Review notes

Thresholds match the plan exactly. Cron entry verified in vercel.json alongside the five existing crons. Rubric list in UI cross-checked against the DB CHECK constraint — identical 8 values.
