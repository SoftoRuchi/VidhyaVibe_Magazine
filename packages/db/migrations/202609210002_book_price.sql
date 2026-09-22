-- Individual list price on a subject (INR). NULL = not sold to individuals.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_subjects' AND COLUMN_NAME = 'price'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE course_subjects ADD COLUMN price DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Licensed textbooks get a default individual list price so students can buy a seat.
UPDATE course_subjects s
SET s.price = 499.00
WHERE s.price IS NULL
  AND s.status = 'PUBLISHED'
  AND EXISTS (
    SELECT 1 FROM book_license_lots l
    WHERE l.subject_id = s.id AND l.status = 'ACTIVE'
  );
