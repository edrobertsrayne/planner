-- A Class holds a Class note, and Links and Attachments of its own (ADR-0032). A Link or an
-- Attachment has exactly one owner, a Lesson or a Class; SQLite cannot relax lesson_id's NOT NULL
-- in place, so both tables are rebuilt.
ALTER TABLE `class` ADD `note` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attachment` (
	`id` text PRIMARY KEY,
	`lesson_id` text,
	`class_id` text,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `fk_attachment_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`),
	CONSTRAINT `fk_attachment_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`),
	CONSTRAINT "attachment_one_owner" CHECK(("lesson_id" is null) <> ("class_id" is null))
);
--> statement-breakpoint
INSERT INTO `__new_attachment`(`id`, `lesson_id`, `filename`, `mime_type`, `size`, `position`) SELECT `id`, `lesson_id`, `filename`, `mime_type`, `size`, `position` FROM `attachment`;--> statement-breakpoint
DROP TABLE `attachment`;--> statement-breakpoint
ALTER TABLE `__new_attachment` RENAME TO `attachment`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_link` (
	`id` text PRIMARY KEY,
	`lesson_id` text,
	`class_id` text,
	`url` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `fk_link_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`),
	CONSTRAINT `fk_link_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`),
	CONSTRAINT "link_one_owner" CHECK(("lesson_id" is null) <> ("class_id" is null))
);
--> statement-breakpoint
INSERT INTO `__new_link`(`id`, `lesson_id`, `url`, `label`, `position`) SELECT `id`, `lesson_id`, `url`, `label`, `position` FROM `link`;--> statement-breakpoint
DROP TABLE `link`;--> statement-breakpoint
ALTER TABLE `__new_link` RENAME TO `link`;--> statement-breakpoint
PRAGMA foreign_keys=ON;