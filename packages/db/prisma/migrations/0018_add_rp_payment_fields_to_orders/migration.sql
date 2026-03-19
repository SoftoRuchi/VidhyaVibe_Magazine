-- Store Razorpay payment id + signature on subscription orders table
ALTER TABLE orders
  ADD COLUMN rp_payment_id VARCHAR(64) NULL,
  ADD COLUMN rp_signature VARCHAR(255) NULL;

CREATE INDEX idx_orders_rp_payment_id ON orders(rp_payment_id);

