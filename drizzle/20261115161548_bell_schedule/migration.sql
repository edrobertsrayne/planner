CREATE TABLE `bell_schedule` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bell_time` (
	`schedule_id` text NOT NULL,
	`position` integer NOT NULL,
	`starts` text NOT NULL,
	`ends` text NOT NULL,
	CONSTRAINT `bell_time_pk` PRIMARY KEY(`schedule_id`, `position`),
	CONSTRAINT `fk_bell_time_schedule_id_bell_schedule_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `bell_schedule`(`id`) ON DELETE CASCADE,
	CONSTRAINT "bell_time_position" CHECK("position" in (1,2,3,4,5,6,8,9))
);
--> statement-breakpoint
ALTER TABLE `class` ADD `schedule_id` text REFERENCES bell_schedule(id);--> statement-breakpoint
ALTER TABLE `event_slot` ADD `schedule_id` text REFERENCES bell_schedule(id);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_event_slot` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`week` text NOT NULL,
	`day` integer NOT NULL,
	`position` integer NOT NULL,
	`schedule_id` text,
	`holds_from` text,
	`holds_to` text,
	`room` text,
	CONSTRAINT `fk_event_slot_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_slot_schedule_id_bell_schedule_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `bell_schedule`(`id`),
	CONSTRAINT "event_slot_day_range" CHECK("day" between 1 and 5),
	CONSTRAINT "event_slot_position_range" CHECK("position" between 0 and 9),
	CONSTRAINT "event_slot_schedule" CHECK(("position" in (8,9)) = ("schedule_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_event_slot`(`id`, `event_id`, `week`, `day`, `position`, `holds_from`, `holds_to`, `room`) SELECT `id`, `event_id`, `week`, `day`, `position`, `holds_from`, `holds_to`, `room` FROM `event_slot`;--> statement-breakpoint
DROP TABLE `event_slot`;--> statement-breakpoint
ALTER TABLE `__new_event_slot` RENAME TO `event_slot`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_event` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	CONSTRAINT "event_kind" CHECK("kind" in ('meeting','club','intervention','duty','other'))
);
--> statement-breakpoint
INSERT INTO `__new_event`(`id`, `name`, `kind`) SELECT `id`, `name`, `kind` FROM `event`;--> statement-breakpoint
DROP TABLE `event`;--> statement-breakpoint
ALTER TABLE `__new_event` RENAME TO `event`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `bell_schedule_name_unique` ON `bell_schedule` ("name" COLLATE NOCASE);--> statement-breakpoint
CREATE UNIQUE INDEX `bell_schedule_one_default` ON `bell_schedule` (`is_default`) WHERE "bell_schedule"."is_default" = 1;