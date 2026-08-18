# Password reset is a CLI operation, not a route

There is no "forgot password" link, and there never will be. This is a refusal, not an omission.

The single user (ADR-0001) is created once, by a first-run wizard at `/setup`, which the request
guard forces every route to when the `user` table is empty. Recovery is the same path, reached by
emptying the table again:

```
DATABASE_URL=local.db node scripts/reset-credentials.ts
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

Two simultaneous submissions of the wizard are resolved by the `user.email` UNIQUE constraint
rather than by a lock; the loser is redirected to `/login`.

`/login` is not rate limited. better-auth's limiter only covers `/api/auth/*`, and login here is a
form action calling `signInEmail` server-side, so it never passes through. Accepted while the app
is reached over a private network or behind a proxy that throttles; if it is ever exposed directly
to the internet, `/login` is an unthrottled password oracle and needs a per-IP throttle first.

Whether a user exists is queried on every request rather than cached, so that deleting the row on a
running server brings the wizard back without a restart.
