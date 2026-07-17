-- Keep guide-material cards compact and consistently priced in USDC.
-- Existing rows remain readable while new writes are constrained below.

ALTER TABLE guide_materials
  DROP CONSTRAINT IF EXISTS guide_materials_rationale_len_check;

ALTER TABLE guide_materials
  ADD CONSTRAINT guide_materials_rationale_length_check
  CHECK (char_length(rationale) BETWEEN 1 AND 30) NOT VALID,
  ADD CONSTRAINT guide_materials_price_label_usdc_check
  CHECK (price_label ~ '^\d+(\.\d{1,2})? USDC$') NOT VALID;

-- The seeded Journaling Practice materials use concise names, descriptions,
-- USDC badges, and local artwork. Replacing the set makes this idempotent.
DELETE FROM guide_materials
WHERE guide_id = (SELECT id FROM guides WHERE slug = 'journaling-practice');

INSERT INTO guide_materials
  (guide_id, name, image_url, link_url, link_type, rationale, price_label, sort_order)
SELECT g.id, m.name, m.image_url, m.link_url, m.link_type, m.rationale, m.price_label, m.sort_order
FROM guides g
JOIN (VALUES
  (
    'Notebook',
    '/images/shop/ethereal-notebook-preview.webp',
    '/shop#notebook',
    'internal_shop',
    'Daily entries have a home.',
    '16 USDC',
    0
  ),
  (
    'Pen',
    '/images/materials/pen.png',
    'https://www.jetpens.com/',
    'external',
    'Premium writing pen',
    '8 USDC',
    1
  ),
  (
    'Jar',
    '/images/materials/jar.png',
    'https://www.amazon.com/s?k=small+glass+jar+with+lid',
    'external',
    'Mason jar, 16oz',
    '6 USDC',
    2
  )
) AS m(name, image_url, link_url, link_type, rationale, price_label, sort_order)
  ON g.slug = 'journaling-practice';

-- Every remaining row now complies, so validate. The 30-char cap is a real rule
-- for how a card description is written, not a display truncation: a card that
-- needs two sentences is a card that has not been edited down yet.
ALTER TABLE guide_materials
  VALIDATE CONSTRAINT guide_materials_rationale_length_check;

ALTER TABLE guide_materials
  VALIDATE CONSTRAINT guide_materials_price_label_usdc_check;
