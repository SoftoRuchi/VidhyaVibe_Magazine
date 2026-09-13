-- Study tools for course chapters (bookmark, note, highlight).
-- Safe to re-run: CREATE TABLE IF NOT EXISTS.
-- If your schema is not named `magazine`, change this line or double-click
-- the database in Workbench SCHEMAS, then run from CREATE TABLE onward.

USE magazine;

CREATE TABLE IF NOT EXISTS course_bookmarks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  chapter_id BIGINT NOT NULL,
  page_number INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY course_bookmarks_user_chapter_page (user_id, chapter_id, page_number),
  KEY course_bookmarks_chapter_idx (chapter_id),
  CONSTRAINT course_bookmarks_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT course_bookmarks_chapter_fk FOREIGN KEY (chapter_id) REFERENCES course_chapters(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_notes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  chapter_id BIGINT NOT NULL,
  page_number INT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY course_notes_user_chapter_idx (user_id, chapter_id),
  KEY course_notes_chapter_idx (chapter_id),
  CONSTRAINT course_notes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT course_notes_chapter_fk FOREIGN KEY (chapter_id) REFERENCES course_chapters(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_highlights (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  chapter_id BIGINT NOT NULL,
  page_number INT NULL,
  text VARCHAR(1000) NOT NULL,
  color VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY course_highlights_user_chapter_idx (user_id, chapter_id),
  KEY course_highlights_chapter_idx (chapter_id),
  CONSTRAINT course_highlights_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT course_highlights_chapter_fk FOREIGN KEY (chapter_id) REFERENCES course_chapters(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
