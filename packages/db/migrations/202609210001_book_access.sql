-- Institutes, book licenses (book bank / library / individual), reading sessions.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS; session columns are guarded.

CREATE TABLE IF NOT EXISTS institutes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(32) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(32) NULL,
  city VARCHAR(120) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY institutes_code_key (code),
  KEY institutes_status_idx (status)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institute_members (
  id BIGINT NOT NULL AUTO_INCREMENT,
  institute_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
  class_name VARCHAR(80) NULL,
  roll_number VARCHAR(40) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY institute_members_unique (institute_id, user_id),
  KEY institute_members_user_idx (user_id),
  CONSTRAINT institute_members_institute_fk FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  CONSTRAINT institute_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS book_license_lots (
  id BIGINT NOT NULL AUTO_INCREMENT,
  subject_id BIGINT NOT NULL,
  access_model VARCHAR(24) NOT NULL,
  institute_id BIGINT NULL,
  user_id BIGINT NULL,
  seat_count INT NOT NULL DEFAULT 1,
  purchase_code VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  starts_at DATETIME(3) NULL,
  ends_at DATETIME(3) NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY book_license_lots_code (purchase_code),
  KEY book_license_lots_subject_idx (subject_id, status),
  KEY book_license_lots_institute_idx (institute_id),
  KEY book_license_lots_user_idx (user_id),
  CONSTRAINT book_license_lots_subject_fk FOREIGN KEY (subject_id) REFERENCES course_subjects(id) ON DELETE CASCADE,
  CONSTRAINT book_license_lots_institute_fk FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE SET NULL,
  CONSTRAINT book_license_lots_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS book_license_seats (
  id BIGINT NOT NULL AUTO_INCREMENT,
  lot_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  member_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY book_license_seats_unique (lot_id, user_id),
  KEY book_license_seats_user_idx (user_id),
  CONSTRAINT book_license_seats_lot_fk FOREIGN KEY (lot_id) REFERENCES book_license_lots(id) ON DELETE CASCADE,
  CONSTRAINT book_license_seats_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT book_license_seats_member_fk FOREIGN KEY (member_id) REFERENCES institute_members(id) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS book_reading_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  lot_id BIGINT NULL,
  institute_id BIGINT NULL,
  access_model VARCHAR(24) NOT NULL,
  auth_jti VARCHAR(255) NULL,
  device_key VARCHAR(64) NOT NULL,
  device_name VARCHAR(255) NULL,
  ip_address VARCHAR(100) NULL,
  user_agent VARCHAR(1000) NULL,
  chapter_id BIGINT NULL,
  page_number INT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_heartbeat_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at DATETIME(3) NULL,
  end_reason VARCHAR(32) NULL,
  seconds_active INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY book_reading_sessions_user_subject (user_id, subject_id),
  KEY book_reading_sessions_live (subject_id, ended_at, last_heartbeat_at),
  KEY book_reading_sessions_institute (institute_id, ended_at),
  KEY book_reading_sessions_jti (auth_jti),
  CONSTRAINT book_reading_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT book_reading_sessions_subject_fk FOREIGN KEY (subject_id) REFERENCES course_subjects(id) ON DELETE CASCADE,
  CONSTRAINT book_reading_sessions_lot_fk FOREIGN KEY (lot_id) REFERENCES book_license_lots(id) ON DELETE SET NULL,
  CONSTRAINT book_reading_sessions_institute_fk FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'logged_out_at'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE sessions ADD COLUMN logged_out_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'last_seen_at'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE sessions ADD COLUMN last_seen_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
