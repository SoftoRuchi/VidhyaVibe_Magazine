-- Add Razorpay order id to subscription orders table
ALTER TABLE orders
  ADD COLUMN rp_order_id VARCHAR(64) NULL;

CREATE INDEX idx_orders_rp_order_id ON orders(rp_order_id);

