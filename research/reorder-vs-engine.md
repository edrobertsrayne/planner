# How do the engine and Rewind treat a reordered Lesson stream?

Issue #368, under map #366. Question: if the flattened Lesson list for one Class changes order,
what happens to taught Sessions, noted Sessions, Continuations, Placements and Readiness? Where is
the boundary rule applied, and what do `atRisk` and `placementsMoved` say?

Sources: `src/lib/server/planner/engine.ts`, `derive.ts`, `ordering.ts`, `authoring.ts`
(`moveLesson`), ADR-0007, ADR-0010, ADR-0022, `GLOSSARY.md`. Line numbers are at HEAD `9df28f6`.
Cases were run on a throwaway vitest file (real fixtures, `bunx --bun vitest`), deleted after. Things
I only read, not ran, are marked **[INFERENCE]**.

## Short answer

The engine takes one flat `LessonInput[]` per Class and cares about nothing but its order
(`engine.ts:156-169`). The only place that list is built is `loadLessonStream` (`derive.ts:101-110`).
So a per-Class `class_lesson` table swaps in at that one function and the engine does not change.

**At the ordinary boundary (today) a reorder is safe for the past.** A taught Session's position in
the list is irrelevant. History is counted per Lesson id, not by position
(`engine.ts:296-297`, `remainingParts` at `engine.ts:165`).

**The danger is a later Rewind.** Nothing records when or how the order changed. A Rewind re-lays
past Sessions from the *current* order, and tells the teacher only about noted ones. Reorder makes
this far more likely than today.

There is already a reorder in the code: `moveLesson` (`authoring.ts:669-684`) swaps two Lessons'
positions and calls `rederiveTopic(db, topicId, today)` (`derive.ts:282-291`). It re-derives every
assigned Class from boundary = today. Per-Class order is the same operation, narrower in scope.

## Where the boundary rule is applied

| Step | Where | What it does |
|---|---|---|
| Choose the boundary | `rewindBoundary`, `derive.ts:181` | Disruptions use `min(date, today)`. Every other write (`moveLesson`, `assignTopic`, `recordContinuation`, timetable) passes `today`. |
| Split history | `schedule`, `engine.ts:292-294` | `history` = this Class's Sessions with `date < boundary`. They are inputs, never rewritten. |
| Count what is taught | `engine.ts:296-297` | `delivered[lessonId]` = number of history Sessions for that Lesson. |
| Drop taught parts | `remainingParts`, `engine.ts:163-167` | A Lesson contributes only parts `delivered+1 .. need`. A fully taught Lesson contributes nothing, wherever it sits in the list. |
| Lay out | `engine.ts:299-315` | Placements first, then the owed parts onto the remaining Available Slots from the boundary. |
| Persist | `rederive`, `derive.ts:196-276` | Only rows with `date >= boundary` are loaded (`derive.ts:197-201`) and may change. |
| Report | `derive.ts:267-274` | `atRisk` = touched rows that carry a note. `placementsMoved` from `describePlacementsMoved` (`derive.ts:415-477`). |

Note that "taught" means `date < today`. A Session dated *today* is still re-derivable. It is not
yet history.

`rewind()` (`engine.ts:335-346`) splits affected Sessions into `atRisk` (noted) and `discarded`
(un-noted). `rederive` keeps only `atRisk` and ignores `discarded` (`derive.ts:270`). So an un-noted
Session that is relabelled is never reported anywhere.

## Cases

Fixture: one Class (9B/Sc1), one Topic of 8 Lessons, 6 Slots a fortnight, materialised from
2026-09-03. Initial plan: L1,L2 on 3 Sep; L3 8 Sep; L4 11 Sep; L5 14 Sep; L6 16 Sep; L7,L8 17 Sep.
"today" is given per case. A "reorder" is a change of `lesson.position`, then
`rederive(db, classId, today)`, which is what `class_lesson` positions would feed.

### Case 1. Move a future Lesson before taught ones (L8 to the front), today = 14 Sep

Safe for the past, noisy for the future.

- Sessions before today are untouched (L1-L4 stay). Reason: `rederive` loads only `date >= boundary`
  (`derive.ts:200`); `delivered` is by id so L8 (not taught) just heads the owed list.
- Result from today: L8 14 Sep, L5 16 Sep, L6 17 Sep P5, L7 17 Sep P6.
- A note on 16 Sep (written against L6) is reported: `atRisk` = one entry, `date 2026-09-16`,
  `lessonTitle: "Lesson 6"`, `placementsMoved: []`. The note stays on the occasion
  (`derive.ts:213-218` only updates `lessonId`).
