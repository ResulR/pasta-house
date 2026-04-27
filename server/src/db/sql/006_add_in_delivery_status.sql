BEGIN;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending',
      'awaiting_payment',
      'paid',
      'preparing',
      'ready',
      'in_delivery',
      'completed',
      'cancelled',
      'payment_failed'
    )
  );

ALTER TABLE order_status_history
  DROP CONSTRAINT IF EXISTS order_status_history_status_check;

ALTER TABLE order_status_history
  ADD CONSTRAINT order_status_history_status_check CHECK (
    status IN (
      'pending',
      'awaiting_payment',
      'paid',
      'preparing',
      'ready',
      'in_delivery',
      'completed',
      'cancelled',
      'payment_failed'
    )
  );

COMMIT;