-- Per-seat college list prices on a subject (INR). NULL = no catalog rate for that model.

SET @bb := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_subjects' AND COLUMN_NAME = 'book_bank_price'
);
SET @sql := IF(
  @bb = 0,
  'ALTER TABLE course_subjects ADD COLUMN book_bank_price DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @lb := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_subjects' AND COLUMN_NAME = 'library_price'
);
SET @sql := IF(
  @lb = 0,
  'ALTER TABLE course_subjects ADD COLUMN library_price DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
