# A Lesson is scheduled directly by a Placement

ADR-0015 opened `lesson.topic_id` to null, calling the result a **Standalone Lesson**, but left it
unreachable: `loadLessonStream` (`derive.ts`) walks `assignedTopic → topic → lesson`, and a null
`topic_id` cannot join. ADR-0015 named the gap and declined to close it: "Scheduling one needs a
second route into a Class's stream, direct from Class to Lesson, bypassing Topic... That feature is
deliberately out of scope."

This is that route. A teacher may now put one Standalone Lesson onto one Class's schedule, on one
date they choose, with no Topic behind it.

## Decision

**Place** the act; **Placement** the record it makes. A Placement is a new table, shaped like a
Blocked Slot rather than like a Session:

```
placement { class_id, date, slot_id, lesson_id }   unique (class_id, date, slot_id)
```

It is a **change to the engine's input**, not a write to the schedule's output. The engine
(`engine.ts`) gains a fourth input, `placements`, alongside `blockedSlots`, `lessons` and
`continuations`:

- `availableSlots` drops a placed Slot from the stream exactly as it already drops a Blocked Slot —
  a Placement's Slot is unavailable to the Class's ordinary, Topic-driven sequence.
- Each Placement emits its own `ScheduledSession` entries directly, merged into the zip alongside
  the parts `layOut` lays from `remainingParts`. A Length-N Placement takes the first N Available
  Slots for that Class at-or-after its stored `(date, slot_id)`, the same walk `layOut` performs for
  a Course Lesson's parts — no same-day constraint, so a run may cross a day boundary or a weekend
  exactly as an ordinary Lesson's parts do.

`session` is untouched: an occasion is still identified by Class, date and Period (ADR-0002), and
`rederive` still writes `session.lesson_id` for it, exactly as it does for a Topic Lesson's part.
Shift-right, removal, Rewind survival and re-run stability all fall out of the existing zip, with no
new operation, no mutation of the schedule's output, and no exception inside `rederive`.

### The stored Slot is an anchor, not a reservation

A Placement's `(date, slot_id)` is where it was told to go, not where it is guaranteed to land. The
derivation takes the first Available Slot **at or after** the anchor: if that Slot later stops being
Available — a Blocked Day, a Blocked Slot placed on it, or a second Placement's run already
claiming it — the Placement shift-rights to the next Available Slot for that Class, the same rule
every other input in this system obeys, and the move is reported to the teacher unconditionally
(see Consequences). Only the anchor's own Slot going unavailable moves the Placement's start; a
later Slot inside a multi-Period run going unavailable shift-rights just that later part, same as an
ordinary Lesson. Two Placements meeting resolve in ascending anchor order — earliest chosen Slot
first — each run computed against the stream after every earlier-anchored Placement's Slots are
already removed; a later Placement whose anchor is already claimed shifts right past it rather than
being refused, consistent with every other collision in this system.

Length always comes from the Lesson; `placement` carries no length column of its own. A
Continuation is permitted on a placed Session and widens that Placement's run by one Slot, mirroring
what a Continuation already does to a Topic Lesson's parts.

### No mark on the Lesson — the Placement record is the whole difference

ADR-0015 predicted that "a retired Lesson and a one-off Lesson will be indistinguishable by
`topic_id` alone, and it may need a mark to tell them apart." **No mark is added.** Whether a
Standalone Lesson is schedulable is entirely a fact about whether a `placement` row names it — the
Lesson row itself carries no column, and none is added, matching the standing rule that the planner
stores facts, not intent. A Standalone Lesson no Placement names is simply a retired one; the same
Lesson is schedulable the moment a Placement is made against it.

One consequence follows directly: **Detach is one-way.** A Standalone Lesson never rejoins a Topic
— the API path that would re-file one (`PATCH /api/lessons/:id` with a non-null `topicId`) is
retired, because no screen offers it and keeping it open would let a Lesson a Placement names
silently regain a Topic mid-Placement. A Topic Lesson reaches a Class through its Assigned Topics,
in the Course's order; a Standalone Lesson reaches a Class only through a Placement, on a date the
teacher chose. The two kinds of Lesson do not interoperate.

