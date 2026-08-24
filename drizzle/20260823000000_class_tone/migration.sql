ALTER TABLE `class` ADD `tone` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- One-off backfill (ADR-0013): existing Classes take the fixed farthest-point walk in creation
-- order — rowid order, since rowids are handed out monotonically on insert — wrapping past eight.
-- The CASE mirrors TONE_SEQUENCE in src/lib/class-tone.ts; change them together or not at all.
UPDATE `class`
SET `tone` = CASE ((
		SELECT COUNT(*) FROM `class` AS earlier WHERE earlier.rowid <= `class`.rowid
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
