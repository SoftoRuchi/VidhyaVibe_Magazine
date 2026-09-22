-- Individual book checkout (Razorpay / UPI proof).

CREATE TABLE IF NOT EXISTS book_orders (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  provider VARCHAR(16) NULL,
  rp_order_id VARCHAR(64) NULL,
  rp_payment_id VARCHAR(64) NULL,
  lot_id BIGINT NULL,
  purchase_code VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  paid_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY book_orders_user_subject (user_id, subject_id, status),
  KEY book_orders_rp (rp_order_id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS book_order_proofs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  file_key VARCHAR(1024) NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  verified_by BIGINT NULL,
  verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY book_order_proofs_order (order_id),
  KEY book_order_proofs_pending (verified)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