`deleteLesson` gains a sibling refusal to its existing "taught" one: refused while any `placement`
row names the Lesson, same 409 shape ("Remove the Placement first"). This is required for the
"no mark" answer to hold — without it, deleting a placed-but-untaught Standalone Lesson would leave
a Placement naming a Lesson that no longer exists.

## Considered options

Three mechanisms were built and run against a real 2026/27 calendar in
[Prototype the second route into a Class's Lesson stream](https://github.com/edrobertsrayne/planner/issues/225) (`prototype/placement-mechanism`), the central
question every other ticket on the map hung off:

**B — a per-Class assigned-Lesson record**, dated but otherwise unattached to the Slot stream. The
Lesson stream is positional; the record is dated, and a date cannot name a Period. On a day with two
Periods for one Class, a dated record cannot say which is meant — it landed on the wrong Period of a
Thursday double, and it moved to the wrong day entirely when a Blocked Day fell inside its run.
Worse, once a Class's Assigned Topics have already run out, the chosen date is a stream position
past the end of the parts list, so the Placement fell to the end of the queue instead of the date
asked for (asked for 15 Oct, landed 22 Sep). Every fix converges on storing the Slot and removing it
from the stream — which is mechanism A.

**C — an authoritative Session row**, written directly rather than derived. This is an edit to the
schedule's _output_, which ADR-0007 rejects outright: the zip still lays a Topic Lesson onto the
same occasion, the derivation must refuse to overwrite the held row, and nothing shifts to make
room, so that Topic Lesson is silently **skipped** — 7 of 8 Lessons left in the plan in the
prototype's run, and a delivery record reading out of Course order. Because its run is frozen at
write time, a later Blocked Day left a Session sitting on a day the Class was not taught; and a
Rewind **discarded** it outright, because it lived in the very table a Rewind clears. The note
precedent at `derive.ts:229-236` — a Session row `rederive` refuses to drop because it carries a
note — does not stretch to cover this: a note rides on an occasion the derivation chose, while this
mechanism claims the occasion itself.

**A — the Placed Slot (chosen)**. A change to the engine's input, shaped like a Blocked Slot.
Survived every case mechanism B and C failed: a Blocked Day inside the run, a Rewind, placement past
the end of the plan, re-running twice with no input change, and `delivered`/`demandFor`'s
bookkeeping. Committed to as the Decision above, with the refinement — reached only after building
and re-testing against the prototype — that the stored Slot is an anchor a Placement can move off
of, rather than a hard reservation.

## Consequences

**ADR-0007 is amended, not superseded.** Its list of engine inputs —

> - a Blocked Day removes every Slot on a date,
> - a Blocked Slot removes one Slot on one date for one Class,
> - a Continuation widens a Lesson from one Slot to two.

gains a fourth line: **a Placement removes one Slot for one Class, and lays one Lesson-part
directly onto it (or its shift-right destination) outside the Class's Assigned-Topic sequence.**
The function itself is still one pure zip from input to output, still re-run in full from any
state, still bound by the same boundary rule; nothing about _how_ ADR-0007 works changes, only what
counts as an input to it. This is the same shape of amendment ADR-0010 made to it before.

**Three joins ADR-0015 already made left joins stay exactly as they are.** `lessonNames`,
`sessionDetail` and `planningStream` already tolerate a null Topic; no further widening is needed
for a placed Lesson's title or its (absent) Topic name to resolve correctly. What changes is
upstream of them: `loadLessonStream`'s Topic-only walk is joined by a second load — the Class's
`placement` rows — feeding the engine's new `placements` input, so the Lessons those joins already
know how to print now includes ones the schedule reaches by Placement rather than by Assigned
Topic.

**Planning needs no schedule-derivation change.** `planningStream` already selects every Lesson
unconditionally and computes its occurrence purely from `scheduleFor(...).scheduled`; once the
`placements` input lands, a placed Lesson's occurrence falls out of the existing loop. Two real
gaps remain, both fixed in the spec: a `Standalone Lesson` label on the row in place of a Topic
name, and its title routing to the Session panel (`openSession(occurrence)`) instead of the Lesson
editor, which requires a Course and Topic that a Standalone Lesson does not have.

**Readiness dies with a removed Placement**, mirroring the rule `unassignTopic` already enforces:
Placement-removal severs the `(lessonId, classId)` pairing Readiness is keyed on. Guarded against
the one case the map's Notes allow but do not design for — the same Lesson placed twice on one
Class, on two dates — by deleting the `readiness` row only when no other Placement still names that
pair.

**Removal mirrors `unblockSlot` exactly.** Delete the `placement` row, then
`rederive(classId, rewindBoundary(placement.date, today))`. No refusal on a past-dated Placement:
there is no such guard anywhere else in the system, and Rewind exists precisely to let a disruption
be entered after the fact. The Lesson row survives, becoming a Standalone Lesson no Placement names
— the ordinary "retired" state this ADR's Decision already covers, needing no second, hidden delete
rule.

**A Rewind treats a Placement like every other input, with one addition to its report.** The
note-gated `atRisk` channel (ADR-0007's own consequence) is not sufficient here: a placed Session
carries no note by default, so relying on the note gate would silently break the promise that a
forced move is always reported. A Placement's move across a Rewind is instead detected by checking
a touched Session row against the `placement` table (by `classId` + `lessonId`, matched against its
stored anchor) and reported unconditionally, independent of whether the row carries a note. A
Placement dated before a Rewind's boundary is ordinary history, exactly like a taught Topic Lesson's
Session — not pinned, and live input again the moment the boundary moves back before it.

**Editing a Standalone Lesson's Length re-derives sideways.** `updateLesson` currently no-ops a
Length change for a Lesson with no Topic. Because a Standalone Lesson may be named by Placements on
more than one Class, a Length edit must instead look up every distinct `class_id` holding a
`placement` naming that `lesson_id` and `rederive` each — the same shape as `rederiveTopic`, keyed
on the `placement` table instead of `assignedTopic`.

**The attach door stays closed.** `moveLessonToTopic`/the PATCH path that gives a Lesson a Topic is
retired for a Lesson that currently has none, closing the loophole that would let a placed Lesson
silently regain a Topic. Moving a Lesson _between_ two Topics is untouched — that door was never
about a Standalone Lesson.

**No cascade rule for deleting a Class.** There is no `deleteClass` anywhere in the codebase today —
no API route, no function, and neither `slot` nor `assignedTopic` carry an `onDelete: cascade` on
`classId` for it to match. Deciding a Placement cascade now would be designing against a feature
that does not exist; it is recorded in the map's "Not yet specified" for whenever a real
`deleteClass` ticket is opened.

**Two new surfaces, one already-existing one repurposed.** The Calendar day menu gains a
`Place a Lesson` group, one line per Available Slot, handing off to the Session panel rather than
opening its own popover — the Session panel becomes the one door in the app that asks for a title.
The Calendar tile keeps its Class's Tone and gains a dashed inner ring plus a `Standalone Lesson`
line where the Topic name normally sits. Full shape in
[The two doors: Calendar day menu and Session panel](https://github.com/edrobertsrayne/planner/issues/228); implementation detail lives in the spec, not here.

## `CONTEXT.md`

**Standalone Lesson**, amended: the "is never Scheduled" clause is deleted, since it stops being
true the moment this decision ships.

**Placement**, added, in Scheduling after **Session**: names the act (**Place**) and the record
(**Placement**), states it is anchored, and that removing one leaves the Lesson standing as a
Standalone Lesson. No entry is added for the Lesson itself — nothing about a placed Lesson's shape
differs from any other Lesson (title, body, Links, Length, Draft/Planned, per-Class Readiness), so
naming a new kind of Lesson would assert a difference the model doesn't have.

Full wording and the reasoning behind each rejected alternative (`Insertion`, `pinned Session`,
`reservation`, a `Placed` state beside Draft/Planned) is in
[Name the direct placement of a Lesson outside a Topic](https://github.com/edrobertsrayne/planner/issues/224).
