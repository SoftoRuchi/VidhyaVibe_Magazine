-- Bookmark types and quote-anchored notes.
USE magazine;

ALTER TABLE course_bookmarks
  ADD COLUMN mark_type VARCHAR(16) NOT NULL DEFAULT 'important' AFTER page_number;

ALTER TABLE course_notes
  ADD COLUMN quote VARCHAR(1000) NULL AFTER content;
