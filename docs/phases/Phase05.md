# Phase 05 — Disputes & Spin-offs

**Status:** Complete (reviewed). Run `db/migration-guide-disputes.sql` after the Phase 3 migration.

## Schema (`db/migration-guide-disputes.sql`)

`guide_disputes` (type: `factual` / `cross_niche` / `verification_appeal` / `rereview_appeal`; evidence ≥ 80 chars DB-enforced), `dispute_panel_members`, `dispute_panel_votes` (verdict `uphold` / `overturn` / `fork` / `dismiss`, justification ≥ 40 chars).

## Rules implemented (`lib/guide-disputes-db.ts`)

- **Standing gate:** opener needs ≥ 3 completed guides OR any verifier credential, AND < 3 dismissed disputes in 90 days (spam guard). Authors can't dispute their own guide.
- **Conflict-of-interest panel draw:** odd panel (3) from credential holders excluding the guide's author and everyone who voted on its verifier panel. Even → drop one.
- **Verdicts:** majority resolves. `overturn` unpublishes the guide; `uphold`/`dismiss` close with a resolution note; `fork` executes the spin-off.

## Spin-off mechanics (the cross-niche resolution)

Fork verdict duplicates: the guide row (slug `<slug>-fork`, unique title), a shared `canonical_group_id` stamped on both (generated if missing), all prereq AND dependent edges in both directions, and subject tags — with the resolution able to pin a distinct niche subject on each fork. Methods and votes are deliberately NOT copied — each fork starts with a clean vote slate. Both end `published`. This is the governed exception to "one canonical guide per topic."

## API & UI

`app/api/guides/disputes/` (open + list), `app/api/guides/disputes/vote/`. `components/guides/DisputeSection.tsx` — public dispute list + open-dispute form — wired into the guide page after the verification log (reviewer).

## Review notes

Exclusion query verified (author ∪ prior panel voters removed from pool). Fork edge-copy uses `ON CONFLICT DO NOTHING` so re-runs can't duplicate edges; the copied edges pass through the Phase 1 cycle-guard trigger like any insert.
