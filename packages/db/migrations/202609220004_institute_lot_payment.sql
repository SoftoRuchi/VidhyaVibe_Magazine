-- Track whether a college license invoice was emailed / paid (UPI QR, pay link, Razorpay).

SET @ps := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_license_lots' AND COLUMN_NAME = 'payment_status'
);
SET @sql := IF(
  @ps = 0,
  'ALTER TABLE book_license_lots ADD COLUMN payment_status VARCHAR(16) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sent := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_license_lots' AND COLUMN_NAME = 'payment_sent_at'
);
SET @sql := IF(
  @sent = 0,
  'ALTER TABLE book_license_lots ADD COLUMN payment_sent_at DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @rp := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_license_lots' AND COLUMN_NAME = 'rp_order_id'
);
SET @sql := IF(
  @rp = 0,
  'ALTER TABLE book_license_lots ADD COLUMN rp_order_id VARCHAR(64) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
