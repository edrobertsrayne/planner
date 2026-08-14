CREATE TABLE `assigned_topic` (
	`id` text PRIMARY KEY,
	`class_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `fk_assigned_topic_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`),
	CONSTRAINT `fk_assigned_topic_topic_id_topic_id_fk` FOREIGN KEY (`topic_id`) REFERENCES `topic`(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocked_day` (
	`id` text PRIMARY KEY,
	`date` text NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `blocked_slot` (
	`id` text PRIMARY KEY,
	`class_id` text NOT NULL,
	`date` text NOT NULL,
	`slot_id` text NOT NULL,
	`note` text NOT NULL,
	CONSTRAINT `fk_blocked_slot_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`),
	CONSTRAINT `fk_blocked_slot_slot_id_slot_id_fk` FOREIGN KEY (`slot_id`) REFERENCES `slot`(`id`)
);
--> statement-breakpoint
CREATE TABLE `class` (
	`id` text PRIMARY KEY,
	`label` text NOT NULL,
	`course_id` text NOT NULL,
	CONSTRAINT `fk_class_course_id_course_id_fk` FOREIGN KEY (`course_id`) REFERENCES `course`(`id`)
);
--> statement-breakpoint
CREATE TABLE `course` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lesson` (
	`id` text PRIMARY KEY,
	`topic_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`planned_length` integer DEFAULT 1 NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `fk_lesson_topic_id_topic_id_fk` FOREIGN KEY (`topic_id`) REFERENCES `topic`(`id`)
);
--> statement-breakpoint
CREATE TABLE `link` (
	`id` text PRIMARY KEY,
	`lesson_id` text NOT NULL,
	`url` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT `fk_link_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`class_id` text NOT NULL,
	`date` text NOT NULL,
	`period` integer NOT NULL,
	`lesson_id` text,
	`note` text,
	CONSTRAINT `fk_session_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`),
	CONSTRAINT `fk_session_lesson_id_lesson_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`),
	CONSTRAINT `session_occasion` UNIQUE(`class_id`,`date`,`period`)
);
--> statement-breakpoint
CREATE TABLE `slot` (
	`id` text PRIMARY KEY,
	`class_id` text NOT NULL,
	`week` text NOT NULL,
	`day` integer NOT NULL,
	`period` integer NOT NULL,
	`holds_from` text,
	`holds_to` text,
	CONSTRAINT `fk_slot_class_id_class_id_fk` FOREIGN KEY (`class_id`) REFERENCES `class`(`id`),
	CONSTRAINT "slot_day_range" CHECK("day" between 1 and 5),
	CONSTRAINT "slot_period_range" CHECK("period" between 1 and 6)
);
--> statement-breakpoint
CREATE TABLE `teaching_week` (
	`id` text PRIMARY KEY,
	`week_commencing` text NOT NULL,
	`letter` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `term` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`opens` text NOT NULL,
	`closes` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `topic` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`course_id` text NOT NULL,
	CONSTRAINT `fk_topic_course_id_course_id_fk` FOREIGN KEY (`course_id`) REFERENCES `course`(`id`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	CONSTRAINT `fk_auth_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `authSession_userId_idx` ON `auth_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);