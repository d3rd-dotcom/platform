-- ============================================================================
-- Guide Materials Migration (BlueLearn integration — Phase 6)
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Depends on db/migration-guides.sql (needs the `guides` table + the shared
-- update_updated_at_column() trigger function).
--
-- The contextual materials marketplace: each guide can list the physical or
-- shop products it actually uses (a journaling guide lists a notebook, a pen,
-- a jar for slips of paper). Every material MUST justify itself — the
-- `rationale` field is required and length-checked so materials attach only to
-- guides that genuinely use them. This is the "contextual matching" rule from
-- the plan; verifiers include materials in their review scope.
--
-- RLS style matches db/migration-guides.sql: the app connects as the `postgres`
-- role (BYPASSRLS) via lib/db.ts, so RLS is enabled with no policies to lock
-- out the anon/authenticated Data API roles.
--
-- Does NOT modify any existing table. Does NOT touch shadow-work.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── guide_materials ─────────────────────────────────────────────────────────
-- link_type = 'internal_shop' → link_url points at an app/shop/ item (rendered
--   with next/link, no target/rel). 'external' → an outside store (opens in a
--   new tab with rel="noopener nofollow").
-- rationale is REQUIRED and must be a real sentence (>= 40 chars): it explains
--   how THIS guide uses the material, enforcing contextual matching.
-- price_label is a free-text display string (e.g. "16 USDC", "~$8", "Free") and
--   is intentionally nullable — external items may not have a normalized price.
CREATE TABLE IF NOT EXISTS guide_materials (
  id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guide_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  image_url TEXT NULL,
  link_url TEXT NOT NULL,
  link_type VARCHAR(16) NOT NULL DEFAULT 'external',
  rationale TEXT NOT NULL,
  price_label VARCHAR(64) NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  CONSTRAINT guide_materials_link_type_check CHECK (
    link_type IN ('internal_shop', 'external')
  ),
  -- Contextual-matching rule: every material must justify how the guide uses it.
  CONSTRAINT guide_materials_rationale_len_check CHECK (
    char_length(rationale) >= 40
  )
);

-- ── Index on the foreign key (repo convention) ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guide_materials_guide
  ON guide_materials(guide_id, sort_order);

-- ── updated_at trigger (reuse existing update_updated_at_column) ─────────────
DROP TRIGGER IF EXISTS update_guide_materials_updated_at ON guide_materials;
CREATE TRIGGER update_guide_materials_updated_at
  BEFORE UPDATE ON guide_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Enable RLS (locked down, no policies — matches repo convention) ──────────
ALTER TABLE guide_materials ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================


-- ============================================================================
-- OPTIONAL SEED — materials for the seeded "Journaling Practice" guide
-- ----------------------------------------------------------------------------
-- Safe to skip. Requires db/seed-guides.sql to have run first (it creates the
-- guide with slug 'journaling-practice'). Rationales are honest: each states how
-- the journaling guide actually uses the item. Re-runnable — clears this guide's
-- materials first so repeated runs don't duplicate rows.
--
-- One item links into app/shop/ (the Thesis Notebook, id 'notebook' →
-- /shop#notebook) to exercise the internal_shop path; the pen and jar are
-- external. No reference to app/shadow-work/.
-- ============================================================================
-- DELETE FROM guide_materials
--  WHERE guide_id = (SELECT id FROM guides WHERE slug = 'journaling-practice');
--
-- INSERT INTO guide_materials
--   (guide_id, name, image_url, link_url, link_type, rationale, price_label, sort_order)
-- SELECT g.id, m.name, m.image_url, m.link_url, m.link_type, m.rationale, m.price_label, m.sort_order
-- FROM guides g
-- JOIN (VALUES
--   (
--     'A5 ruled notebook',
--     '/images/shop/thesis-notebook.webp',
--     '/shop#notebook',
--     'internal_shop',
--     'The three-line entry format in this guide assumes a small, always-with-you notebook so daily journaling stays a two-minute habit rather than a chore.',
--     '16 USDC',
--     0
--   ),
--   (
--     'Everyday rollerball pen',
--     NULL,
--     'https://www.jetpens.com/',
--     'external',
--     'Handwriting slows you down just enough to notice what you actually felt; a pen that never skips removes the friction that makes people quit journaling early.',
--     '~$8',
--     1
--   ),
--   (
--     'Small lidded jar',
--     NULL,
--     'https://www.amazon.com/s?k=small+glass+jar+with+lid',
--     'external',
--     'The guide suggests tearing off single meaning-lines and dropping them in a jar, so you can revisit past reframes later without rereading whole entries.',
--     '~$6',
--     2
--   )
-- ) AS m(name, image_url, link_url, link_type, rationale, price_label, sort_order)
--   ON g.slug = 'journaling-practice';
-- ============================================================================
