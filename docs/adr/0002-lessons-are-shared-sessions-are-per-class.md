# Lessons are shared; Sessions are per-Class

A Lesson belongs to a Topic and is shared by every Class that Topic is assigned to. Assigning a
Topic to a Class does not copy its Lessons — it generates Sessions, each being one dated occasion
on which a Lesson is taught to one Class. Anything that varies between Classes lives on the
Session; anything describing the teaching itself lives on the Lesson.

> **Amended 2026-08-14.** Written when a Class followed a whole Course; the unit of assignment is
> now the Topic (ADR-0010). Sharing is unchanged and if anything strengthened — Topic-level
> assignment is what lets two Classes take the same material in different orders without forking
> the Lessons. The one part that did not survive is the escape hatch below.

> **Amended 2026-10-10 (ADR-0026).** Sharing stands: a Class points at the shared Lesson, and an
> edit to a Lesson shows in every Class. Assigning a Topic now copies the Topic's Lesson ids, not
> its Lessons, into the Class's **Sequence**, which is the Class's own order. Two consequences
> below change: a Class's different subset and order is its Sequence, not its Assigned Topics; and
> the note on how a Lesson went is a **Teaching note** on the Sequence entry (Class, Lesson), not on
> the Session.

## Why

The alternative is to copy a Course's Lessons into each Class on assignment, letting each Class's
copy be edited independently. That gives per-Class freedom at the cost of drift: improving a Lesson
after teaching it to one group leaves the others running an older version, and after a year there
is no canonical scheme of work, only divergent copies.

Sharing matches how planning actually works — you write a lesson once and teach it several times —
and it preserves each Topic as a single authoritative body of Lessons.

## Consequences

Per-Class pace is unaffected: Sessions are independent, so Shift-right applies to one Class without
touching another.

~~Classes needing materially different content are modelled as following different Courses, not by
editing one Class's copy.~~ **Struck 2026-08-14 (ADR-0010).** Duplicating a Course to give one
Class different content forks its Lessons, which is the drift this decision exists to prevent.
Classes needing different content are given a different subset of Assigned Topics, in a different
order — and materially different content means a different Course only in the sense that the
Topics themselves differ, not that one Course is copied.

> **Amended 2026-10-10 (ADR-0026).** Read "Assigned Topics" above as "Sequence": a Class takes a
> subset of the shared Lessons in its own order. Assigned Topics no longer exist.

Notes on how a lesson went must attach to the Session. Putting them on the Lesson would leak one
Class's experience into every other Class's plan.

> **Amended 2026-10-10 (ADR-0026).** The note stays per Class, which is the point of this
> paragraph. Its key changes from the occasion (Class, date, Period) to the Sequence entry (Class,
> Lesson). A Rewind relabels occasions, and the note now follows its Lesson to the day it was
> really taught. Still never on the Lesson.
