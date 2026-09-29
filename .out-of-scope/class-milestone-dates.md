# Class milestone dates

A Class does not hold named fixed dates (a mock, an assessment, a data drop), and the Classes
screen does not show which Lesson the schedule reaches by each one.

## Why this is out of scope

The derived schedule already answers the question. To see what a Class will teach on 12 December,
open that week in the Calendar. The schedule is derived from its inputs (ADR-0007), so Shift-right
and Rewind are already shown there.

A Milestone would add a new stored record on the Class, a new domain term in `CONTEXT.md`, an
editor on the Class page and a new section on each Classes tile. All of that saves one Calendar
look-up a few times a year. `AGENTS.md` says a rule that costs a query or a lookup must earn it,
and this one does not.

Runway stays as the one date a Class carries: the date its plan runs out.

## Prior requests

- #266: "feat: Class milestone dates — see which Lesson lands on a fixed date"
