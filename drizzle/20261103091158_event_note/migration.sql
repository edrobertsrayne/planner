CREATE TABLE `event_note` (
	`event_id` text NOT NULL,
	`date` text NOT NULL,
	`body` text NOT NULL,
	CONSTRAINT `fk_event_note_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE CASCADE,
	CONSTRAINT `event_note_date` UNIQUE(`event_id`,`date`)
);
