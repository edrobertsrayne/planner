# A Class holds one Class note, and Links and Attachments of its own

What the teacher knows about a Class as a whole — the room it is in, how it works best in groups,
what is due this term, where its shared folder lives — had nowhere to go. A Teaching note belongs to
one Lesson with one Class, a Lesson's notes are shared by every Class that teaches it, and an Event
note belongs to one Event on one date. A Class now holds one **Class note**, plus Links and
Attachments, shown on a new Overview tab that opens by default on the Class page.

## Decision

- **One Class note per Class, in markdown.** Written in the same WYSIWYG editor as a Lesson's
  notes and a Teaching note (ADR-0023), read back through the same renderer, and saved the same way.
  It is a single entry, not a list of dated notes: the teacher keeps it current rather than
  appending to it. Stored as markdown text in `class.note`, nullable, since one note per Class needs
  no table of its own.
- **Links and Attachments have one owner: a Lesson or a Class.** `link` and `attachment` gain a
  nullable `class_id`, `lesson_id` becomes nullable, and a check holds exactly one of the two. One
  table each means one file store, one download route, one Backup path (ADR-0024), one upload check
  and one pair of row components for both owners. The rules in the glossary — an Attachment is never
  edited in place, it downloads under its own name — hold for a Class's as for a Lesson's.
- **They die with their Class.** Deleting a Class deletes its Class note, Links and Attachments,
  Attachment files included. A Class is scoped to one academic year, so next year's Classes start
  with none; nothing is carried forward.
- **The Class page has three tabs: Overview, Schedule, Timetable.** Overview is new and the default:
  the Class note on the left, Links then Attachments in a column on the right, laid out like the
  Lesson editor. Schedule is the tab that was called Overview, holding the Sequence, unchanged. The
  open tab is page state, not part of the URL, so the rename breaks no link.
- **On a phone, Overview and Schedule are read-only.** The Class note shows rendered, Links open and
  Attachments download; the Sequence reads as before. Timetable stays tablet-up only.

## Why

The Class page is already the single surface for one Class, so the Class's own material belongs
there and not on a new screen. Putting it first means the page opens on what the teacher wrote about
the Class rather than on the Sequence, which they reach in one tap. A single markdown entry matches
how notes already work everywhere else in the planner; a list of timestamped notes would be a log,
which nothing here asks for.

## Considered

- **Separate `class_link` and `class_attachment` tables.** Simpler constraints, but every path that
  serves, backs up, restores or deletes an Attachment would gain a second branch.
- **The note, Links and Attachments as a section under the Sequence**, or as a side rail beside it.
  Both crowd the Sequence, which already fills its tab, and neither scales past a few items.

## Consequences

- ADR-0001 still holds: the Class note describes the group, never a named pupil, as an Event note
  does. Nothing in the editor enforces this; it is the teacher's rule, stated where the note is
  written.
- The migration rebuilds `link` and `attachment`, since SQLite cannot relax a `NOT NULL` in place.
- The glossary's Class, Attachment and Class page entries change, and Class note is a new term.
