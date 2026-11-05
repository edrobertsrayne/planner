# ADR-0030: An Absence is a block, and its Cover is a Lesson

**Status:** Accepted (2026-11-05)

## Context

The glossary said a Blocked Day's cause is not recorded, "because nothing in the planner behaves
differently according to it". That stopped being true. When the teacher is absent the Class is
still in school and needs work set, so the teacher must be able to tell an Absence from an INSET
day or snow, and may want to record what was set.

## Decision

- **An Absence is a Blocked Day or Blocked Slot with `absent` set.** Nothing else changes: the
  engine's inputs are the same rows and Shift-right is unchanged (ADR-0007). The displaced Lesson
  moves right whether or not anything is recorded. `absent` is a fact about the block, so it is a
  column on `blocked_day` and `blocked_slot`, not a table.
- **Cover is a Standalone Lesson attached to an occasion.** `cover { class_id, date, slot_id,
  lesson_id }`, unique on `(class_id, date, slot_id)`, shaped like a Placement but not one. A
  Placement takes an Available Slot and is an engine input; an absent Slot is not Available, and a
  Cover must not shift anything. So `cover` is read only by views, never by the engine.
- **Cover is written in the Lesson editor.** It is new (a Standalone Lesson created on the spot) or
  an existing Lesson, so a standard task can serve several Classes. No second authoring surface.
- **Optional, and never a warning.** The marker says "Absent". An Absence with no Cover shows a Set
  cover button and no alert colour.
- **It ends with the Absence.** Unblocking the day or Slot deletes its Cover rows; the Lesson
  stays, as it does when a Placement is removed. Deleting a Lesson a Cover names is refused, as for
  a Placement.
- **Planning leaves Cover Lessons out.** They are not planned teaching.

## Consequences

- Marking a block absent is decided when it is made. Changing a closure into an Absence is
  Unblock then Block.
- A Cover may be recorded for a past date: Rewind exists for disruptions entered after the fact, and
  the teacher may want to log what was set.
