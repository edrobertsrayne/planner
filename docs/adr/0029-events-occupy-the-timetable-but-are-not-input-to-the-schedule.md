# ADR-0029: Events occupy the Timetable but are not input to the schedule

**Status:** Accepted (2026-11-03)

## Context

The teacher has fixed commitments that are not lessons: a department meeting, a club, an
intervention group, a duty. They recur on the same two-week cycle as the Timetable, and they take
time that could otherwise go to planning. The planner shows only lessons, so a Period or an hour
before school that is in fact taken looks free.

ADR-0007 treats every disruption as a change to the input of the schedule function, so the obvious
design is a fifth input: an Event removes a Slot, and the Class's plan shifts right. That design was
drawn first and rejected.

## Decision

An **Event** is a recurring occupant of the Timetable that never displaces a Lesson.

- **It is not an input.** An Event may hold only a position that no Class holds, so it removes no
  Available Slot and the derivation in ADR-0007 is unchanged. Nothing about an Event moves a Lesson.
- **It cannot clash.** Position uniqueness (ADR-0006) covers Class Slots and **Event Slots**
  together. An Event cannot take a position a Class holds, and a Class cannot take one an Event
  holds. Each is refused at the point of entry, naming the holder.
- **It recurs.** There is no one-off Event. An Event Slot is a Week, a Day and a position, and it
  holds between dates exactly as a Slot does.
- **Two new positions.** Alongside the six Periods, a day has **Before school** and **After
  school**. Only Events hold them. They carry no time of day, so the planner still never needs the
  clock.
- **It is skipped, not blocked.** An Event does not occur on a School Holiday or a Blocked Day. Both
  are already derived or stored, so skipping adds no state. A Blocked Slot belongs to one Class and
  does not touch an Event.
- **It has a kind.** Meeting, Club, Intervention or Other. The kind is a label and changes nothing.
- **One note per date.** An **Event note** is kept for each Event and date, to plan the date
  beforehand or log it afterwards. It is one field. It follows the Event and the date, not a Lesson.
- **It outlives the year.** An Event is not scoped to an academic year, as a Class is. Its Event
  Slots hold between dates, so a series carries on until the teacher ends it, and rollover has
  nothing to carry forward.
- **It is its own entity.** An Event is not a Class with no Course. It has no Sequence, no Tone, no
  Readiness and no Lessons.

## Why

A shifted plan is the wrong answer to "I am in a meeting then". A Lesson that moved because of a
meeting would hide a clash the teacher should have seen when the meeting was made. Refusing the
clash puts the decision where it can still be taken.

Keeping Events out of the schedule function leaves it as it is. A fifth input would need its own
rule for an Event added or ended in the past, and the boundary rule in ADR-0007 would then have to
cover something that is not a Lesson.

The Class page already expresses "this position is taken" by showing who holds it. An Event reuses
that control, so the teacher meets nothing new in how a position is chosen.

Sharing the Class entity was considered, because a club or an intervention group resembles a Class
with no Course. It is deferred. The two would share only the Timetable grid, and the grid can be
shared later without changing what is stored.

## Consequences

Event Slots need a table of their own, and window-aware uniqueness is checked across both tables in
application code, as ADR-0006 already requires of Slots.

A new year's Timetable, or a Class's edit, can be refused because an Event holds the position. The
refusal names the Event, and the teacher moves or ends the Event first.

The Event note is the second kind of text the teacher writes about teaching, after the Teaching
note. ADR-0001 applies in full: an Event note describes the group, not a named pupil. This needs
saying where the note is written, because an intervention group is the place a pupil's name is most
likely to be typed.

A Blocked Day hides an Event's date from the Agenda and the Calendar. A note already written for
that date is kept and reappears if the day is unblocked.

Backup and Restore must carry Events, Event Slots and Event notes.
