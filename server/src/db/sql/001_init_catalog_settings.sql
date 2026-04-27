BEGIN;

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_variants_price_cents_check CHECK (price_cents >= 0),
  CONSTRAINT product_variants_unique_code_per_product UNIQUE (product_id, code)
);

CREATE TABLE IF NOT EXISTS beverages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_cents INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_menu_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT beverages_price_cents_check CHECK (price_cents IS NULL OR price_cents >= 0)
);

CREATE TABLE IF NOT EXISTS site_settings (
  id BIGSERIAL PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  restaurant_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Belgique',
  legal_name TEXT,
  vat_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_settings_singleton_check CHECK (singleton = TRUE)
);

CREATE TABLE IF NOT EXISTS delivery_settings (
  id BIGSERIAL PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
  minimum_order_cents INTEGER NOT NULL DEFAULT 0,
  delivery_zone_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_settings_singleton_check CHECK (singleton = TRUE),
  CONSTRAINT delivery_settings_fee_check CHECK (delivery_fee_cents >= 0),
  CONSTRAINT delivery_settings_minimum_check CHECK (minimum_order_cents >= 0)
);

CREATE TABLE IF NOT EXISTS opening_hours (
  id BIGSERIAL PRIMARY KEY,
  day_key TEXT NOT NULL UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT opening_hours_day_key_check CHECK (
    day_key IN (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    )
  )
);

CREATE TABLE IF NOT EXISTS exceptional_closures (
  id BIGSERIAL PRIMARY KEY,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exceptional_closures_range_check CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS schedule_overrides (
  id BIGSERIAL PRIMARY KEY,
  service_date DATE NOT NULL UNIQUE,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  open_time TIME,
  close_time TIME,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedule_overrides_time_pair_check CHECK (
    (is_closed = TRUE AND open_time IS NULL AND close_time IS NULL)
    OR
    (is_closed = FALSE AND open_time IS NOT NULL AND close_time IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_is_active
  ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_products_is_available
  ON products(is_available);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON product_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_beverages_is_active
  ON beverages(is_active);

CREATE INDEX IF NOT EXISTS idx_exceptional_closures_starts_at
  ON exceptional_closures(starts_at);

CREATE INDEX IF NOT EXISTS idx_exceptional_closures_ends_at
  ON exceptional_closures(ends_at);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_service_date
  ON schedule_overrides(service_date);

COMMIT;