-- A Lesson may stand outside a Topic (issue #130). The column is nullable; no cascade on the
-- foreign key — the planner does not delete a Topic when it still holds Lessons. Readiness rows
-- reference `lesson.id` with cascade on delete, not on update, so clearing topic_id leaves them in
-- place.
ALTER TABLE lesson ALTER COLUMN topic_id DROP NOT NULL;