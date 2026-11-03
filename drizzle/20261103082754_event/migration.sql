CREATE TABLE `event` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	CONSTRAINT "event_kind" CHECK("kind" in ('meeting','club','intervention','other'))
);
--> statement-breakpoint
CREATE TABLE `event_slot` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`week` text NOT NULL,
	`day` integer NOT NULL,
	`position` integer NOT NULL,
	`holds_from` text,
	`holds_to` text,
	`room` text,
	CONSTRAINT `fk_event_slot_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE CASCADE,
	CONSTRAINT "event_slot_day_range" CHECK("day" between 1 and 5),
	CONSTRAINT "event_slot_position_range" CHECK("position" between 0 and 7)
);
