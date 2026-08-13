# Database migrations from the first commit

Migration tooling is set up before any real schema exists, and every schema change ships as a
generated migration. During the build phase the development database may be wiped freely and the
migration history squashed. **From the first time real data is entered, migration history is
append-only and is never squashed again.**

## Why

The obvious alternative for a three-week MVP is to skip migrations while the model churns, then add
them before the tool goes into real use. That plan has a single point of failure: the "add
migrations now" step lands in the last week before term, competing with finishing the app, and it
is exactly the task that gets dropped. The failure mode is silent — you are teaching from the tool,
Session notes are accumulating, and there is no migration history at all.

It also proved to be a false choice. Having migrations does not prevent wiping the development
database, and with schema-diff tooling a migration is a generated file rather than hand-written
work. The safety net is close to free.

## Consequences

The cutover is a property of the data, not a date: the moment real Term dates and Courses are
entered, the rule changes. That transition must be deliberate and noted, because nothing in the
tooling enforces it.

Courses and Lessons remain importable from plain text regardless. Plan data is retypeable and
therefore cheap to reconstruct; Session notes are not, and they are what this decision protects.
