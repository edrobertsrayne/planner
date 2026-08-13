# SQLite over Postgres

The database is SQLite, in one file, driven through Drizzle over Node's built-in `node:sqlite`.
ADR-0004 originally named Postgres, on the reasoning that thor already runs a Postgres server so the
marginal cost of using it was near zero. That is true of the _server_ and false of everything else:
it also meant a database role, peer authentication, a unit ordered against `postgresql-setup.service`
and a connection string. None of it buys anything this application needs.

## Why

Nothing in the model wants Postgres. The scheduling engine is a pure in-memory function over Lessons
and Available Slots (ADR-0007), so the database is a store and nothing more — no arrays, no `jsonb`,
no full-text search, no concurrent writers, and, because a Period is a position in the day rather
than a time of day, no timestamps to get wrong.

The decisive argument is restore, not weight. This tool has to be trusted from the first week of
term with Session notes, which ADR-0003 identifies as the one thing here that cannot be retyped.
"Restore is copying one file back" is a materially different risk posture from "restore is a
`pg_dump` schedule you set up in August and never tested."

The deployable artifact is a flake or a container (issue #11) and the deployment itself is out of
scope for this repository, so the runtime pins its own Node. `node:sqlite` has been available
unflagged since Node 23.4 and therefore needs no native build in the derivation, which
`better-sqlite3` would have.

## Consequences

**SQLite does not enforce foreign keys unless asked.** `foreign_keys` defaults to OFF, and this
schema is almost entirely references — Topic to Course, Lesson to Topic, Slot to Class, Session to
Lesson. Every connection sets `foreign_keys=ON`, `journal_mode=WAL` and a `busy_timeout`. Losing
those pragmas does not fail loudly; it silently permits orphans.

**The application migrates itself.** There is no `postgresql-setup.service` any more, so nothing
else creates or migrates the file. Migrations run at startup before the server accepts a request,
and a failed migration refuses to start rather than serving a half-built schema. This does not
disturb ADR-0003, which governs whether history is append-only, not when it is applied.

**Dates are stored as ISO `YYYY-MM-DD` text.** SQLite has no date type. Text sorts and compares
correctly, stays legible in a database browser, and carries no timezone hazard, because the domain
has no clock times at all.

**Durability belongs to whoever deploys the artifact, not to the application.** The database is a
file at a configured path; the application ships no backup feature and makes no assumption that its
state directory survives a reboot. On an impermanence host such as thor that means an explicit
persistence entry — a `/persist` line that Postgres previously provided for free through its shared
aspect module, and whose absence would silently discard the database on the next boot.
