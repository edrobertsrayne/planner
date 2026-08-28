-- The API key is stored as itself, not as a digest (issue #182, ADR-0021). A digest cannot be
-- turned back into a token, so the existing key is destroyed by this migration and any agent
-- holding it must be given a new one in Settings. That is a one-off cost of the upgrade.
DELETE FROM api_key;

ALTER TABLE api_key RENAME COLUMN hash TO token;
