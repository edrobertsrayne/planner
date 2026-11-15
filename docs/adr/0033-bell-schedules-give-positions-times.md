# ADR-0033: Bell Schedules give the day's positions clock times

**Status:** Accepted (2026-11-15)

## Context

The teacher keeps duties at break and lunch. The planner has no positions there: a day is Before
school, P1 to P6 and After school, and none of them carries a time (ADR-0008, ADR-0029). A duty has
nowhere to sit.

The school runs a split day. Years 9 and 10 follow one set of clock times, Years 11 to 13 another.
The Periods shift between the two, and lunch falls at a different point in each. Break is at the
same time in both. Which times a Period has therefore depends on which Class is taught in it.

## Decision

A **Bell Schedule** is a named set of clock times for the day. The teacher sets them up in the
Calendar's year setup, and none is hard-coded.

- **One or more.** A school without a split has one Bell Schedule; this school has two. Exactly
  one is the **default**.
- **Eight timed positions.** Each Bell Schedule gives a start and end time to P1 to P6, **Break**
  and **Lunch**. Where Break and Lunch fall is read from their times, never stored as "after P2".
  Before school and After school stay untimed.
- **A Class follows one.** Each Class names its Bell Schedule. Creating the first Bell Schedule
  gives it to every Class. A Bell Schedule a Class follows cannot be deleted unless it is the last
  one, which leaves every Class with none, as before the first was made.
- **Everything else follows the default.** An Event in a Period, and a Period with nothing in it,
  shows the default Bell Schedule's times.
- **Break and Lunch are Event positions.** Like Before school and After school, only an Event
  holds them, never a Class. An Event Slot at Break or Lunch names the Bell Schedule whose Break or
  Lunch it is, because two Lunches at different times are different commitments.
- **Duty is an Event kind.** It is a label and changes nothing, like the other kinds.
- **The times change nothing in the schedule.** A Bell Schedule is read only by the views. Editing
  one moves no Lesson and needs no Rewind. It is one current set: editing it changes every day,
  past days included.

The views order a day's rows by the default Bell Schedule's times, and put each Break and Lunch
row at its own start time. A Break or Lunch with the same times in every Bell Schedule is one row.
The Agenda and the Event page show the times: each Session the times of its Class's Bell Schedule.
The Calendar shows only the order, so the week reads at a glance. With no Bell Schedule set up, the
views are exactly as before: six Periods, no times, no Break or Lunch.

## Why

Times belong to a Bell Schedule, not to a Period, because the same Period has different times for
different Classes. Hanging them off the Class instead would repeat one school's clock times on
every Class.

A Class picks its Bell Schedule rather than having it inferred from a year group or its label. The
planner records no year group, and a label is the teacher's free text.

Break and Lunch are positions for Events only, which keeps ADR-0029 whole: an Event never
displaces a Lesson, and nothing about a Bell Schedule enters the schedule function (ADR-0007).

## Consequences

ADR-0008's "the domain has no clock times at all" no longer holds. The times are wall-clock
`HH:MM` strings with no date and no zone, so the timezone hazard it guarded against does not
arise.

Backup and Restore must carry Bell Schedules and each Class's choice of one.
