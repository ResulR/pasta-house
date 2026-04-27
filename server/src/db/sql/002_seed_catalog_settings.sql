BEGIN;

-- =========================
-- RESET DU BLOC 1
-- =========================

TRUNCATE TABLE
  product_variants,
  products,
  categories,
  beverages,
  site_settings,
  delivery_settings,
  opening_hours,
  exceptional_closures,
  schedule_overrides
RESTART IDENTITY CASCADE;

-- =========================
-- CATÉGORIES
-- =========================

INSERT INTO categories (name, slug, sort_order, is_active)
VALUES
  ('Pâtes', 'pates', 1, TRUE),
  ('Paninis', 'paninis', 2, TRUE);

-- =========================
-- PRODUITS PÂTES
-- =========================

INSERT INTO products (category_id, name, slug, description, sort_order, is_active, is_available)
VALUES
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Bolognaise', 'bolognaise', 'Sauce tomate riche à la viande hachée, mijotée lentement.', 1, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Bolognaise 4 Fromages', 'bolognaise-4-fromages', 'Bolognaise généreuse rehaussée d''un mélange fondant de quatre fromages.', 2, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Bolognaise Poulet', 'bolognaise-poulet', 'Sauce bolognaise accompagnée de morceaux de poulet tendres.', 3, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Saumon', 'saumon', 'Pâtes crémeuses au saumon frais et à l''aneth.', 4, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet Blanche', 'poulet-blanche', 'Poulet dans une sauce blanche onctueuse.', 5, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet Épinard', 'poulet-epinard', 'Poulet et épinards frais dans une sauce crémeuse.', 6, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet Champignon', 'poulet-champignon', 'Poulet et champignons sautés, sauce onctueuse.', 7, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet Andalouse', 'poulet-andalouse', 'Poulet relevé d''une touche de sauce andalouse maison.', 8, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet Curry', 'poulet-curry', 'Poulet épicé au curry doux et crémeux.', 9, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet Pili', 'poulet-pili', 'Poulet relevé au pili pili, pour les amateurs de piquant.', 10, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet Chef', 'poulet-chef', 'Recette signature du chef, poulet et sauce secrète.', 11, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet + Salami', 'poulet-salami', 'Duo généreux de poulet et salami dans une sauce relevée.', 12, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Salami Blanche', 'salami-blanche', 'Salami fondant dans une sauce blanche crémeuse.', 13, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Poulet Brocoli', 'poulet-brocoli', 'Poulet tendre et brocoli dans une sauce légère.', 14, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Quatre Fromages', 'quatre-fromages', 'Quatre fromages fondus dans une sauce généreuse et gourmande.', 15, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Carbonara', 'carbonara', 'La classique italienne, crémeuse et savoureuse.', 16, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Arabiata', 'arabiata', 'Sauce tomate épicée, pour les amateurs de caractère.', 17, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'pates'), 'Scampis', 'scampis', 'Scampis juteux dans une sauce à l''ail et au beurre.', 18, TRUE, TRUE);

-- =========================
-- VARIANTES PÂTES
-- =========================

INSERT INTO product_variants (product_id, code, name, price_cents, sort_order, is_active, is_default)
VALUES
  ((SELECT id FROM products WHERE slug = 'bolognaise'), 'ravier', 'Ravier', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'bolognaise'), 'assiette', 'Assiette', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'bolognaise-4-fromages'), 'ravier', 'Ravier', 700, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'bolognaise-4-fromages'), 'assiette', 'Assiette', 1100, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'bolognaise-poulet'), 'ravier', 'Ravier', 750, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'bolognaise-poulet'), 'assiette', 'Assiette', 1200, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'saumon'), 'ravier', 'Ravier', 700, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'saumon'), 'assiette', 'Assiette', 1100, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-blanche'), 'ravier', 'Ravier', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-blanche'), 'assiette', 'Assiette', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-epinard'), 'ravier', 'Ravier', 650, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-epinard'), 'assiette', 'Assiette', 1100, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-champignon'), 'ravier', 'Ravier', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-champignon'), 'assiette', 'Assiette', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-andalouse'), 'ravier', 'Ravier', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-andalouse'), 'assiette', 'Assiette', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-curry'), 'ravier', 'Ravier', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-curry'), 'assiette', 'Assiette', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-pili'), 'ravier', 'Ravier', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-pili'), 'assiette', 'Assiette', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-chef'), 'ravier', 'Ravier', 650, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-chef'), 'assiette', 'Assiette', 1100, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-salami'), 'ravier', 'Ravier', 750, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-salami'), 'assiette', 'Assiette', 1200, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'salami-blanche'), 'ravier', 'Ravier', 700, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'salami-blanche'), 'assiette', 'Assiette', 1100, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'poulet-brocoli'), 'ravier', 'Ravier', 650, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'poulet-brocoli'), 'assiette', 'Assiette', 1100, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'quatre-fromages'), 'ravier', 'Ravier', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'quatre-fromages'), 'assiette', 'Assiette', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'carbonara'), 'ravier', 'Ravier', 700, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'carbonara'), 'assiette', 'Assiette', 1100, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'arabiata'), 'ravier', 'Ravier', 700, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'arabiata'), 'assiette', 'Assiette', 1100, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'scampis'), 'ravier', 'Ravier', 900, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'scampis'), 'assiette', 'Assiette', 1250, 2, TRUE, FALSE);

