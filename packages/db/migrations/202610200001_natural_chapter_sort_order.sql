-- Normalize chapter sort_order so chapters are ordered starting from Chapter 1
-- This migration ensures chapters with Chapter 1, Chapter 2 added later are ordered at the beginning.
UPDATE course_chapters SET sort_order = 10 WHERE title LIKE 'Chapter 1 %' OR title LIKE 'Chapter 1:%' OR title LIKE 'Chapter 1 —%';
UPDATE course_chapters SET sort_order = 20 WHERE title LIKE 'Chapter 2 %' OR title LIKE 'Chapter 2:%' OR title LIKE 'Chapter 2 —%';
