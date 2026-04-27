BEGIN;

ALTER TABLE orders
ADD COLUMN public_tracking_token text;

ALTER TABLE orders
ALTER COLUMN public_tracking_token
SET DEFAULT (
  md5(random()::text || clock_timestamp()::text || coalesce(current_setting('application_name', true), ''))
  ||
  md5(random()::text || clock_timestamp()::text)
);

UPDATE orders
SET public_tracking_token = DEFAULT
WHERE public_tracking_token IS NULL;

ALTER TABLE orders
ALTER COLUMN public_tracking_token
SET NOT NULL;

CREATE UNIQUE INDEX idx_orders_public_tracking_token
ON orders (public_tracking_token);

COMMIT;