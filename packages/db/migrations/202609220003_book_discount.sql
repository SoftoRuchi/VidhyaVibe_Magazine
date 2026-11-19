-- Optional catalog discount % on a subject (applies to individual, book-bank, and library list prices).
-- Optional amount + extra discount % stored on each college license lot.

SET @d := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_subjects' AND COLUMN_NAME = 'discount_pct'
);
SET @sql := IF(
  @d = 0,
  'ALTER TABLE course_subjects ADD COLUMN discount_pct DECIMAL(5,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @a := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_license_lots' AND COLUMN_NAME = 'amount'
);
SET @sql := IF(
  @a = 0,
  'ALTER TABLE book_license_lots ADD COLUMN amount DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ld := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_license_lots' AND COLUMN_NAME = 'discount_pct'
);
SET @sql := IF(
  @ld = 0,
  'ALTER TABLE book_license_lots ADD COLUMN discount_pct DECIMAL(5,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
