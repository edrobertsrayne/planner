# ADR-0016: API keys as a second authentication mechanism

**Status:** Superseded by [ADR-0019](0019-one-regenerable-api-key.md) (2026-08-27)

**Issue:** [#132](https://github.com/edrobertsrayne/planner/issues/132)

## Context

The planner authenticates its human user through a cookie session managed by better-auth. An
automated agent (such as an import script) cannot use a cookie session. The Planning HTTP API
(ADR-0017, issue #133 onwards) needs a way to authorise agent requests.

The options considered were:

1. **One global API key** — one token for the account, shared by every tool. Hard to revoke without
   breaking everything at once.
2. **A key for each tool, managed through the Settings screen** — named, created and revoked
   individually, so one compromised key does not disable the others.
3. **A separate key-management API** — endpoints that create and revoke keys. A key capable of
   making more keys makes revocation pointless; if a key is stolen, the attacker can make their own.
4. **OAuth / delegated auth** — unsuited to a single-user, self-hosted application with no identity
   provider.

## Decision

Use option 2: **named, revocable API keys**, managed in the browser-only Settings screen. API keys
are a second authentication mechanism alongside the existing cookie session.

The token is 32 random bytes, base64url encoded, prefixed `pln_`. The server stores only a SHA-256
hash of the token. A plain SHA-256 is correct here — the token is 256 bits of random data, not a
human-chosen password, so it cannot be guessed and a slow password hash such as argon2 buys nothing.

Key management has **no HTTP endpoints**. The consequence of a key that can make another key is that
a single compromised key lets an attacker create permanent access for themselves. By keeping key
management in the browser only, revoking a compromised key is a final action: the attacker cannot
recover from it.

## Consequences

- The planner now has two authentication mechanisms. The architecture is more complex for it.
- A human signs in with a password; an agent authenticates with a bearer token. The two never
  collide, because the API routes (which check the bearer token) and the browser routes (which check
  the cookie session) are handled by different code paths in hooks.server.ts.
- A teacher can give each tool its own key and revoke one without affecting the others.
- If the server's secret key (`BETTER_AUTH_SECRET`) or the database is compromised, both
  mechanisms are compromised. No design avoids this — the server must be able to validate both
  cookies and tokens.
