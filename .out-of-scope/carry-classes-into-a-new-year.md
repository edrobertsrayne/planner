# Carry Classes into a new academic year

The planner has no control that copies last year's Classes, with their Course and Assigned Topics,
into a new academic year.

## Why this is out of scope

The planner is built for one user and **one school year** (`AGENTS.md`: do not add generality for
a second year). The domain model agrees:

- `GLOSSARY.md` scopes a **Class** to one academic year: "next year's teaching is new Classes, not
  these ones carried forward".
- ADR-0010 fixes a Class's Course at creation because "a Class never outlives its academic year".

A "Start next year" flow would need a second-year concept throughout the app. The planner would
need a way to choose which of last year's Classes to carry over. It would need rules for which
parts of a Class to copy (Course, Assigned Topic order, Tone, perhaps Slots) and which to leave
(Sessions, Readiness, the Timetable). It would need a way to archive or remove the old Classes, and
a new-year path through the Terms editor. All of that code runs once a year.

The manual path costs little. Creating a Class and assigning its Topics takes a few minutes for
each Class, once each July. Courses, Topics, Lessons, Tags, Links and Attachments already stay from
one year to the next, because they are not scoped to a year.

## Related

`docs/backlog.md` (2026-08-27) holds a different idea: a destructive end-of-year rollover that
clears the calendar and every Session. This decision does not cover it.

## Prior requests

- #264: "feat: Start next year — clone Classes into a new academic year"
