# Course content lives in the database, not in files

Courses, Topics and Lessons are rows in SQLite, edited in the application. Markdown files in a git
repository — read live, or projected into the database by a re-import — were the alternative, and
were rejected.

> **Amended 2026-08-14.** This decision originally kept plain text as a one-way bulk import format
> for entering a Course (issue #9). That importer has been dropped: there is no ready-to-import
> source document to paste from, because Course content does not exist ahead of time — it is built
> up through the year, roughly a half-term at a sitting. An import format would have meant typing
> Lessons into a textarea instead of into a form, which is strictly worse. The editing screens are
> the only path content takes into the system. See issue #9.

## Why

The case for files was strong and specific: lesson plans would gain version history, they would be
editable in the author's own editor, and plan data would be trivially reconstructable, which is the
insurance ADR-0003 asks for.

What defeated it is **reconcile**. The schedule is derived from Lesson order (ADR-0007), and that
derivation has already produced dated Sessions carrying notes on how the teaching actually went.
If Lesson identity is position in a file, inserting a Lesson at the top of a Topic in November
silently re-derives the rest of the year. Making files authoritative therefore requires stable
Lesson identifiers living in the files, plus a defined answer for what a re-import does to the
existing record — a week of work, in a three-week budget, whose failure mode is quiet.

Two lesser reasons point the same way. The database is a single file (ADR-0008), so a git repository
of markdown would be a _second_ store with a second durability story, on a host where durability is
already someone else's responsibility. And the resources themselves live in OneDrive, a work system
the application cannot reach — so a Lesson was always going to link out rather than contain, which
removes much of what files were for.

## Consequences

Version history for lesson plans is given up. It was the one thing files uniquely offered, and
nothing here replaces it.

The application must provide editing screens for Courses, Topics and Lessons. Under the files model
those would not have existed, and that saving is real; it is spent buying the absence of a reconcile
path.

Plan data remains cheap to reconstruct by retyping, so ADR-0003's reasoning is undisturbed: what
that decision protects is Session notes, which were never going to live in files.
