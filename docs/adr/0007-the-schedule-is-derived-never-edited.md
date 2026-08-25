# The schedule is derived, never edited

Laying a Class's plan onto its calendar is one pure function: take the Lessons in order, take the
Available Slots in order, zip them together. There are no move, shift or insert operations. Every
disruption is a change to the function's _input_, and the schedule is recomputed from scratch:

- a **Blocked Day** removes every Slot on a date,
- a **Blocked Slot** removes one Slot on one date for one Class,
- a **Continuation** widens a Lesson from one Slot to two.

> **Amended 2026-08-14 (ADR-0010).** The input was originally "a Course's Lessons". It is now the
> Lessons of the Class's **Assigned Topics**, flattened in Assigned-Topic order and then Lesson
> order. The function itself is untouched — the prototype always took a flat Lesson array and a
> Class id, never a Course. One consequence is worth naming: the boundary rule below is now
> load-bearing for **everyday use**, not only for disruptions, because assigning October's Topic in
> October is an ordinary re-run that must not disturb what is already taught. Editing content moves
> dates for the same reason — adding a Lesson to a half-taught Topic grows the flattened list in the
> middle and shifts the rest of the year right, deliberately and without warning.

The function takes a **boundary** and writes on and after it, never before. The boundary is today.
Sessions dated before it are the record of what happened — inputs to the next run, not outputs.

There is exactly one operation that is not a re-run: a **Rewind**, which moves the boundary back so
that already-recorded Sessions are re-derived. It exists only because a disruption can be entered
after the fact.

## Why

The alternative is a set of mutation operations — push this lesson back, swap these two, insert a
gap. Each one is a separate code path, a separate screen, and a separate way for the schedule to end
up in a state no rule explains.

More decisively, mutations do not survive. The plan is _derived_ from the stream of Available Slots,
so a manual "push everything back one" is undone by the next recompute — the Slot it moved past is
still available. Blocking that Slot is not a prerequisite for the shift; it **is** the shift, in its
only durable form. This is why Blocked Slot earns its place: without it the commonest single-Class
disruption — a trip, a cover lesson, an assembly — has no representation at all, and Blocked Day
cannot serve because it blocks every Class.

Prototyped against the real 2026/27 calendar before committing to it (issue #4). The engine is about
forty lines and survived a Blocked Day mid-sequence, a single-Class trip, a Continuation across the
October half-term, two Continuations in a row, and a Course longer than the year.

The boundary is today rather than an explicit "mark as taught" tick. Explicit confirmation was tried
first and is wrong: one skipped tick strands the earlier unconfirmed Lessons and re-plans them
_after_ Lessons that were confirmed later, silently reordering the Course. Nothing about a teacher's
week suggests the ticks would be kept up.

## Consequences

Entering a past Blocked Day without rewinding leaves the record asserting that a Lesson was taught
on a day the Class was not taught. Nothing detects this. Entering a disruption in the past must
therefore rewind to that date, not merely re-plan forward.

A Rewind relabels Sessions, and a Session may carry notes on how the teaching went. Notes belong to
the dated occasion — Class, date, Period — not to the Lesson, so they are never lost; but a Session
whose Lesson changed is reported to the teacher rather than silently relabelled. This is the one
place the model touches something it cannot derive.

Running out of Available Slots is a reportable outcome, not an error. The function places what fits
and returns the rest as unplaced. Silently dropping Lessons would make the tool untrustworthy.

> **Amended 2026-08-14 (issue #19).** The function returns the _mirror_ case too. Where `unplaced`
> is the Lessons with no Slot, `unplanned` is the **Unplanned Slots** — the Available Slots with no
> Lesson, in date order, to the end of the seeded calendar. Both fall out of the same zip; only one
> was previously returned.
>
> This matters more than the symmetry suggests. Under ADR-0010 a Class is given its Topics one at a
> time through the year, so having Slots left over is the _normal_ condition and running out of
> Lessons is the rare one. Returning `unplanned` keeps that normal case inside the one derived
> answer: the Agenda, the Calendar and the Classes lanes all read it rather than each re-deriving
> which of a Class's Slots are Available and past the end. Three re-derivations of Slot availability
> is the drift this ADR exists to prevent, arriving through the views instead of through mutation.
>
> The **Runway** — the date of a Class's first Unplanned Slot — is therefore derived, not stored,
> like everything else about the schedule.

> **Amended 2026-08-25 (issue #108).** **Unplanned Slot** is renamed **Open Slot**. Nothing about
> this decision changes: the mirror case, the returned field and the derived Runway all stand
> exactly as written above. Only the word moves, because #108 gave the Lesson a planning status
> called **Planned** and one word cannot mean both "this Lesson is approved to teach from" and
> "this Slot carries no Lesson". `CONTEXT.md` is the source of truth for the term; the prose above
> keeps the old word because that is what this decision was written in. The returned field is still
> named `unplanned` in `src/lib/server/planner/engine.ts`, and renaming it is implementation work
> left to the Planning board spec (#107).

Nothing may write a Session dated before today except a Rewind.
