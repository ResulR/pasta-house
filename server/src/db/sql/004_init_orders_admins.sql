BEGIN;

CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'awaiting_payment',
      'paid',
      'preparing',
      'ready',
      'completed',
      'cancelled',
      'payment_failed'
    )
  ),
  fulfillment_method TEXT NOT NULL CHECK (
    fulfillment_method IN ('delivery', 'pickup')
  ),

  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,

  delivery_address_line1 TEXT,
  delivery_postal_code TEXT,
  delivery_city TEXT,

  customer_note TEXT,

  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',

  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),

  item_type TEXT NOT NULL CHECK (
    item_type IN ('product', 'beverage')
  ),

  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  beverage_id BIGINT REFERENCES beverages(id) ON DELETE SET NULL,

  product_name_snapshot TEXT,
  variant_code_snapshot TEXT,
  variant_name_snapshot TEXT,
  beverage_name_snapshot TEXT,

  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT order_items_order_id_line_number_unique UNIQUE (order_id, line_number)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN (
      'pending',
      'awaiting_payment',
      'paid',
      'preparing',
      'ready',
      'completed',
      'cancelled',
      'payment_failed'
    )
  ),
  note TEXT,
  changed_by_admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT webhook_events_provider_event_id_unique UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON orders(customer_email);

CREATE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session_id
  ON orders(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id
  ON orders(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_variant_id
  ON order_items(product_variant_id);

CREATE INDEX IF NOT EXISTS idx_order_items_beverage_id
  ON order_items(beverage_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
  ON order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by_admin_id
  ON order_status_history(changed_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_created_at
  ON webhook_events(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON webhook_events(processed_at);

COMMIT;