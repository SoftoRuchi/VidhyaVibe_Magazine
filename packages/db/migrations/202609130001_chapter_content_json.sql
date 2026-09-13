-- Chapter structured JSON (master content). HTML remains presentation snapshot.
-- Workbench needs a selected schema. If your DB name differs, change this line
-- or double-click the schema in SCHEMAS before running.
USE `Magazine`;

SET @col_json := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_chapters'
    AND COLUMN_NAME = 'content_json'
);
SET @sql_json := IF(
  @col_json = 0,
  'ALTER TABLE course_chapters ADD COLUMN content_json JSON NULL',
  'SELECT 1'
);
PREPARE stmt_json FROM @sql_json;
EXECUTE stmt_json;
DEALLOCATE PREPARE stmt_json;

SET @col_fmt := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_chapters'
    AND COLUMN_NAME = 'content_format'
);
SET @sql_fmt := IF(
  @col_fmt = 0,
  'ALTER TABLE course_chapters ADD COLUMN content_format VARCHAR(16) NOT NULL DEFAULT ''html''',
  'SELECT 1'
);
PREPARE stmt_fmt FROM @sql_fmt;
EXECUTE stmt_fmt;
DEALLOCATE PREPARE stmt_fmt;
