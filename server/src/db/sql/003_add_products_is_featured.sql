BEGIN;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE products
SET is_featured = TRUE
WHERE slug IN (
  'bolognaise',
  'saumon',
  'poulet-chef',
  'carbonara',
  'scampis',
  'panini-poulet'
);

COMMIT;