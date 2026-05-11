BEGIN;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS orders_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS orders_disabled_reason TEXT NOT NULL DEFAULT '';

UPDATE site_settings
SET
  orders_enabled = COALESCE(orders_enabled, TRUE),
  orders_disabled_reason = COALESCE(orders_disabled_reason, ''),
  updated_at = NOW()
WHERE singleton = TRUE;

COMMIT;