- Caveat: the report names the Lesson that *was* there (the pre-relabel row, `derive.ts:208`/`398-404`),
  not the Lesson that is there now (L5). The teacher cannot tell from the report what replaced it.
- Caveat: today's Session (14 Sep, L5 to L8) changed too, because `date >= today` is writable. If
  today's lesson is already in progress, only a note makes it appear in `atRisk`.

### Case 2. Move a taught Lesson to the future (L1 to the end), today = 14 Sep

Safe. Nothing changes.

- Past Sessions untouched. L1 is `delivered = 1`, need = 1, so it contributes zero parts wherever it
  sits (`engine.ts:165`). The future plan is exactly L5-L8 as before. `atRisk = []`.
- Consequence for the model, not a bug: the Class's list says L1 is last, but it never appears
  there. The per-Class list can hold a taught Lesson in the future with no Session. A view that
  reads list order and Sessions will disagree unless it treats "delivered" as done. Progress and
  Planning code that walks the list needs checking (a question for the consumers ticket).
- Same applies to moving a *taught* Lesson earlier or later among other taught Lessons.

### Case 3. Move a Lesson that carries a Continuation (L3, Continuation recorded on its 8 Sep Session), today = 14 Sep

Wrong shape of Sessions, though by an existing rule.

- A Continuation widens a Lesson by one Slot: `demandFor` = `length + continuations for (lesson, class)`
  (`engine.ts:151-153`). It is keyed by Lesson and Class, not by position. Part 1 is history; part 2
  is owed wherever L3 sits in the list.
- Before the move: part 2 of L3 at 14 Sep P3 (the first Slot at/after today, since 11 Sep was
  already taught as L4).
- After moving L3 to the end: L3 part 2 lands on 22 Sep P2, nine school days from part 1, behind L8.
  Everything else shifts up one. `atRisk = []`.
- This is not new with reorder. A late Continuation already splits a Lesson (L3 part 2 landed after
  L4 above, before any move). But a reorder lets the teacher move the second half of a Lesson away
  from the first with no warning.
- Same for a part-taught Length-2 Lesson (run: L3 length 2, part 1 on 8 Sep, today = 9 Sep, moved to
  end: part 2 lands on 17 Sep after L6; `atRisk = []`). Taught part 1 and owed part 2 are separated.
- Continuation rows hang on past Sessions only (`recordContinuation` refuses `date >= today`,
  `sessions.ts:168`), so a today-boundary reorder never deletes one. A Rewind does (Case 6).

### Case 4. Placement anchored near the move

Safe, and the report is honest. Run: Placement "Assembly" anchored 28 Sep P3, reorder L8 to before
L7 and L5, today = 14 Sep.

- The Placement does not move: Assembly stays on 28 Sep P3. `placementsMoved: []`, `atRisk: []`.
- Why: `layPlacements` runs first against the raw Available Slot stream (`engine.ts:299-309`,
  `201-270`). It never sees the Topic stream. Topic Lessons are laid on whatever Slots the
  Placements left (`engine.ts:311-315`). So no reorder can change where a Placement lands.
  ADR-0022 says the same: a Placement "consumes the Slot it takes".
- Where a reorder puts a Topic Lesson on a Placement's anchor Slot, the Topic Lesson shifts past it,
  as designed.
- The comment at `derive.ts:278-281` says a Placement "can shift sideways when the Topic-Lesson
  stream in front of it changes shape". That is false in the code. The stream does not touch the
  Placement. The only things that move a Placement are Slot Availability changes: Blocked Day, Blocked
  Slot, another Placement's claim (`engine.ts:215-247`). The comment is stale. (Fix when `derive.ts`
  is next touched.)
- Placed Lessons are Standalone (no Topic), so they will not be in `class_lesson`. No id clash is
  possible with the owed-parts stream.

### Case 5. Reorder across a Blocked Day

Safe. Run: Blocked Day 28 Sep, then reverse the tail (L8,L7,L6,L5 from L5,L6,L7,L8), today = 14 Sep.

- A Blocked Day is Slot Availability, a separate input (`engine.ts:117-146`). The zip is
  Lessons x Available Slots, so the order of Lessons and the blocking commute. Result: L8 14 Sep,
  L7 16 Sep, L6 17 Sep P5, L5 17 Sep P6. `atRisk = placementsMoved = []`.
- No row falls off the plan, so the "dropped out because blocked" delete path
  (`derive.ts:253-264`) is not reached by a reorder.
- Blocked Slots behave the same, per Class.

