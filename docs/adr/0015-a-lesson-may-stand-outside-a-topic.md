# A Lesson may stand outside a Topic

`deleteLesson` refuses outright once any Class has been taught the Lesson: the Session rows
reference it, and dropping it would erase part of the record of what happened. That is a correct
instinct badly served. It leaves a mistaken Lesson — a bad Import, a Lesson written into the wrong
Topic — permanently welded into the plan the moment one Class reaches it, with no way out but
rewriting it in place under a title it never had.

ADR-0002 says a Session is identified by its occasion — Class, date and Period — not by its
Lesson, and a Rewind already relabels which Lesson an occasion carried. So the record does not
depend on the Lesson row staying where it is. It depends only on the Lesson row still existing to
be named.

## Decision

`lesson.topic_id` becomes nullable. A Lesson with no Topic is a **Standalone Lesson**, and the
operation producing one is **Detach**.

A Standalone Lesson keeps its title, body, Links and Length. It leaves every Class's Lesson stream
by construction, because `loadLessonStream` reaches a Lesson only through `assignedTopic → topic →
lesson`; a null `topic_id` cannot join, so no query change makes it stop being Scheduled. Every
Session that already taught it still resolves its title, which is the whole point.

Deleting a Lesson keeps its existing rule unchanged: permitted when no Class has been taught it,
refused when one has. Detaching is the separate operation, and it is allowed either way. One rule
each, neither aware of the other.

## Considered options

**Keep the refusal.** Cheapest, and defensible on the grounds that a Lesson already taught is
history rather than an Import mistake. Rejected because editing in place is not an escape hatch: it
leaves the taught Session pointing at a Lesson whose title now describes something else, which
mislabels the record instead of preserving it.

**Null the Session's `lessonId`, then delete the Lesson.** Also cheap — `session.lesson_id` is
already nullable. Rejected because a Session carrying no Lesson already means something else: an
Open Slot, a Period with nothing left to teach. A taught occasion degraded into one states that
nothing was taught, which is a worse falsehood than a wrong title.

## Consequences

**Three inner joins become left joins**, and `topicName` becomes nullable at each: `lessonNames`
(`derive.ts`), feeding the Agenda, the Calendar grid, the Class lanes and the at-risk report;
`sessionDetail` (`sessions.ts`), feeding the Session panel; and `planningStream` (`views.ts`),
feeding the Planning tab. The first two are load-bearing — left unrepaired they drop a Standalone
Lesson's title from exactly the history this decision exists to preserve, reproducing the failure
of the rejected option. Where a Topic name would print, nothing prints: a Standalone Lesson has no
Topic, and a placeholder would assert otherwise.

**The engine needs no change.** `delivered` counts history by `lessonId` and ignores an entry whose
Lesson is not in the stream; `demandFor` filters Continuations the same way. Detaching is
`moveLessonToTopic` with a null target — set the column, re-derive the old Topic.

**Readiness rows survive a Detach.** The cascade is on delete, and a Detach deletes nothing. A
Standalone Lesson may therefore keep marks for Classes that can no longer be scheduled it. They are
inert, and ADR-0014's rule that Readiness dies with its pairing is unchanged, because the pairing
is not what a Detach breaks.

**One-off Lessons become possible, and are not built here.** A Lesson for revision or feedback,
belonging to no scheme of work, is a Standalone Lesson. Scheduling one needs a second route into a
Class's stream, direct from Class to Lesson, bypassing Topic — a null `topic_id` only makes a
Lesson unreachable, never schedulable. That feature is deliberately out of scope. When it arrives,
a retired Lesson and a one-off Lesson will be indistinguishable by `topic_id` alone, and it may
need a mark to tell them apart. Adding one now would be guessing at a design not yet done.

> **Amended 2026-09-04 (ADR-0022).** The second route arrived: a **Placement** schedules a
> Standalone Lesson directly onto one Class, on one date, bypassing Topic. The predicted mark never
> got built — a Placement's own record is the whole difference between a retired Standalone Lesson
> and a schedulable one, so `lesson` gains no column. One consequence this ADR did not foresee:
> because a Placement is the only door back onto a Class's schedule, the reverse of Detach —
> re-filing a Standalone Lesson into a Topic — is retired along with it. Detach is one-way.
