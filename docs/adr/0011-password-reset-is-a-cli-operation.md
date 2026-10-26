# Password reset is a CLI operation, not a route

There is no "forgot password" link, and there never will be. This is a refusal, not an omission.

The single user (ADR-0001) is created once, by a first-run wizard at `/setup`, which the request
guard forces every route to when the `user` table is empty. Recovery is the same path, reached by
emptying the table again, in the container the app runs in:

```
bun run reset:credentials
```

From a checkout, point the script at the database:

```
DATABASE_URL=local.db bun scripts/reset-credentials.ts
```

That deletes the user row. `account` and `auth_session` cascade; nothing else in the schema
references `user`, so every Course, Class, Session and calendar row survives. The next request
finds no user, the wizard runs, and new credentials are set.

Signed in, a password is changed at `/settings`, which requires the current password and revokes
every other session.

## Why

The person who is locked out is the person who owns the box. Every scenario that needs a reset is
one where you already have a shell and the database file — so the recovery path may as well live
there, where it needs no route, no token, and no endpoint to attack.

The alternatives both add a permanent door to avoid using the one you already have. Emailed reset
links need SMTP credentials, a verification-token flow, and an email-delivery failure mode, in an
app whose only user owns the server. A recovery code shown once at setup is a second credential,
stored in the same password manager as the first, whose hash is a second way in forever.

Deleting the row, rather than setting a new password from the script, is what keeps the two paths
from drifting. A script that sets a password needs its own better-auth instance to hash
compatibly — and a duplicated auth config is exactly what went stale before: the previous
`scripts/seed-user.ts` carried a comment claiming the production instance had sign-up disabled, at
a time when it did not. One creation path, exercised by both first run and recovery, cannot rot
unnoticed.

Sign-up is now closed at the endpoint (`emailAndPassword.disableSignUp`), because
`svelteKitHandler` short-circuits `/api/auth/*` before `hooks.server.ts` sees it — application code
cannot guard that route. The wizard therefore creates its user through better-auth's internal
adapter, having checked in the same request that none exists.

## Consequences

Losing the password without access to the server means losing access entirely. That is the
intended shape: access to the planner is access to the machine.

Two simultaneous submissions of the wizard share one in-flight creation, the same guard
`/setup/restore` uses for its own check-and-write: the second waits for the first and is
redirected to `/login`. The `user.email` UNIQUE constraint is not what resolves this — two
submissions with different emails would both insert and leave a second working login. If writing
the credential fails after the user row exists, the row is deleted again, so a half-made user
cannot lock the wizard behind an account that nobody can sign in to.

`/login` is not rate limited. better-auth's limiter only covers `/api/auth/*`, and login here is a
form action calling `signInEmail` server-side, so it never passes through. Accepted while the app
is reached over a private network or behind a proxy that throttles; if it is ever exposed directly
to the internet, `/login` is an unthrottled password oracle and needs a per-IP throttle first.

While no user exists, `/setup` and `/setup/restore` are open to anyone who reaches them, and a
redirect to `/setup` tells a visitor that the instance is empty. The window is short: from the first
deploy to the end of the wizard, and from `reset:credentials` to the next wizard. Accepted rather
than gated by a one-time code (#404), which would be a second credential to read from the server
for a door that stays open only for minutes. Restore is refused once planner data exists, so after
a reset the exposure is the wizard alone: whoever finishes it first owns the data. Run
`reset:credentials` only when ready to complete the wizard straight away.

Whether a user exists is queried on every request rather than cached, so that deleting the row on a
running server brings the wizard back without a restart.
