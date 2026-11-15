-- A date is a Blocked Day once at most, and a Slot is blocked once at most on one date. The seam
-- (`blockDay`, `blockSlots`) has always refused a second; the indexes say it in the database too.
-- Any duplicate a database somehow holds is dropped first, keeping the earliest row, or the index
-- could not be built and the server would not start.
DELETE FROM `blocked_day` WHERE rowid NOT IN (SELECT MIN(rowid) FROM `blocked_day` GROUP BY `date`);--> statement-breakpoint
DELETE FROM `blocked_slot` WHERE rowid NOT IN (SELECT MIN(rowid) FROM `blocked_slot` GROUP BY `class_id`, `date`, `slot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_day_date` ON `blocked_day` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_slot_occasion` ON `blocked_slot` (`class_id`,`date`,`slot_id`);