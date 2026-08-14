CREATE TABLE `continuation` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	CONSTRAINT `fk_continuation_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`)
);
