# Session history in the Lesson editor

The Lesson editor does not show past Session notes for the Lesson it edits.

## Why this is out of scope

The Lesson editor edits the **shared plan**. A Lesson is shared by every Class that teaches it. A
Session is one Class's occasion on one date, and its note belongs to that occasion (ADR-0002:
Lessons are shared, Sessions are per Class). The two are kept apart on purpose. You write the plan
once in the Lesson editor, and you write how one lesson went in the Session panel.

If each Class's history is listed inside the shared editor, that line is lost. The editor would
become a place to read per-Class records, and it would raise questions the model does not answer
now: which Classes, in what order, and what a note on a split or continued Session means there.

The case the request has in mind is "how did it go the last time I taught it". That is usually an
earlier school year, and the planner holds only one year (`AGENTS.md`). Within the year, a note is
still one click away: open the Session in the Session panel.

## Prior requests

- #263: "feat: show past Session notes in the Lesson editor"
