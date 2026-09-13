-- Chapter flashcards: authored (user_id NULL) plus student-made cards.
USE magazine;

CREATE TABLE IF NOT EXISTS course_flashcards (
  id BIGINT NOT NULL AUTO_INCREMENT,
  chapter_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  front VARCHAR(500) NOT NULL,
  back VARCHAR(2000) NOT NULL,
  page_number INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY course_flashcards_chapter_idx (chapter_id),
  KEY course_flashcards_user_idx (user_id),
  CONSTRAINT course_flashcards_chapter_fk FOREIGN KEY (chapter_id) REFERENCES course_chapters(id) ON DELETE CASCADE,
  CONSTRAINT course_flashcards_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
