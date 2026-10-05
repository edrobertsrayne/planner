ALTER TABLE `course` ADD `tone` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- One-off backfill (ADR-0013): existing Courses take the same fixed walk as Classes, in creation
-- order — rowid order — wrapping past eight. Courses and Classes are walked separately.
-- The CASE mirrors TONE_SEQUENCE in src/lib/class-tone.ts; change them together or not at all.
UPDATE `course`
SET `tone` = CASE ((
		SELECT COUNT(*) FROM `course` AS earlier WHERE earlier.rowid <= `course`.rowid
	) - 1) % 8
	WHEN 0 THEN 0
	WHEN 1 THEN 4
	WHEN 2 THEN 6
	WHEN 3 THEN 7
	WHEN 4 THEN 1
	WHEN 5 THEN 2
	WHEN 6 THEN 5
	ELSE 3
END;
