-- University courses catalogue (separate from magazines)
-- Safe to re-run: IF NOT EXISTS for tables; column add is guarded.

-- Add hidden_from_catalog if missing (safe to re-run).
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'learn_activities'
    AND COLUMN_NAME = 'hidden_from_catalog'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE learn_activities ADD COLUMN hidden_from_catalog TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  university VARCHAR(160) NULL,
  description TEXT NULL,
  cover_key VARCHAR(1024) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY courses_slug_key (slug),
  KEY courses_status_idx (status),
  KEY courses_sort_idx (sort_order)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_semesters (
  id BIGINT NOT NULL AUTO_INCREMENT,
  course_id BIGINT NOT NULL,
  number INT NOT NULL,
  title VARCHAR(160) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY course_semesters_course_number (course_id, number),
  KEY course_semesters_course_idx (course_id),
  CONSTRAINT course_semesters_course_fk FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_subjects (
  id BIGINT NOT NULL AUTO_INCREMENT,
  semester_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description TEXT NULL,
  syllabus_code VARCHAR(80) NULL,
  cover_key VARCHAR(1024) NULL,
  file_key VARCHAR(1024) NULL,
  sample_key VARCHAR(1024) NULL,
  pages INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  published_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY course_subjects_semester_slug (semester_id, slug),
  KEY course_subjects_semester_idx (semester_id),
  KEY course_subjects_status_idx (status),
  CONSTRAINT course_subjects_semester_fk FOREIGN KEY (semester_id) REFERENCES course_semesters(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_chapters (
  id BIGINT NOT NULL AUTO_INCREMENT,
  subject_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  start_page INT NULL,
  end_page INT NULL,
  content MEDIUMTEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY course_chapters_subject_slug (subject_id, slug),
  KEY course_chapters_subject_idx (subject_id),
  CONSTRAINT course_chapters_subject_fk FOREIGN KEY (subject_id) REFERENCES course_subjects(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_chapter_activities (
  id BIGINT NOT NULL AUTO_INCREMENT,
  chapter_id BIGINT NOT NULL,
  activity_id BIGINT NOT NULL,
  page_number INT NULL,
  placement VARCHAR(32) NOT NULL DEFAULT 'PRACTICE',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY course_chapter_activities_unique (chapter_id, activity_id),
  KEY course_chapter_activities_chapter_idx (chapter_id),
  KEY course_chapter_activities_activity_idx (activity_id),
  CONSTRAINT course_chapter_activities_chapter_fk FOREIGN KEY (chapter_id) REFERENCES course_chapters(id) ON DELETE CASCADE,
  CONSTRAINT course_chapter_activities_activity_fk FOREIGN KEY (activity_id) REFERENCES learn_activities(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_progress (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  reader_id BIGINT NULL,
  subject_id BIGINT NOT NULL,
  chapter_id BIGINT NULL,
  current_page INT NULL,
  percent DOUBLE NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY course_progress_user_subject (user_id, subject_id),
  KEY course_progress_user_idx (user_id),
  KEY course_progress_subject_idx (subject_id),
  CONSTRAINT course_progress_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT course_progress_subject_fk FOREIGN KEY (subject_id) REFERENCES course_subjects(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
