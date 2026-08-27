-- One regenerable API key, not a list of named keys (issue #160, ADR-0019). The table now holds
-- at most one row, enforced by the write path: generating deletes every row and inserts one.
ALTER TABLE `api_key` DROP COLUMN `name`;
