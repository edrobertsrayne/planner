-- Named, revocable API keys for agent access (issue #132). The token is 32 random bytes,
-- base64url encoded, prefixed pln_. Only its SHA-256 hash is stored, as lowercase hex.
-- No user_id: there is one account (ADR-0011), so a key identifies a tool, not a person.
CREATE TABLE `api_key` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL UNIQUE,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
