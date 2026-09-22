CREATE TABLE `placement` (
	`id` text PRIMARY KEY,
	`class_id` text NOT NULL,
	`date` text NOT NULL,
	`slot_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	CONSTRAINT `fk_placement_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`),
	CONSTRAINT `fk_placement_slot_id_slot_id_fk` FOREIGN KEY (`slot_id`) REFERENCES `slot`(`id`),
	CONSTRAINT `fk_placement_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`),
	CONSTRAINT `placement_anchor` UNIQUE(`class_id`,`date`,`slot_id`)
);
