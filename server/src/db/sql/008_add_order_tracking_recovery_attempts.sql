BEGIN;

CREATE TABLE order_tracking_recovery_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  ip_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_tracking_recovery_attempts_email_created_at
ON order_tracking_recovery_attempts (email, created_at DESC);

CREATE INDEX idx_order_tracking_recovery_attempts_ip_created_at
ON order_tracking_recovery_attempts (ip_address, created_at DESC);

COMMIT;