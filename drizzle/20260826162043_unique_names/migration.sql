-- Course names are unique across the planner (issue #131). Matching is case-insensitive and
-- the application trims and lowercases-equivalent names before writing, so the index is the
-- guard of last resort — a raw SQLite constraint violation is a bug, not a user experience.
-- Topic names are unique within their Course only — two Courses may each hold a "Forces".
-- Lesson titles are intentionally NOT unique and gain no constraint.
CREATE UNIQUE INDEX `course_name_unique` ON `course` (`name` COLLATE NOCASE);--> statement-breakpoint
CREATE UNIQUE INDEX `topic_name_per_course` ON `topic` (`course_id`, `name` COLLATE NOCASE);