### Case 6. Reorder, then a Rewind over the reordered span (the unsafe one)

Run: reorder L8 to the front today (14 Sep). Past Sessions stay (verified). Then Blocked Day on
10 Sep, which is before today, so `rewindBoundary` returns 10 Sep (`derive.ts:181`, `blockDay` at
`disruptions.ts:63`, all Classes via `rederiveAllClasses`).

- History is now `date < 10 Sep`: L1, L2, L3 only. L4 (taught on 11 Sep) is no longer history.
- The new order is applied to the past: 11 Sep P4 changes from L4 to **L8**. L4 is pushed to 14 Sep.
  The record now says L8 was taught on 11 Sep. It was not.
- Report: `atRisk: []`, `placementsMoved: []`. The only note was on 8 Sep, before the boundary. The
  relabelled 11 Sep Session had no note, so it is `discarded`, which `rederive` drops (`derive.ts:270`).
  Nothing tells the teacher the past changed, and the disruption (10 Sep) is not the cause.
- The same applies to any Rewind, even one with no effect on this Class: a Blocked Day for 10 Sep
  re-derives every Class (`derive.ts:306-315`), each from its own current order.
- A noted Session in the Rewind span would be in `atRisk`, but the report names the old Lesson
  and blames the Rewind, not the reorder.
- **[INFERENCE]** Continuations recorded against relabelled past Sessions are deleted silently
  (`derive.ts:216`, `255`) when the Rewind relabels those rows. I did not run this. It follows from
  `relabel`, which deletes the Continuation row whenever the Lesson on the occasion changes.
- This is the same hazard `moveLesson` and "add a Lesson to a half-taught Topic" already carry
  (ADR-0010: "editing content moves dates"). It is not new. But content edits are rare, and a
  per-Class reorder is a day-to-day tool.

### Case 7 (supporting). Readiness

Safe. **[INFERENCE]** from reading, not run. Readiness is keyed `(lessonId, classId)`. No code in
`derive.ts` or `engine.ts` reads or writes the `readiness` table; the Agenda looks it up by
`lessonId|classId` (`views.ts:163-180`). So the tick follows the Lesson to its new date. It is not
cleared by a reorder. ADR-0022 and the glossary say "nothing derived ever disturbs it". Moving a
Ready Lesson later keeps it Ready, which is correct; the teacher may want it shown but nothing breaks.

## Verdict

| Reorder | Engine handles it? |
|---|---|
| Future Lesson to before taught Lessons | Safe. Past untouched. Future shifts (Case 1). |
| Taught Lesson to the future / among taught | Safe. The Lesson never reappears; list and Sessions disagree (Case 2). |
| Reorder around a Placement | Safe, `placementsMoved` empty and correct (Case 4). |
| Reorder across Blocked Day / Slot | Safe (Case 5). |
| Reorder with noted future Sessions | Reported, but `atRisk` names the old Lesson only (Case 1). |
| Reorder of a Lesson with a Continuation or part-taught parts | Wrong shape: the Lesson's owed part is separated from its taught part, with no report (Case 3). |
| Any later Rewind over the reordered span | **Wrong Sessions.** Past Sessions relabelled to the current order, un-noted ones with no report (Case 6). |
| Rewind report generally | `placementsMoved` is reliable. `atRisk` covers noted Sessions only and shows the old Lesson (`derive.ts:398-404`). `discarded` is not surfaced. |

## What the Rewind report cannot say

- It cannot say *why* a Session changed (disruption or reorder). The order is not versioned.
- It does not list un-noted relabelled Sessions at all.
- It does not mention Continuations deleted on relabel.
- `placementsMoved` is silent for any reorder because none can move a Placement. That is correct.

## For the design

- The `class_lesson` read goes in `loadLessonStream` (`derive.ts:101-110`) only. Engine, `ordering.ts`
  helpers (`swapTargets`, `nextPosition`, `ordering.ts:7-24`) and `rederive` stand.
- A reorder write should call `rederive(db, classId, today)`: never `rewindBoundary`. A reorder is
  not a disruption; it must not rewrite past Sessions. Re-derive one Class, not `rederiveTopic`.
- The past stays correct only while no Rewind crosses it. Options for the map, none decided here:
  accept it as ADR-0010 does for content edits; surface `discarded` (un-noted relabelled Sessions) in
  the Rewind report; or refuse or warn when a Rewind would cross a span whose order changed
  (requires storing a changed-at date).
- Taught Lessons moved into the future (Case 2) and part-taught Lessons (Case 3) need a rule in the
  list UI: either lock taught Lessons in place, or let them move knowing they will not reappear.
