CREATE TABLE `attachment` (
	`id` text PRIMARY KEY,
	`lesson_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `fk_attachment_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`)
);
