-- A Tag is a short, user-typed label a Lesson may carry zero or more of (issue #245). Both
-- tables are new, so this is two CREATE TABLE statements plus their indexes — no ALTER TABLE
-- on the existing, referenced `lesson` table.
CREATE TABLE `tag` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_name_unique` ON `tag` (`name` COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `lesson_tag` (
	`lesson_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`lesson_id`, `tag_id`),
	CONSTRAINT `fk_lesson_tag_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_lesson_tag_tag_id_tag_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON DELETE CASCADE
);
