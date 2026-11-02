# Node over Bun

The planner runs on Node, installs with npm and builds with `@sveltejs/adapter-node`. SQLite is
driven through Drizzle over `better-sqlite3`. This replaces Bun as runtime and package manager, and
with it `bun:sqlite`, `svelte-adapter-bun` and the patch that adapter needed.

## Why

The teacher chose to move back to npm and Node. Bun as package manager alone would have left the
runtime on Bun, so `bun:sqlite`, the Bun adapter and Bun's request handling would stay; the switch
covers both so the project has one toolchain.

`better-sqlite3` was picked over Node's built-in `node:sqlite` because its synchronous API is the
closest match to `bun:sqlite` (`prepare`, `exec`, `inTransaction`, a `readonly` open), Drizzle has
a mature driver for it, and `node:sqlite` is still experimental on Node 22.

## Consequences

- `better-sqlite3` is a native module. ADR-0008 preferred `bun:sqlite` for needing no native build.
  npm downloads a prebuilt binary for the common platforms; a platform without one compiles it,
  which needs Python and a C++ toolchain in the build image.
- `mise.toml` pins Node, and Railpack reads `package-lock.json` and `mise.toml` to select npm and
  the Node version (ADR-0027). CI uses the same major version.
- The `start` script is `BODY_SIZE_LIMIT=100G node --env-file-if-exists=.env build`. adapter-node
  reads `BODY_SIZE_LIMIT`, `ORIGIN`, `PORT` and `HOST` as the Bun adapter did, and the default port
  stays `3000`. Bun loaded `.env` by itself; the flag keeps that, and an exported variable still
  wins over the file.
- TypeScript scripts (`reset:credentials`, the e2e fixtures, the demo database) run through `tsx`,
  which is a production dependency so `npm run reset:credentials` works in the deployed image.
- `bun:sqlite`'s `.get()` answered `null` for no row; `better-sqlite3` answers `undefined`. The raw
  client checks compare against `undefined`.
- Bun's form-data parser rewrote a file part's type from its filename extension. Node's does not, so
  an upload whose browser-declared type disagrees with its extension now reaches the Attachment
  mismatch check, and `e2e/the-attachments.e2e.ts` covers that refusal.
- `better-auth` lists `drizzle-kit` and `drizzle-orm` as optional peers with ranges that exclude the
  1.0 release candidates. npm refuses that where Bun did not, so `package.json` overrides those two
  peers to the project's own versions.
