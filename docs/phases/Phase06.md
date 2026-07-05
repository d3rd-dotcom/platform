# Phase 06 — Contextual Materials Marketplace

**Status:** Complete (reviewed). Run `db/migration-guide-materials.sql` (optional seed for "Journaling Practice" — notebook, pen, jar — is a commented block inside it).

## Contextual-matching rule, enforced structurally

`guide_materials.rationale` is NOT NULL with a ≥ 40-char DB CHECK: every material must state how the guide actually uses it. This is the "advertisers can only display products on guides that directly utilize them" business rule, implemented as a schema constraint rather than a policy document. Materials are author-added only (route compares `author_id`), keeping the surface curated.

## Schema & data access

`guide_materials` — name, image, link (internal `/shop` or external), `link_type`, rationale, optional price label, sort order. `lib/guide-materials-db.ts` — get/add/remove, clean 400 surfaced when the rationale CHECK trips.

## API

`app/api/guides/[slug]/materials` — GET public; POST/DELETE author-only (401/403/404 paths verified).

## UI

`components/guides/GuideMaterials.tsx` — "Materials for this guide" card grid: image, name, rationale line, price label. Internal links via next/link to `/shop`; external links `target=_blank rel="noopener nofollow"`. Renders nothing when empty. Wired into the guide page after Methods (reviewer) with a client-side fetch.

## Monetization divergence from BlueLearn (intentional)

BlueLearn mandates everything free; we keep the existing Diamonds/Stripe shop economy. Internal materials route into `app/shop/` where the purchase flow already exists. Shadow-work is untouched — its adjacent guides can list journaling materials without the course itself changing.

## Review notes

Rationale constraint verified in SQL. `/dist/ssr` phosphor imports work in the client page context. Empty-state renders null so guides without materials show no dead section.
