# better-auth for a single-user SvelteKit app

Research for [issue #8](https://github.com/edrobertsrayne/planner/issues/8). Answers how better-auth
wires into SvelteKit 2 with a Drizzle/Postgres adapter for exactly one user, behind Cloudflare
Access.

**Researched against `better-auth@1.6.27`** (published 2026-08-11, `latest` on npm at the time of
writing), `@better-auth/drizzle-adapter@1.6.27`, and CLI `auth@1.6.27`. Source claims are pinned to
git tag `v1.6.27` = commit
[`be47e94`](https://github.com/better-auth/better-auth/tree/be47e9418b4a25a4ecd51ba781d2296373b65a03).

Note there is a `1.7.0-rc.5` on the `rc` dist-tag. This document deliberately targets the stable
line. Pin the exact version in `package.json` — this library moves fast and the docs site tracks
`latest` only.

---

## Verdict

The whole thing is about 120 lines of application code. Nothing here is exotic. Five findings
matter more than the rest, because four of them are traps you only discover after they have cost
you an afternoon:

1. **The Drizzle adapter never touches DDL.** It contains no `CREATE TABLE` and no migration path,
   and `auth migrate` explicitly does not support Drizzle. better-auth's CLI *generates* a Drizzle
   schema file that you check in and migrate yourself. This is exactly what ADR-0003 wants, and it
   needs no compromise — see [§3](#3-tables-schema-generation-and-adr-0003).

2. **`baseURL` is the single most load-bearing option in this deployment.** It decides three
   separate things at once: whether the auth handler mounts at all
   ([`isAuthPath`](#2-sveltekit-wiring)), whether cookies get `Secure` and the `__Secure-` prefix
   ([§6](#6-session-and-cookie-configuration)), and which origin the CSRF check trusts. Because the
   nginx→node hop is plain HTTP, every one of those would silently do the wrong thing if `baseURL`
   were left to be inferred from the request. Set it to the public HTTPS URL explicitly.

3. **`disableSignUp: true` does not unmount `/sign-up/email`** — the route stays mounted and returns
   HTTP 400. That is sufficient (no account can be created), but if you want the endpoint to not
   exist, you need a `hooks.before` deny-list. [§4](#4-creating-the-one-user) covers both.

4. **The password hash format is stable and trivially reproducible**: `scrypt`, `N=16384 r=16 p=1
   dkLen=64`, stored as `"<salt-hex>:<key-hex>"`. So agenix can hold either a plaintext password or
   a pre-computed hash — [§5](#5-where-the-password-lives) argues for the hash.

5. **SvelteKit's `handle` hook does not run for static assets**, so a deny-by-default guard needs no
   asset exclusions — only a `/login` allowance. [§7](#7-deny-by-default-route-protection).

Everything the ticket rules out — password reset, email verification, OAuth, user management — is
either off by default or disabled with a single option. None of it needs to be fought.

---

## 1. Install and the server `auth.ts`

### Packages

```
npm i better-auth@1.6.27 @better-auth/drizzle-adapter@1.6.27
```

The Drizzle adapter now ships as its own package, `@better-auth/drizzle-adapter`, versioned in
lockstep with core. The legacy subpath `better-auth/adapters/drizzle` **still exists** in 1.6.27 —
it is present in the published `exports` map as `./adapters/drizzle` — but the
[current adapter docs](https://www.better-auth.com/docs/adapters/drizzle) use the standalone
package, so prefer it.

The CLI is invoked as `npx auth@latest <command>`, per the
[CLI docs](https://www.better-auth.com/docs/concepts/cli). Note that the older `@better-auth/cli`
package on npm is stalled at 1.4.21 while `auth` tracks 1.6.27 — use `auth`, and pin it:
`npx auth@1.6.27`.

### Adapter signature

From the shipped type declarations (`@better-auth/drizzle-adapter@1.6.27`,
`dist/index.d.mts`, mirroring
[`packages/drizzle-adapter/src/drizzle-adapter.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/drizzle-adapter/src/drizzle-adapter.ts)):

```ts
declare const drizzleAdapter: (db: DB, config: DrizzleAdapterConfig)
  => (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>;

interface DrizzleAdapterConfig {
  schema?: Record<string, any> | undefined;
  provider: "pg" | "mysql" | "sqlite";
  usePlural?: boolean | undefined;
  debugLogs?: DBAdapterDebugLogOption | undefined;
  camelCase?: boolean | undefined;   // @default false
  transaction?: boolean | undefined; // @default false
}
```

Points that matter for this app:

- `provider: "pg"` — the value is `"pg"`, not `"postgres"` or `"postgresql"`.
- `schema` is optional. If your Drizzle schema exports the tables under exactly the names
  better-auth expects (`user`, `session`, `account`, `verification`) you can omit it. The planner
  schema will export other tables alongside, so pass the schema object explicitly and keep the
  mapping visible.
- `camelCase` defaults to `false`, meaning the CLI generates **snake_case column names** with
  camelCase TypeScript property names. Leave it false; it matches ordinary Postgres convention.
- `transaction` defaults to `false`. Postgres supports transactions and the app is single-user, so
  set it to `true` — sign-up creates a `user` row and an `account` row and you want those atomic.
  (Confirmed present as a config key in the 1.6.27 declarations above.)
- The docs note a constraint worth remembering: *"Drizzle schema property names must match Better
  Auth field names, while actual database column names can differ."*

### Options relevant here

From the [options reference](https://www.better-auth.com/docs/reference/options):

| Option | Meaning |
| --- | --- |
| `secret` | Signing/hashing key. Defaults to `BETTER_AUTH_SECRET` or `AUTH_SECRET` env. |
| `baseURL` | Root URL of the app. Falls back to `BETTER_AUTH_URL`, then to request inference. |
| `basePath` | Where auth routes mount. Default `"/api/auth"`. |
| `trustedOrigins` | Extra trusted origins *beyond* `baseURL`'s own origin. |
| `emailAndPassword.enabled` | Turns on credential auth. |
| `emailAndPassword.disableSignUp` | Makes `/sign-up/email` return 400. |
| `session.expiresIn` | Default `604800` (7 days). |
| `session.updateAge` | Default `86400` (1 day). |
| `advanced.useSecureCookies` | Forces the `Secure` attribute. |
| `advanced.database.generateId` | `false`, `"serial"`, `"uuid"`, or a function. Default base62 string. |

`rateLimit` is on by default in production (`window: 10`s, `max: 100`), storage `"memory"`. For a
single user on one node process, in-memory is correct — leave it.

`telemetry.enabled` defaults to `false`. No action needed, but worth knowing it exists.

---

## 2. SvelteKit wiring

### The handler mount

Per the [SvelteKit integration docs](https://www.better-auth.com/docs/integrations/svelte-kit), the
handler mounts inside `handle` via `svelteKitHandler`. The implementation is small enough to quote
in full — from
[`packages/better-auth/src/integrations/svelte-kit.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/better-auth/src/integrations/svelte-kit.ts):

```js
const svelteKitHandler = async ({ auth, event, resolve, building }) => {
	if (building) return resolve(event);
	const { request, url } = event;
	if (isAuthPath(url.toString(), auth.options)) return auth.handler(request);
	return resolve(event);
};

function isAuthPath(url, options) {
	const _url = new URL(url);
	const baseURLStr = typeof options.baseURL === "string" ? options.baseURL : void 0;
	const baseURL = new URL(`${baseURLStr || _url.origin}${options.basePath || "/api/auth"}`);
	if (_url.origin !== baseURL.origin) return false;
	if (!_url.pathname.startsWith(baseURL.pathname.endsWith("/") ? baseURL.pathname : `${baseURL.pathname}/`)) return false;
	return true;
}
```

**This is the trap referenced in the verdict.** `isAuthPath` compares `event.url.origin` against
`baseURL`'s origin and returns `false` on mismatch — in which case `auth.handler` is never called
and every auth request falls through to normal routing, producing a 404 with no error message. If
`baseURL` is `https://planner.greensroad.uk` but `adapter-node` computes `event.url.origin` as
`http://localhost:3000` because `ORIGIN` was not set, auth is silently dead. The two must agree.
See [§6](#6-session-and-cookie-configuration) for the fix.

Note also that `svelteKitHandler` short-circuits — when the path is an auth path it returns
`auth.handler(request)` and never calls `resolve`. That is what lets a deny-by-default guard sit
*after* it in a `sequence` without blocking login ([§7](#7-deny-by-default-route-protection)).

### The `sveltekitCookies` plugin

Cookies set during a *server action* (SvelteKit form action) do not automatically make it onto the
response, because the auth call happens inside your action rather than through the mounted handler.
The `sveltekitCookies` plugin bridges this: it registers an `after` hook that parses the
`set-cookie` header better-auth produced and replays it through `event.cookies.set`. From the same
source file:

```js
const sveltekitCookies = (getRequestEvent) => { /* ... */
	handler: createAuthMiddleware(async (ctx) => {
		const returned = ctx.context.responseHeaders;
		if ("_flag" in ctx && ctx._flag === "router") return;
		if (returned instanceof Headers) {
			const setCookies = returned?.get("set-cookie");
			if (!setCookies) return;
			const event = getRequestEvent();
			if (!event) return;
			const parsed = parseSetCookieHeader(setCookies);
			for (const [name, attributes] of parsed) try {
				event.cookies.set(name, attributes.value, { ...toCookieOptions(attributes), path: attributes.path || "/" });
			} catch {}
		}
	})
};
```

The docs say to **position it as the final plugin**; the source backs this with a runtime warning
(`warnIfCookiePluginNotLast`). Since we log in via a form action, this plugin is required, not
optional.

### Session on `event.locals`

The docs' pattern is a direct `auth.api.getSession` call inside `handle`:

```ts
const session = await auth.api.getSession({ headers: event.request.headers });
if (session) {
  event.locals.session = session.session;
  event.locals.user = session.user;
}
```

`getSession` returns `{ session, user }` or `null`. The `Auth` type exposes `$Infer.Session` for
typing — from `dist/types/auth.d.mts` in the published package:

```ts
$Infer: /* ... */ {
  Session: {
    session: Session<Options["session"], Options["plugins"]>;
    user: User<Options["user"], Options["plugins"]>;
  };
}
```

so `App.Locals` can be typed off `typeof auth.$Infer.Session` without hand-writing the shapes.

---

## 3. Tables, schema generation, and ADR-0003

### Does anything mutate the database at runtime?

**No.** Two independent confirmations:

- The [CLI docs](https://www.better-auth.com/docs/concepts/cli) state of `migrate`: *"This is
  available if you're using the built-in Kysely adapter. For other adapters, you'll need to apply
  the schema using your ORM's migration tool."*
- Grepping the published `@better-auth/drizzle-adapter@1.6.27` bundle
  (`dist/index.mjs`) for `create table` / `createTable` / `alter table` / `migrate` returns **zero
  matches**. The adapter is pure CRUD.

So the arrangement ADR-0003 requires is the *only* arrangement available with Drizzle — there is no
runtime-mutation mode to opt out of. Good.

### The workflow

```
npx auth@1.6.27 generate --config src/lib/server/auth.ts --output src/lib/server/db/auth-schema.ts
npx drizzle-kit generate     # diffs schema -> writes a checked-in SQL migration
npx drizzle-kit migrate      # applies it
```

`generate` defaults to `./auth-schema.ts`
([`packages/cli/src/generators/drizzle.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/cli/src/generators/drizzle.ts):
`const filePath = file || "./auth-schema.ts";`) — override it with `--output` so the file lands
inside the app's schema directory and is picked up by `drizzle-kit`'s `schema` glob. From then on
the auth tables are ordinary tables in the app's own migration history, indistinguishable from
`term` or `course`. Re-run `generate` only when upgrading better-auth, and treat the resulting diff
as a normal schema change.

`generate` also accepts `--config` (path to the auth file) and `--yes` (skip prompts) — useful for
making this a `package.json` script.

### The generated schema

This is **actual CLI output**, produced by running `auth@1.6.27 generate` against a minimal
`provider: "pg"` config — not a reconstruction:

```ts
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_userId_idx").on(table.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()).notNull(),
}, (table) => [index("account_userId_idx").on(table.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

// plus userRelations / sessionRelations / accountRelations
```

Four gotchas in that output:

1. **`session.updatedAt` and `account.updatedAt` are `.notNull()` with no `.defaultNow()`** — only
   `$onUpdate`, which Drizzle applies on *update*, not insert. better-auth's own internal adapter
   always supplies the value, so this never bites at runtime, but a hand-written seed INSERT must
   set `updated_at` explicitly or hit a NOT NULL violation. (`user` and `verification` do have
   `.defaultNow()`. The inconsistency is real.)
2. **The table is literally named `user`**, which is a reserved word in Postgres. Drizzle quotes
   identifiers so ORM access is fine, but any hand-written SQL must say `"user"`.
3. `emailVerified` is `.notNull()` with `default(false)` — fine, and it stays false forever here
   since email verification is out of scope.
4. `verification` is required even though nothing in this app verifies anything. It is part of the
   core schema; leave the empty table.

Column types map per
[`generators/drizzle.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/cli/src/generators/drizzle.ts):
`string`→`text`, `boolean`→`boolean`, `date`→`timestamp`, `number`→`integer`, `json`→`jsonb`, with
`.notNull()` when `required !== false`, `.unique()` when `unique`, and
`.references(() => …, { onDelete: "cascade" })` for foreign keys.

The [database concepts page](https://www.better-auth.com/docs/concepts/database) documents the same
four tables in prose, and is the reference to consult if a future plugin adds more.

---

## 4. Creating the one user

### What the mounted handler exposes by default

Extracted from the endpoint path literals in `better-auth@1.6.27`'s `dist/api/routes/*.mjs`. All of
these sit under `basePath` (default `/api/auth`):

```
/ok                      /error
/sign-up/email           /sign-in/email          /sign-in/social
/sign-out                /get-session            /update-session
/list-sessions           /revoke-session         /revoke-sessions
/revoke-other-sessions
/update-user             /change-password        /set-password (internal)
/change-email            /delete-user            /delete-user/callback
/verify-password
/request-password-reset  /reset-password         /reset-password/:token
/send-verification-email /verify-email
/list-accounts           /link-social            /unlink-account
/account-info            /get-access-token       /refresh-token
/callback/:id
```

That list looks alarming for a single-user app. It is mostly not:

- **OAuth-shaped routes** (`/sign-in/social`, `/link-social`, `/unlink-account`, `/callback/:id`,
  `/get-access-token`, `/refresh-token`) have no configured providers, so they can only error.
- **`/delete-user` and `/change-email` are opt-in.** Source guards:
  `if (!ctx.context.options.user?.deleteUser?.enabled)` at
  [`update-user.ts:288`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/better-auth/src/api/routes/update-user.ts)
  and `if (!ctx.context.options.user?.changeEmail?.enabled)` at the same file. The docs confirm both
  are *"disabled by default"*. Leave them unset.
- **Password-reset routes** need `emailAndPassword.sendResetPassword` to be configured. Unset, they
  cannot send anything. Email verification likewise requires
  `emailVerification.sendVerificationEmail`.
- **Session-management routes** (`/list-sessions`, `/revoke-*`) require a valid session, so they are
  reachable only by the one authenticated user acting on their own sessions. Harmless.

### Disabling sign-up — and what that actually does

`emailAndPassword.disableSignUp: true` is the documented switch. What it does, exactly, from
[`sign-up.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/better-auth/src/api/routes/sign-up.ts):

```js
if (!ctx.context.options.emailAndPassword?.enabled || ctx.context.options.emailAndPassword?.disableSignUp)
  throw APIError.from("BAD_REQUEST", {
    message: "Email and password sign up is not enabled",
    code: "EMAIL_PASSWORD_SIGN_UP_DISABLED"
  });
```

So: **the route remains mounted and returns HTTP 400.** No account can be created through it, which
satisfies the ticket's "no self-service registration reachable on the internet". If you want the
endpoint to genuinely not respond, add a `hooks.before` deny-list — see the skeleton in
[§Worked skeleton](#worked-skeleton). Per the
[hooks docs](https://www.better-auth.com/docs/concepts/hooks), a `before` hook throwing `APIError`
rejects the request outright, and branching is done on `ctx.path`.

Given this sits behind Cloudflare Access, the 400 is honestly enough. The deny-list is belt-and-
braces and costs six lines; it is included because it also lets you shut off the reset/verification
routes in one place, and because it makes the intent legible to a future reader.

### The mechanism for creating the user

**Recommended: a seed script that builds its own auth instance with sign-up enabled, calls
`auth.api.signUpEmail` once, and exits.**

`signUpEmail` is a real `auth.api` method — it is exported from
`dist/api/routes/index.d.mts` as `signUpEmail` and bound to the `/sign-up/email` endpoint. Calling
it server-side goes through better-auth's own code path, so the row shapes and the hash format are
correct by construction and stay correct across upgrades. The production instance keeps
`disableSignUp: true`; the seed instance is a separate object that only ever exists inside the
script.

This beats the alternatives:

- *Hand-inserting rows with Drizzle* works — you need a `user` row plus an `account` row with
  `providerId: "credential"` and `accountId` equal to the user's id (from
  [`sign-up.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/better-auth/src/api/routes/sign-up.ts):
  `linkAccount({ userId: createdUser.id, providerId: "credential", accountId: createdUser.id, password: hash })`)
  — but it duplicates better-auth's invariants in your code and will rot.
- *Temporarily flipping `disableSignUp` in production config* means a window where the internet-
  facing app accepts registrations. No.
- *A one-off route you delete afterwards* leaves the risk that you forget.

Run it as an `npm run seed:user` after migrations, once, on the box.

---

## 5. Where the password lives

### What better-auth's hashing actually is

`better-auth/crypto` re-exports from `@better-auth/utils/password` (better-auth 1.6.27 pins
`@better-auth/utils@0.4.2`). The published `password.node.mjs` from that version, in full:

```js
import { randomBytes, scrypt } from 'node:crypto';

const config = { N: 16384, r: 16, p: 1, dkLen: 64 };

function generateKey(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, config.dkLen,
      { N: config.N, r: config.r, p: config.p, maxmem: 128 * config.N * config.r * 2 },
      (err, key) => err ? reject(err) : resolve(key));
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(hash, password) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) throw new Error("Invalid password hash");
  const targetKey = await generateKey(password, salt);
  return targetKey.toString("hex") === key;
}
```

So the stored format in `account.password` is:

```
<32 hex chars>:<128 hex chars>
```

Precisely:

- **Algorithm**: scrypt, `N=16384`, `r=16`, `p=1`, `dkLen=64`.
- **Salt**: 16 random bytes, hex-encoded — and the resulting **32-character ASCII string is what is
  passed to scrypt as the salt**, not the 16 raw bytes. Reimplementing this wrongly is the easiest
  way to produce a hash that never verifies.
- **Password normalisation**: `NFKC` before hashing.
- **Encoding**: lowercase hex throughout (`@better-auth/utils@0.4.2` `dist/hex.mjs` builds from
  `"0123456789abcdef"`).
- Separator is a single `:`.

`package.json` in `@better-auth/utils` maps `./password` to `password.node.mjs` under both the
`node` and `workerd` conditions; the non-Node fallback (`@noble/hashes` scrypt) uses identical
parameters and produces an identical format, so the two are interchangeable.

Note `r=16` is unusual — the common scrypt default is `r=8`. Memory per hash is
`128 · N · r ≈ 32 MB`. Fine for one login; just don't be surprised by it, and don't assume a
generic scrypt tool's defaults will match.

### The agenix arrangement

Three secrets are needed at runtime. Recommended handling of each:

| Secret | How better-auth reads it | agenix arrangement |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | `secret` option, defaults to `BETTER_AUTH_SECRET` / `AUTH_SECRET` env | agenix file; load into env at boot |
| `DATABASE_URL` | your Drizzle client, not better-auth | agenix file; load into env at boot |
| The user's credential | never read at runtime — it lives hashed in `account.password` | agenix file, **seed-time only** |

The important structural point: **the user's password is not a runtime secret at all.** Once the
seed script has run, the only copy the app needs is the scrypt hash in Postgres. Nothing in the
running service ever reads the password file. That is a meaningfully better posture than a
credential sitting in the service environment for the process lifetime.

Given that, prefer to **store the pre-computed hash in agenix, not the plaintext**. The seed script
reads the hash file and passes it straight through. Benefits: the plaintext never exists on the
server even momentarily, and the file is safe to leave in place. You compute the hash on your own
machine with a three-line Node script using `hashPassword` from `better-auth/crypto` — see the
skeleton.

The trade-off is honest: passing a pre-computed hash means bypassing `auth.api.signUpEmail` and
writing the two rows yourself, which reintroduces the invariant-duplication objection from §4. So
there are two coherent positions:

- **Plaintext in agenix + `signUpEmail`** — simplest, fewest invariants duplicated, but the
  plaintext exists in a file on the box (which you can delete after seeding).
- **Hash in agenix + direct insert** — plaintext never touches the server, at the cost of ~15 lines
  that encode better-auth's account-row shape.

Both are given in the skeleton. For a single-user backstop behind Cloudflare Access, **plaintext +
`signUpEmail`, then remove the secret from the agenix config** is the lower-risk engineering choice;
the hash route is there if you would rather the plaintext never leave your laptop.

For sourcing env from files on NixOS, the systemd-native route is
`serviceConfig.EnvironmentFile = config.age.secrets.<name>.path` with the file containing
`KEY=value` lines — no application code required, and `$env/dynamic/private` then reads them at
runtime.

### Reading them in SvelteKit

Use `$env/dynamic/private`, not `$env/static/private`. Per the
[SvelteKit docs](https://svelte.dev/docs/kit/$env-dynamic-private), static values are *"determined
and embedded during build"* whereas dynamic ones are read from the runtime environment. Since the
NixOS build and the agenix secrets are decoupled, baking a secret into the build artefact would be
both wrong and a leak. `$env/dynamic/private` cannot be imported into client code, which is the
guarantee we want.

---

## 6. Session and cookie configuration

### How `Secure` is actually decided — the key finding

This is the part that the Cloudflare/nginx topology turns on. From `dist/cookies/index.mjs` in
`better-auth@1.6.27`:

```js
const secureCookiePrefix = (
  options.advanced?.useSecureCookies !== void 0 ? options.advanced?.useSecureCookies
  : dynamicProtocol === "https" ? true
  : dynamicProtocol === "http" ? false
  : baseURLString ? baseURLString.startsWith("https://")
  : isProduction
) ? SECURE_COOKIE_PREFIX : "";

function createCookie(cookieName, overrideAttributes = {}) {
  const prefix = options.advanced?.cookiePrefix || "better-auth";
  const name = options.advanced?.cookies?.[cookieName]?.name || `${prefix}.${cookieName}`;
  return {
    name: `${secureCookiePrefix}${name}`,
    attributes: {
      secure: !!secureCookiePrefix,
      sameSite: "lax",
      path: "/",
      httpOnly: true,
      ...
    }
  };
}
```

with `SECURE_COOKIE_PREFIX = "__Secure-"` (`dist/cookies/cookie-utils.mjs`).

The decisive detail: **the `Secure` flag is derived from the configured `baseURL` string, never from
the incoming request's protocol.** So the plain-HTTP loopback hop from nginx to node is irrelevant.
Setting `baseURL: "https://planner.greensroad.uk"` yields `secure: true` and the `__Secure-` prefix,
which is exactly right — the browser only ever speaks HTTPS to Cloudflare.

Consequence: the session cookie is named **`__Secure-better-auth.session_token`**, not
`better-auth.session_token`. Anything that reads the cookie by name (debugging, curl) must account
for the prefix.

Defaults, confirmed in the same source: `sameSite: "lax"`, `path: "/"`, `httpOnly: true`, and
`maxAge` on `session_token` = `session.expiresIn` (default 7 days). `sameSite: "lax"` is correct for
a same-origin form login; there is no reason to change it. The
[cookies docs](https://www.better-auth.com/docs/concepts/cookies) and
[security reference](https://www.better-auth.com/docs/reference/security) agree.

Setting `advanced.useSecureCookies: true` explicitly is harmless belt-and-braces and documents the
intent; it is what the first branch of that expression checks.

### `trustedOrigins` and CSRF

better-auth validates the `Origin` header against `trustedOrigins`, falling back to `Referer`
([security reference](https://www.better-auth.com/docs/reference/security)). `baseURL`'s own origin
is added automatically — from `getTrustedOrigins` in `dist/context/helpers.mjs`:

```js
const baseURL = getBaseURL(typeof options.baseURL === "string" ? options.baseURL : void 0, options.basePath, request);
if (baseURL) trustedOrigins.push(new URL(baseURL).origin);
```

So with `baseURL` set correctly, **`trustedOrigins` needs no entries at all** for production. Add
`http://localhost:5173` only if you want the dev origin trusted while `baseURL` points elsewhere;
normally dev sets `BETTER_AUTH_URL=http://localhost:5173` instead and the list stays empty.

Do **not** set `advanced.disableCSRFCheck`.

### `ORIGIN` for adapter-node

Two independent mechanisms must agree on the public origin:

1. **SvelteKit / adapter-node** needs it to build `event.url` and to pass the form-action origin
   check. The [adapter-node docs](https://svelte.dev/docs/kit/adapter-node) warn that if it *"can't
   correctly determine the URL of your deployment, you may experience this error when using form
   actions: Cross-site POST form submissions are forbidden"* — which is precisely how we log in.
2. **better-auth** needs `event.url.origin` to match `baseURL`, or `isAuthPath` returns false and
   the handler never mounts ([§2](#2-sveltekit-wiring)).

Set both to the same value:

```
ORIGIN=https://planner.greensroad.uk
BETTER_AUTH_URL=https://planner.greensroad.uk
```

The alternative — `PROTOCOL_HEADER=x-forwarded-proto` and `HOST_HEADER=x-forwarded-host` — also
works, and the docs note it is *"safer"* than a hardcoded ORIGIN in the general case, but only if
nginx overwrites those headers rather than passing client-supplied ones through. **For a
single-origin deployment, hardcoding `ORIGIN` is simpler and strictly harder to get wrong.** Prefer
it. (`ADDRESS_HEADER=CF-Connecting-IP` is separately worth setting if you want real client IPs in
`session.ipAddress`, with `XFF_DEPTH` adjusted for the tunnel + nginx hops.)

### Session lifetime

Defaults ([session docs](https://www.better-auth.com/docs/concepts/session-management)):
`expiresIn` 7 days, `updateAge` 1 day, `freshAge` 1 day. For a teaching planner used daily on
personal devices, behind Cloudflare Access already, a longer window is reasonable — 30 days with a
1-day refresh means re-login roughly monthly.

`session.cookieCache` stores session data in a signed cookie to skip a DB read per request
(`maxAge` default 300s, strategies `compact` / `jwt` / `jwe`). For one user against local Postgres
the DB read is free; enabling it adds a revocation-latency window for no benefit. **Leave it off.**

---

## 7. Deny-by-default route protection

### Hook-level guard, not per-route `load`

Per-route `load` guards are opt-in by construction: a new route is unprotected until someone
remembers. For an app where *every* page is private except login, that is the wrong default. Put
the guard in `handle`.

The thing that makes this cheap in SvelteKit: per the
[hooks docs](https://svelte.dev/docs/kit/hooks), requests for **static assets and prerendered pages
do not invoke `handle` at all** — only dynamic routes do. So a hook guard needs *no* exclusion list
for `/favicon.png`, `_app/immutable/*`, or anything else in `static/`. The allowlist is just
`/login`.

### Ordering

Compose with `sequence` from `@sveltejs/kit/hooks`:

```
sequence(handleAuth, handleGuard)
```

Inside `handleAuth`, `resolve` is bound to the next handler in the sequence. Because
`svelteKitHandler` returns `auth.handler(request)` directly for auth paths and only calls `resolve`
otherwise, **`/api/auth/*` bypasses the guard automatically** — the login POST reaches better-auth
without needing a session. This falls out of the source quoted in §2; it is not a coincidence to
rely on nervously.

`handleGuard` then sees only non-auth routes, with `event.locals.user` already populated.

### Layout data

The guard protects; a root `+layout.server.ts` returning `locals.user` is still worth having so
pages can render the user without re-fetching. That is a convenience, not a security boundary — the
boundary is the hook.

---

## Worked skeleton

Paths assume the SvelteKit convention of `src/lib/server/` for server-only modules.

### `src/lib/server/auth.ts`

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";

import { db } from "./db";
import * as authSchema from "./db/auth-schema";

/** Endpoints this app has no use for. Reached only if someone probes directly. */
const BLOCKED_PATHS = [
	"/sign-up/email",
	"/request-password-reset",
	"/reset-password",
	"/send-verification-email",
	"/verify-email",
	"/sign-in/social",
	"/link-social",
	"/unlink-account",
];

export const auth = betterAuth({
	appName: "planner",
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL, // https://planner.greensroad.uk

	database: drizzleAdapter(db, {
		provider: "pg",
		schema: authSchema,
		transaction: true,
	}),

	emailAndPassword: {
		enabled: true,
		disableSignUp: true, // route stays mounted but 400s; see BLOCKED_PATHS
		minPasswordLength: 12,
	},

	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // refresh at most daily
	},

	advanced: {
		useSecureCookies: true, // implied by the https baseURL; explicit for clarity
	},

	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (BLOCKED_PATHS.includes(ctx.path)) {
				throw new APIError("NOT_FOUND", { message: "Not found" });
			}
		}),
	},

	// Must be last.
	plugins: [sveltekitCookies(getRequestEvent)],
});
```

### `src/hooks.server.ts`

```ts
import { redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { auth } from "$lib/server/auth";

/** Routes reachable without a session. `handle` never runs for static assets. */
const PUBLIC_ROUTES = ["/login"];

const handleAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	// Short-circuits for /api/auth/*, so those bypass handleGuard entirely.
	return svelteKitHandler({ event, resolve, auth, building });
};

const handleGuard: Handle = async ({ event, resolve }) => {
	const isPublic = PUBLIC_ROUTES.some(
		(p) => event.url.pathname === p || event.url.pathname.startsWith(`${p}/`),
	);

	if (!isPublic && !event.locals.user) {
		const target = event.url.pathname + event.url.search;
		redirect(303, `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	if (isPublic && event.locals.user) {
		redirect(303, "/");
	}

	return resolve(event);
};

export const handle = sequence(handleAuth, handleGuard);
```

### `src/app.d.ts`

```ts
import type { auth } from "$lib/server/auth";

type Session = typeof auth.$Infer.Session;

declare global {
	namespace App {
		interface Locals {
			session: Session["session"] | null;
			user: Session["user"] | null;
		}
	}
}

export {};
```

### `src/lib/server/db/auth-schema.ts`

Generated — do not hand-edit. Regenerate on upgrade:

```
npx auth@1.6.27 generate --config src/lib/server/auth.ts --output src/lib/server/db/auth-schema.ts --yes
npx drizzle-kit generate
```

Content is the CLI output quoted in [§3](#3-tables-schema-generation-and-adr-0003). Ensure
`drizzle.config.ts`'s `schema` glob covers it, e.g. `schema: "./src/lib/server/db/*.ts"`.

### `scripts/seed-user.ts` — option A (plaintext in agenix, via better-auth)

```ts
/**
 * Creates the single user. Run once, after migrations:
 *   PLANNER_USER_EMAIL=... PLANNER_USER_PASSWORD="$(cat /run/agenix/planner-password)" \
 *     node --experimental-strip-types scripts/seed-user.ts
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "../src/lib/server/db";
import * as authSchema from "../src/lib/server/db/auth-schema";

const email = process.env.PLANNER_USER_EMAIL;
const password = process.env.PLANNER_USER_PASSWORD;
const name = process.env.PLANNER_USER_NAME ?? "Planner";

if (!email || !password) throw new Error("PLANNER_USER_EMAIL and PLANNER_USER_PASSWORD are required");

// A throwaway instance with sign-up ENABLED and no hooks. Never served.
const seedAuth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, { provider: "pg", schema: authSchema, transaction: true }),
	emailAndPassword: { enabled: true, disableSignUp: false, minPasswordLength: 12 },
});

const existing = await db.query.user.findFirst();
if (existing) {
	console.log(`User already exists (${existing.email}); nothing to do.`);
	process.exit(0);
}

await seedAuth.api.signUpEmail({ body: { email, password, name } });
console.log(`Created ${email}.`);
process.exit(0);
```

The existence check makes it idempotent and enforces the single-user invariant.

### `scripts/seed-user.ts` — option B (pre-computed hash in agenix)

Compute the hash on your own machine:

```ts
// scripts/hash-password.ts — run locally, never on the server
import { hashPassword } from "better-auth/crypto";
console.log(await hashPassword(process.argv[2]));
// -> "8f3c…(32 hex):4a1b…(128 hex)"
```

Then seed with a direct insert. Note `updated_at` must be set explicitly — the generated schema does
not default it on `session`/`account` (see §3):

```ts
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/server/db";
import { user, account } from "../src/lib/server/db/auth-schema";

const email = process.env.PLANNER_USER_EMAIL!;
const passwordHash = process.env.PLANNER_USER_PASSWORD_HASH!; // from agenix
const now = new Date();
const userId = randomUUID();

await db.transaction(async (tx) => {
	await tx.insert(user).values({
		id: userId,
		name: process.env.PLANNER_USER_NAME ?? "Planner",
		email,
		emailVerified: false,
		createdAt: now,
		updatedAt: now,
	});

	await tx.insert(account).values({
		id: randomUUID(),
		userId,
		providerId: "credential", // exactly this string
		accountId: userId,        // credential accounts use the user id
		password: passwordHash,
		createdAt: now,
		updatedAt: now,
	});
});
```

### `src/routes/login/+page.server.ts`

```ts
import { fail, redirect } from "@sveltejs/kit";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import type { Actions } from "./$types";

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const email = String(data.get("email") ?? "");
		const password = String(data.get("password") ?? "");

		try {
			// sveltekitCookies replays the Set-Cookie through event.cookies.
			await auth.api.signInEmail({
				body: { email, password },
				headers: event.request.headers,
			});
		} catch (e) {
			if (e instanceof APIError) return fail(400, { email, error: "Incorrect email or password." });
			throw e;
		}

		const target = event.url.searchParams.get("redirectTo");
		redirect(303, target?.startsWith("/") ? target : "/");
	},
};
```

The `target.startsWith("/")` check prevents an open redirect via `?redirectTo=https://evil.example`.

### Environment

```
ORIGIN=https://planner.greensroad.uk        # adapter-node: form-action origin check + event.url
BETTER_AUTH_URL=https://planner.greensroad.uk  # better-auth: isAuthPath, Secure cookies, trusted origin
BETTER_AUTH_SECRET=<agenix>
DATABASE_URL=<agenix>
```

`ORIGIN` and `BETTER_AUTH_URL` **must be identical** or auth silently 404s (§2).

---

## Open questions and gaps

Things this document does not settle, roughly in order of how likely they are to matter:

1. **Nothing here was run end-to-end.** The schema output in §3 is genuine CLI output and the source
   quotes are from the published 1.6.27 artefacts, but the assembled skeleton — hooks, form action,
   seed script — has not been executed against a live Postgres. Treat it as well-grounded, not
   tested. The first integration attempt is where `isAuthPath`/`ORIGIN` will bite if anything is
   mismatched.

2. **`node --experimental-strip-types` for the seed script is an assumption.** How TypeScript
   scripts are run in this repo isn't established yet (`tsx`? a build step? plain `.js`?). The seed
   script's shebang/runner needs deciding alongside the tooling choices in the project setup.

3. **Cloudflare Access + a second login may be redundant.** The ticket frames app-level auth as a
   deliberate backstop, and this document answers the question as asked. But Access can pass a
   verified identity via JWT, and the alternative design — trust the Access assertion, keep no
   password at all — has a real argument in its favour for a single-user tool. Out of scope here;
   worth a deliberate decision rather than defaulting into two factors by inertia.

4. **`advanced.database.generateId`.** The default is a base62 string, and the generated schema uses
   `text` primary keys. If the app's own tables settle on UUIDs, `generateId: "uuid"` would make the
   auth tables match. Cosmetic, but decide it before the first migration rather than after.

5. **Rate-limit storage across restarts.** In-memory limits reset when the service restarts. For one
   user behind Access this is a non-issue; noting it only so it isn't discovered as a surprise.

6. **1.7.0 is in RC.** Worth a look before committing, in case the SvelteKit integration or adapter
   packaging shifts again — the Drizzle adapter's move to a standalone package between minor
   versions suggests this surface is still moving. Pin the version either way.

7. **Session `ipAddress` behind the tunnel** will record the nginx/tunnel address unless
   `ADDRESS_HEADER` / `XFF_DEPTH` are configured to match the actual hop count. The correct
   `XFF_DEPTH` for a Cloudflare Tunnel → nginx → node chain was not verified.

---

## Sources

**better-auth documentation** (docs site tracks `latest`, read at 1.6.27):

- [SvelteKit integration](https://www.better-auth.com/docs/integrations/svelte-kit)
- [Installation](https://www.better-auth.com/docs/installation)
- [Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [Database / core schema](https://www.better-auth.com/docs/concepts/database)
- [CLI](https://www.better-auth.com/docs/concepts/cli)
- [Session management](https://www.better-auth.com/docs/concepts/session-management)
- [Cookies](https://www.better-auth.com/docs/concepts/cookies)
- [Hooks](https://www.better-auth.com/docs/concepts/hooks)
- [Email & password](https://www.better-auth.com/docs/authentication/email-password)
- [Users & accounts](https://www.better-auth.com/docs/concepts/users-accounts)
- [Options reference](https://www.better-auth.com/docs/reference/options)
- [Security reference](https://www.better-auth.com/docs/reference/security)

**better-auth source**, pinned to tag `v1.6.27` =
[`be47e9418b4a25a4ecd51ba781d2296373b65a03`](https://github.com/better-auth/better-auth/tree/be47e9418b4a25a4ecd51ba781d2296373b65a03):

- [`packages/better-auth/src/integrations/svelte-kit.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/better-auth/src/integrations/svelte-kit.ts)
  — `svelteKitHandler`, `isAuthPath`, `sveltekitCookies`
- [`packages/better-auth/src/api/routes/sign-up.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/better-auth/src/api/routes/sign-up.ts)
  — `disableSignUp` guard, `providerId: "credential"` account creation
- [`packages/better-auth/src/api/routes/update-user.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/better-auth/src/api/routes/update-user.ts)
  — `deleteUser` / `changeEmail` opt-in guards
- [`packages/better-auth/src/crypto/password.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/better-auth/src/crypto/password.ts)
  — re-export of `@better-auth/utils/password`
- [`packages/drizzle-adapter/src/drizzle-adapter.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/drizzle-adapter/src/drizzle-adapter.ts)
  — `DrizzleAdapterConfig`
- [`packages/cli/src/generators/drizzle.ts`](https://github.com/better-auth/better-auth/blob/be47e9418b4a25a4ecd51ba781d2296373b65a03/packages/cli/src/generators/drizzle.ts)
  — schema generation, default output path, type mapping

**Published npm artefacts inspected directly** (claims not visible in the GitHub tree):

- `better-auth@1.6.27` — `dist/cookies/index.mjs` (`createCookieGetter`, secure-cookie derivation),
  `dist/cookies/cookie-utils.mjs` (`SECURE_COOKIE_PREFIX`), `dist/context/helpers.mjs`
  (`getTrustedOrigins`), `dist/types/auth.d.mts` (`$Infer`), `dist/api/routes/*.mjs` (endpoint path
  inventory)
- `@better-auth/drizzle-adapter@1.6.27` — `dist/index.d.mts`, `dist/index.mjs` (absence of DDL)
- `@better-auth/utils@0.4.2` — `dist/password.node.mjs`, `dist/password.mjs`, `dist/hex.mjs`
  (scrypt parameters and hash format)

**SvelteKit documentation:**

- [`adapter-node`](https://svelte.dev/docs/kit/adapter-node) — `ORIGIN`, `PROTOCOL_HEADER`,
  `HOST_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH`
- [Hooks](https://svelte.dev/docs/kit/hooks) — `handle`, `event.locals`, `sequence`, static-asset
  behaviour
- [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) — runtime vs build-time
  env
