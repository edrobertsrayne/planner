# ADR-0019: One regenerable API key

**Status:** Superseded by [ADR-0021](0021-the-api-key-is-stored-as-itself.md) (2026-08-28)

**Issue:** [#160](https://github.com/edrobertsrayne/planner/issues/160)

**Supersedes:** [ADR-0016](0016-api-keys-as-second-authentication.md)

## Context

ADR-0016 chose **named, revocable API keys** over one global key, on the grounds that "one
compromised key does not disable the others".

That reasoning does not survive contact with this planner. There is one teacher, one agent
workflow, and one key in practice. The naming, the list in Settings, the per-row revoke, and the
collision between two live keys are all machinery for a second consumer nobody has asked for. The
benefit is also thin: with one consumer, revoking **is** breaking it, and that is the intent.

The options, reconsidered:

1. **One global API key** — one token for the account.
2. **A key for each tool, named and revoked individually** — the ADR-0016 decision, and the
   machinery described above.

## Decision

Use option 1: **one API key**. It exists or it does not, and it can be regenerated.

- **Settings** shows a single card: whether a key exists, when it was created, and when it was last
  used. One button — **Generate** when there is none, **Regenerate** when there is one.
- **Regenerating replaces the key.** The old token stops working the moment the new one is shown.
  This is the only revoke: there is nothing to revoke separately.
- **The token is shown once**, on generation, as before.
- **No name.** A key that is the only key does not need one. The `name` column is dropped.
- **At most one row**, enforced by the write path: generating deletes every row and inserts one, in
  that order.

The parts of ADR-0016 that were never the problem stand, restated here so the superseded ADR can be
read as history without anyone mining it for what is true today:

- The token is 32 random bytes, base64url encoded, prefixed `pln_`.
- Only a SHA-256 hash of the token is stored, as lowercase hex. A plain SHA-256 is correct — the
  token is 256 bits of random data, not a human-chosen password, so it cannot be guessed and a slow
  password hash such as argon2 buys nothing.
- Key management has **no HTTP endpoints**. A key that can make another key makes revocation
  pointless. Regeneration stays a browser-only action in Settings.

## Consequences

- The Settings screen loses a form field, a list, and a destructive button per row. The teacher
  regenerates, and knows that regeneration is revocation.
- `requireApiKey` keeps its behaviour: bearer token, hash lookup, last-used stamp, 401 otherwise.
  It no longer records which key authenticated, because there is only ever one.
- A leaked key is handled by regenerating. Every tool using the old token breaks at once, which is
  the desired outcome when the account is compromised.
- Two tools cannot hold different keys. If a second consumer ever arrives, this ADR is superseded in
  turn — the same reconsideration in reverse.
