-- Keep chapters in the order they were added (id), not a leftover sort_order of 0.
UPDATE course_chapters ch
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY subject_id ORDER BY id ASC) * 10 AS new_sort
  FROM course_chapters
) ranked ON ranked.id = ch.id
SET ch.sort_order = ranked.new_sort;
