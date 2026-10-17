-- The reset (ADR-0026, spec #387): each Class holds its own Sequence, so the plan starts again.
-- Content and the calendar stay. The teacher assigns Topics to each Class again after the upgrade.
-- Children first, so foreign keys stay satisfied.
DELETE FROM `continuation`;--> statement-breakpoint
DELETE FROM `session`;--> statement-breakpoint
DELETE FROM `placement`;--> statement-breakpoint
DELETE FROM `readiness`;--> statement-breakpoint
DELETE FROM `assigned_topic`;--> statement-breakpoint
DROP TABLE `assigned_topic`;--> statement-breakpoint
ALTER TABLE `session` DROP COLUMN `note`;--> statement-breakpoint
CREATE TABLE `class_lesson` (
	`class_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `class_lesson_pairing` UNIQUE(`class_id`, `lesson_id`),
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
CREATE TABLE `teaching_note` (
	`class_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`body` text NOT NULL,
	CONSTRAINT `teaching_note_pairing` UNIQUE(`class_id`, `lesson_id`),
	FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE CASCADE
);
