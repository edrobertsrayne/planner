# ADR-0020: The Week letter is computed, never stored

**Status:** Accepted (2026-08-27)

**Issue:** [#161](https://github.com/edrobertsrayne/planner/issues/161)

**Supersedes:** [ADR-0005](0005-teaching-weeks-carry-the-cycle.md)

## Context

ADR-0005 made the Week letter a stored row: the generator ran once when the academic year was set
up, produced a row per Teaching Week carrying its letter, and the stored letter was thereafter the
truth and could be edited.

Two things fell with that decision once the calendar became editable, in the app and over the HTTP
API (spec #158).

First, the stored letter is a second copy of a fact the Term dates already carry, and the two can
disagree. Editing a Term date does not re-letter the year, by design — so the planner can schedule
teaching under a letter the school's own published calendar contradicts, and nothing warns the
teacher. The generator is deterministic; keeping its answer in the database just means it can go
stale.

Second, the only way to produce the rows was the checked-in seed script, which rebuilds the
calendar tables from scratch and refuses to run once any Session exists. The teacher cannot set a
year up from the app, an agent cannot do it at all, and the whole setup path exists only as
repository tooling and a Docker entrypoint branch.

The generator itself was never wrong — its alternation rule (the first Teaching Week of the year is
Week A, a week entirely inside a break takes no turn in the cycle) is verified against the real
calendar and survives untouched. What fell is the storage argument: ADR-0005 bought "a row to edit"
for the school's one-off "we'll stay on Week A next week" swap, and that one-off is a thing the
model is better off being unable to express.

## Decision

The Week letter is a pure function of the six Term dates. The `teaching_week` table is dropped and
nothing reads a Teaching Week row, because there are no rows to read.

One accessor computes the year's Teaching Weeks from the Terms and Blocked Days. The calendar
snapshot the scheduling engine is fed, the ordered list the Calendar screen's week ribbon steps
through, and the single-week lookup the Calendar grid does all read through it, so the three can
never disagree. The engine below the snapshot is unchanged — it already receives Teaching Weeks as
data.

A Term is named by its position in the year — six Terms in date order are always Autumn 1, Autumn
2, Spring 1, Spring 2, Summer 1, Summer 2 — so the generator takes no name and no stored name can
contradict where a Term sits. The `term.name` column is dropped with the table.

Setting a year up is entering the six Terms, which the setup surface on the Calendar screen and
`PUT /api/terms` do; seeding — the seed script, the checked-in seed file, the `seed` package
script, the Dockerfile bundling, and the `SEED_ON_START` / `SEED_FILE` entrypoint branch — is
removed.

## Consequences

A stored letter can no longer drift from the Term dates, and no change can re-letter the year
without the Terms saying so. The school's one-off letter swap is inexpressible — the cost ADR-0005
accepted as the price of a row to edit, now paid knowingly.

An academic year with no Terms in it produces no Teaching Weeks at all. That is the first-run
empty state, and the Calendar screen opens setup mode on it.

The letters are recomputed on read rather than read from a row. The computation is a handful of
date comparisons across six Terms and a handful of Blocked Days — cheaper than the query it
replaces, and never more than the one accessor deep.
