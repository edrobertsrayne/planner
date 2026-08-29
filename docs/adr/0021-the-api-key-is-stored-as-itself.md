# ADR-0021: The API key is stored as itself

**Status:** Accepted (2026-08-28)

**Issue:** [#182](https://github.com/edrobertsrayne/planner/issues/182)

**Supersedes:** [ADR-0019](0019-one-regenerable-api-key.md)

## Context

ADR-0019 kept one rule from ADR-0016: only a SHA-256 hash of the token is stored. That rule came
with the key, and nobody had re-examined it when the shape of the key changed.

The rule defends a stolen-database threat. This planner does not have that threat. It is
self-hosted and single-user: the same SQLite file holds the session table and every Course, Topic
and Lesson. Anyone who can read the key table already owns the account, and an owner can mint a
key of their own in Settings. A digest of a 256-bit random token protects nothing the token's own
randomness does not protect.

What the hash costs is paid on every visit. Because the token cannot be recovered from its digest,
the token can be shown once and never again. A teacher who loses the key must regenerate to see
one again, breaking every agent that held the old token.

The options:

1. **Keep the digest** — the token stays show-once, and regeneration stays the only way back in.
2. **Store the token itself** — the token can be shown whenever Settings is open, and the hash
   helper and its duplicate go away.

## Decision

Use option 2: **store the token itself.** The key column holds the token as it was minted — 32
random bytes, base64url encoded, prefixed `pln_` — and stays `NOT NULL UNIQUE`. A plain lookup
matches the presented bearer token; nothing is hashed on the way in or out.

- **Nothing the teacher sees moves in this ticket.** Settings keeps its Generate / Regenerate
  button and its show-once panel. That the token can now be shown again is a change for a later
  ticket to make.
- **`requireApiKey` keeps its behaviour**: bearer token, direct lookup, last-used stamp, and the
  same 401 body for an absent, malformed or unknown token.
- **The token is minted in one place**, the Settings generate action, as before.

## Consequences

- **The migration destroys the existing key.** A digest cannot be turned back into a token, so
  there is nothing to carry over. Any agent holding the old token must be given a new one in
  Settings. This is a one-off cost of the upgrade, and it is stated in the migration comment.
- The Settings screen can, in a later ticket, show the key whenever it is open. The show-once
  warning loses its reason and goes with it.
- A stolen database still leaks the key — but as argued above, a stolen database is the account.
  Nothing new is exposed that was not already lost.
