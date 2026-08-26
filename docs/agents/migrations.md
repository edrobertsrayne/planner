# Database migrations

Facts about what this project's SQLite can do, so a migration is not designed around a limit that
does not apply. Verified against the SQLite that Bun bundles — **3.53.2** at the time of writing.
Re-check after a Bun upgrade; several of these are recent additions.

The database runs with `PRAGMA foreign_keys = ON` (`src/lib/server/db/index.ts`). This changes what
some statements are allowed to do, so it is part of every fact below.

## Verify, do not remember

SQLite's `ALTER TABLE` gained abilities in recent versions, and most written guidance predates them.
Before you design a migration around "SQLite cannot do X", prove it with a throwaway script:

```ts
import { Database } from 'bun:sqlite';
const d = new Database(':memory:');
d.run('PRAGMA foreign_keys = ON');
// build the tables, insert rows, then try the statement
```

An in-memory database costs nothing and settles the question in seconds. Several of the facts below
contradict what the older documentation says.

## What ALTER TABLE can do

**Add a column with a `CHECK` constraint.** This works on a table that already holds rows and that
other tables reference. SQLite adds the column, writes the default into every existing row, leaves
the inbound foreign keys intact, and enforces the constraint from that moment. **No table rebuild.**

```sql
ALTER TABLE lesson ADD COLUMN status TEXT NOT NULL DEFAULT 'bare'
  CHECK (status in ('bare','drafted'));
```

**Change a `CHECK` constraint later.** `ALTER TABLE ... DROP CONSTRAINT <name>` and
`ALTER TABLE ... ADD CONSTRAINT <name> CHECK (...)` both work. This needs the constraint to be
**named**, so always name them — Drizzle's `check('name', ...)` does.

## What ALTER TABLE cannot do

**Add a column with `REFERENCES` and a non-NULL default**, while foreign keys are on. SQLite
rejects it: `Cannot add a REFERENCES column with non-NULL default value`. Either add the column
nullable, or turn foreign keys off for the statement and back on afterwards.

## Drizzle

**`text('col', { enum: [...] })` enforces nothing in the database.** It is a TypeScript type only,
and the generated column is a plain `TEXT`. A guard the database keeps needs `check()` as well.

**Read the SQL that `drizzle-kit` generates before committing it.** Its strategy for SQLite
constraint changes is to rebuild the table — create, copy, drop, rename. That is rarely necessary
given the facts above, and a rebuild of a table that other tables reference is worth avoiding.
Replace a generated rebuild with the plain `ALTER TABLE` where one does the job.

## Hand-edited migrations are normal here

A generated migration may be edited, and one-off backfills are written by hand into the same file.
See `drizzle/20260823000000_class_tone/` for the pattern: the `ALTER TABLE`, then the backfill
`UPDATE`, with a comment saying what the backfill mirrors in the application code.
