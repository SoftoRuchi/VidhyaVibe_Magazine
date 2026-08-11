-- Config-driven Learn Activities platform (admin-managed)
-- Safe to re-run: uses IF NOT EXISTS where MySQL supports it

CREATE TABLE IF NOT EXISTS learn_subjects (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY learn_subjects_slug_key (slug),
  KEY learn_subjects_active_idx (active),
  KEY learn_subjects_sort_idx (sort_order)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learn_activities (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  activity_type VARCHAR(64) NOT NULL,
  subject_id BIGINT NULL,
  difficulty VARCHAR(32) NOT NULL DEFAULT 'Easy',
  estimated_minutes INT NOT NULL DEFAULT 10,
  instructions TEXT NULL,
  config JSON NOT NULL,
  success_message VARCHAR(512) NULL,
  explanation TEXT NULL,
  points INT NOT NULL DEFAULT 10,
  badge_label VARCHAR(120) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_by BIGINT NULL,
  published_at DATETIME(3) NULL,
  completion_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY learn_activities_type_idx (activity_type),
  KEY learn_activities_subject_idx (subject_id),
  KEY learn_activities_status_idx (status),
  KEY learn_activities_difficulty_idx (difficulty),
  CONSTRAINT learn_activities_subject_fk FOREIGN KEY (subject_id) REFERENCES learn_subjects(id) ON DELETE SET NULL,
  CONSTRAINT learn_activities_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learn_activity_age_groups (
  activity_id BIGINT NOT NULL,
  age_group_id BIGINT NOT NULL,
  PRIMARY KEY (activity_id, age_group_id),
  CONSTRAINT learn_activity_age_groups_activity_fk FOREIGN KEY (activity_id) REFERENCES learn_activities(id) ON DELETE CASCADE,
  CONSTRAINT learn_activity_age_groups_age_group_fk FOREIGN KEY (age_group_id) REFERENCES age_groups(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learn_activity_age_bands (
  activity_id BIGINT NOT NULL,
  age_band VARCHAR(32) NOT NULL,
  PRIMARY KEY (activity_id, age_band),
  CONSTRAINT learn_activity_age_bands_activity_fk FOREIGN KEY (activity_id) REFERENCES learn_activities(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learn_activity_progress (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  reader_id BIGINT NULL,
  activity_id BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
  score DECIMAL(8,2) NULL,
  attempts INT NOT NULL DEFAULT 0,
  points_earned INT NOT NULL DEFAULT 0,
  result_status VARCHAR(48) NULL,
  result_message VARCHAR(512) NULL,
  response_payload JSON NULL,
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  time_spent_sec INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY learn_activity_progress_user_activity_reader (user_id, activity_id, reader_id),
  KEY learn_activity_progress_user_idx (user_id),
  KEY learn_activity_progress_activity_idx (activity_id),
  CONSTRAINT learn_activity_progress_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT learn_activity_progress_activity_fk FOREIGN KEY (activity_id) REFERENCES learn_activities(id) ON DELETE CASCADE,
  CONSTRAINT learn_activity_progress_reader_fk FOREIGN KEY (reader_id) REFERENCES readers(id) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed subjects (ignore duplicates)
INSERT IGNORE INTO learn_subjects (id, name, slug, sort_order, active) VALUES
  (1, 'Creativity', 'creativity', 10, 1),
  (2, 'Science', 'science', 20, 1),
  (3, 'Mathematics', 'mathematics', 30, 1),
  (4, 'English', 'english', 40, 1),
  (5, 'Logic', 'logic', 50, 1),
  (6, 'Financial Literacy', 'financial-literacy', 60, 1),
  (7, 'General Knowledge', 'general-knowledge', 70, 1),
  (8, 'Life Skills', 'life-skills', 80, 1);