-- =========================
-- PRODUITS PANINIS
-- =========================

INSERT INTO products (category_id, name, slug, description, sort_order, is_active, is_available)
VALUES
  ((SELECT id FROM categories WHERE slug = 'paninis'), 'Panini Poulet', 'panini-poulet', 'Panini garni de poulet grillé, fromage fondant et crudités.', 1, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'paninis'), 'Panini Kefta', 'panini-kefta', 'Panini au kefta épicé, oignons et sauce maison.', 2, TRUE, TRUE),
  ((SELECT id FROM categories WHERE slug = 'paninis'), 'Panini Quatre Fromages', 'panini-quatre-fromages', 'Panini fondant au mélange de quatre fromages.', 3, TRUE, TRUE);

-- =========================
-- VARIANTES PANINIS
-- =========================

INSERT INTO product_variants (product_id, code, name, price_cents, sort_order, is_active, is_default)
VALUES
  ((SELECT id FROM products WHERE slug = 'panini-poulet'), 'seul', 'Seul', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'panini-poulet'), 'menu', 'Menu', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'panini-kefta'), 'seul', 'Seul', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'panini-kefta'), 'menu', 'Menu', 1000, 2, TRUE, FALSE),

  ((SELECT id FROM products WHERE slug = 'panini-quatre-fromages'), 'seul', 'Seul', 600, 1, TRUE, TRUE),
  ((SELECT id FROM products WHERE slug = 'panini-quatre-fromages'), 'menu', 'Menu', 1000, 2, TRUE, FALSE);

-- =========================
-- BOISSONS
-- =========================

INSERT INTO beverages (name, slug, price_cents, sort_order, is_active, is_menu_eligible)
VALUES
  ('Coca', 'coca', NULL, 1, TRUE, TRUE),
  ('Fanta', 'fanta', NULL, 2, TRUE, TRUE),
  ('Ice Tea', 'ice-tea', NULL, 3, TRUE, TRUE);

-- =========================
-- SETTINGS SITE
-- =========================

INSERT INTO site_settings (
  singleton,
  restaurant_name,
  phone,
  email,
  address_line1,
  postal_code,
  city,
  country,
  legal_name,
  vat_number
)
VALUES (
  TRUE,
  'Pasta House',
  '[À définir]',
  '[À définir]',
  '[Adresse à définir]',
  NULL,
  'Bruxelles',
  'Belgique',
  '[Raison sociale à définir]',
  '[Numéro TVA à définir]'
);

-- =========================
-- SETTINGS LIVRAISON
-- =========================

INSERT INTO delivery_settings (
  singleton,
  delivery_enabled,
  pickup_enabled,
  delivery_fee_cents,
  minimum_order_cents,
  delivery_zone_label
)
VALUES (
  TRUE,
  TRUE,
  TRUE,
  500,
  1500,
  'Bruxelles'
);

-- =========================
-- HORAIRES
-- =========================

INSERT INTO opening_hours (day_key, is_open, open_time, close_time)
VALUES
  ('monday', TRUE, '20:00', '01:00'),
  ('tuesday', TRUE, '20:00', '01:00'),
  ('wednesday', TRUE, '20:00', '01:00'),
  ('thursday', TRUE, '20:00', '01:00'),
  ('friday', TRUE, '20:00', '01:00'),
  ('saturday', TRUE, '20:00', '01:00'),
  ('sunday', TRUE, '20:00', '01:00');

COMMIT;