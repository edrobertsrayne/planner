# Each Class holds its own Sequence

A Class no longer records Topics. It holds a **Sequence**: its own ordered list of the shared
Lessons it teaches, stored as `class_lesson(class_id, lesson_id, position)`, unique on
`(class_id, lesson_id)`. The engine lays the Sequence onto the Class's Available Slots. The teacher
can reorder one Class's Sequence without changing any other Class. Lessons stay shared (ADR-0002):
only the order is per Class.

Decided on the map [Order each Class's Lessons without changing other
Classes](https://github.com/edrobertsrayne/planner/issues/366). Each point below links the ticket
that holds its detail.

## Decision

- **A Topic is a label and a source, not a unit of order.** **Assign Topic** appends the Topic's
  Lessons, as they are at that time and in Topic Lesson order, to the end of the Sequence. It skips
  each Lesson that is already in the Sequence or Placed on that Class. A Lesson added to a Topic
  later reaches no Class until the teacher assigns the Topic again. `assigned_topic` is dropped.
  ([#369](https://github.com/edrobertsrayne/planner/issues/369),
  [#370](https://github.com/edrobertsrayne/planner/issues/370))
- **A Lesson is in a Sequence once at most**, and never both in a Class's Sequence and Placed on
  that Class. Taught parts, Continuations, Readiness and notes are keyed by (Class, Lesson), so a
  second copy would share them. ([#369](https://github.com/edrobertsrayne/planner/issues/369))
- **Edits to the shared plan change no Sequence.** Creating a Lesson, moving it in its Topic, and
  filing it (giving it a Topic, moving it to another Topic, Detach) change no Sequence and re-derive
  nothing. A Length edit re-derives each Class that holds the Lesson. Deleting a Lesson that a
  Sequence holds asks first. Deleting a Topic keeps its Lessons as Standalone Lessons.
  ([#370](https://github.com/edrobertsrayne/planner/issues/370),
  [#376](https://github.com/edrobertsrayne/planner/issues/376))
- **The taught part is locked.** A Lesson with a Session on or before today cannot move or be
  removed, and nothing moves in front of it. A reorder re-derives one Class from today and never
  rewinds. So a later Rewind lays the past again in the order it was taught.
  ([#371](https://github.com/edrobertsrayne/planner/issues/371))
- **A note belongs to the Sequence entry**, not to the occasion: one **Teaching note** per (Class,
  Lesson), in `lesson_note`, shared by every part and every Placement of that Lesson on that Class.
  It follows its Lesson through a reorder or a Rewind, and it dies with the pairing, like Readiness.
  The Rewind report loses `atRisk`. ([#371](https://github.com/edrobertsrayne/planner/issues/371))
- **Standalone Lessons may be in a Sequence.** Add Lesson on a Class's Sequence makes a new
  Standalone Lesson in that Sequence. ([#370](https://github.com/edrobertsrayne/planner/issues/370),
  [#379](https://github.com/edrobertsrayne/planner/issues/379))
- **The cutover resets the plan.** The migration empties Sessions, Continuations, Placements,
  Readiness and Assigned Topics, drops `assigned_topic` and `session.note`, and creates empty
  Sequences. Content and the calendar stay.
  ([#373](https://github.com/edrobertsrayne/planner/issues/373))

## Considered options

**Copy a Topic's Lessons into each Class.** Each Class could then change content too. Rejected:
the teacher needs only a different order, and copies drift (ADR-0002).

**Keep Assigned Topics and add a per-Class order beside them.** Rejected: two records of what a
Class teaches go out of step on every create, filing change and delete. The consumer inventory
([#367](https://github.com/edrobertsrayne/planner/issues/367)) named this as the largest risk.

**Keep new Topic Lessons live in every Class that holds the Topic.** Rejected: once Topics
interleave, a new Lesson has no clear place in a Class's Sequence.

**Seed each Sequence from the Assigned Topics.** It works, but it costs about 30 lines of SQL and
a test with four edge cases, to keep data the teacher does not need.

## Consequences

The engine does not change. `loadLessonStream` reads the Sequence in place of
`assigned_topic → topic → lesson`, and every screen follows.

The Rewind report is `placementsMoved` only. A noted Session can no longer lose its note, because
the note moves with its Lesson.

The Classes tile and the Class page lose the progress bar. A Sequence can hold Standalone Lessons
and interleaved Topics, so "progress through the Topics" has no meaning. An overrun ("N Lessons
past the end of the year") is the one alert on the tile.
([#375](https://github.com/edrobertsrayne/planner/issues/375))

A Backup taken before this change restores with no plan, no taught record and no notes, because
Restore runs the reset migration on it.
