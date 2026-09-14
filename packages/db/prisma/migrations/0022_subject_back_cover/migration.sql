-- Textbook front cover is cover_key; add a back cover for the open book.
ALTER TABLE `course_subjects`
  ADD COLUMN `back_cover_key` VARCHAR(1024) NULL AFTER `cover_key`;
