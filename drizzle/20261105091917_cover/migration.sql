CREATE TABLE `cover` (
	`id` text PRIMARY KEY,
	`class_id` text NOT NULL,
	`date` text NOT NULL,
	`slot_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	CONSTRAINT `fk_cover_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`),
	CONSTRAINT `fk_cover_slot_id_slot_id_fk` FOREIGN KEY (`slot_id`) REFERENCES `slot`(`id`),
	CONSTRAINT `fk_cover_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`),
	CONSTRAINT `cover_occasion` UNIQUE(`class_id`,`date`,`slot_id`)
);
--> statement-breakpoint
ALTER TABLE `blocked_day` ADD `absent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `blocked_slot` ADD `absent` integer DEFAULT false NOT NULL;