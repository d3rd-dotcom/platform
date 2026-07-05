# Phase 00 — Messaging & Positioning

**Status:** Complete (reviewed)
**Scope:** README, landing page, homepage copy. No structural, layout, or logic changes.

## The three-sentence positioning (now canonical)

1. Mental Wealth Academy is a gamified educational gameworld built on behavioral psychology, with blockchain-backed ownership of what you earn, accompanied by Blue.
2. Knowledge is structured in ascending levels, so you level up instead of grinding through tutorial hell — each level cleared kills learning fatigue and pays out like a quest.
3. There is one definitive, verified guide per topic: a one-stop shop for knowledge, level-gated, with no duplicate tutorials to sort through.

## Changes

- `README.md` — tagline replaced; "What This Is" rewritten around sentences 1–2; new **Knowledge Ecosystem** section covering sentence 3 (definitive guides, level DAG, verifier jury with CRE AI juror and on-chain audit log). Badges, screenshot, contract tables, and technical sections preserved.
- `components/landing/HeroSection.tsx` — hero subtext now anchored on the gameworld + leveling positioning.
- `components/landing/FAQSection.tsx` — "What is Mental Wealth Academy?" answer rewritten to hit all three sentences.
- `HomeBento.tsx` / `app/page.tsx` — inspected, no copy strings present; untouched by design.

## Review notes

Voice check against `Brand Editorial.md` passed: upbeat/academic/short, no corporate-wellness or recruiter phrasing. Sections already on-brand (Features, Ecosystem, Blue's FAQ) intentionally left alone — minimal-diff principle.

## Companion work: typography system

A dedicated agent built the site typography system in the same wave (full rules in `docs/design-system/typography.md`):

- `styles/typography.css` — fluid clamp() scale (display → caption), Space Grotesk headings/labels, Inter body, 1.6 body / 1.2 heading line-heights, −0.02em display tracking, +0.05em uppercase labels. Imported at top of `styles/globals.css`.
- Applied across all 11 `components/course-studio/*.module.css` (ComponentPalette first), all 14 `components/course-renderers/*.module.css`, and typography-only passes on `CourseFolderCard`, `ProfileDashboard`, `FieldNotesSheet` (layout untouched, per constraint).
- WCAG AA verified for every text/surface combo against `#090A10`, `#11131B`, `#171A24`, and white — no color changes were needed.

## Deferred (needs your call)

The Phase 0 feature-cut (keep/merge/kill per route in `app/`) is a product decision, not a copy edit — flagged for James rather than executed.
