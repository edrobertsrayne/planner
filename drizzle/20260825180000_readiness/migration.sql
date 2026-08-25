CREATE TABLE `readiness` (
	`id` text PRIMARY KEY,
	`lesson_id` text NOT NULL,
	`class_id` text NOT NULL,
	CONSTRAINT `fk_readiness_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_readiness_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`) ON DELETE CASCADE,
	CONSTRAINT `readiness_pairing` UNIQUE(`lesson_id`,`class_id`)
);
