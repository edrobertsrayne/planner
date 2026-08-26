# Planning status and Readiness are separate

The fifth tab (#100) began as one three-rung ladder — Bare, Drafted, Ready — but the three states do
not describe the same subject. Whether a Lesson is approved to teach from (Draft/Planned) is a fact
about the Lesson, written once on a Sunday and true of every Class assigned its Topic. Whether everything is
printed, resourced and set is a fact about teaching one Class that Lesson, and Classes sharing a
Topic differ freely. ADR-0002 says what varies between Classes lives on the Session, but ADR-0007
makes Sessions derived occasions keyed by (Class, date, Period): a Shift-right or Rewind relabels
which Lesson an occasion carried, and a future Slot has no Session row at all — a mark there would
move or vanish under exactly the disruptions readiness exists to survive. On #101 Ed ruled the
ladder splits; on #106 he ruled the two halves are separate systems, not two rungs of one.

## Decision

Draft and Planned are stored on the Lesson, shared by every Class assigned its Topic. Ready is stored
separately, one **Readiness** record per (Lesson, Class) holding only the Ready mark. The two are
**independent**: a Draft Lesson may be marked Ready, moving a Lesson back to Draft never clears
Readiness, and editing a Lesson never disturbs it. Readiness dies with its pairing — unassigning a
Topic, or deleting a Topic or Lesson, takes the rows with it — and that is the only rule crossing
between them.

They are also written and read in different places. Draft and Planned belong to the Planning screen
and the Lesson editor; Ready is ticked per Class on the Agenda, where the occasion is in front of
the teacher. Neither screen shows the other's state.

This is a deliberate exception to ADR-0002's rule that Class-varying facts live on the Session:
readiness varies by Class but is not an occasion, so it gets its own keyed record instead.

## Considered options

**Whole ladder per Class.** One uniform store, but drafting becomes once-per-Class work and
reverses the settled preference that planning stays a single act on the shared Lesson.

**Ready on the Session.** Rejected above — the schedule is derived, and readiness must outlive
Shift-right and Rewind.

**One ladder with Ready as its top rung**, requiring Planned and cleared by a drop to Draft. Rejected
on #106: it forces one screen to answer two questions, and it makes the word Ready change meaning
depending on whether a Class is selected. The precondition is also false in practice — a practical
can be set up for a Lesson that is still only a title — and the clearing rule lets a Sunday planning
edit silently delete a mark made about a Thursday.

**Deriving readiness from evidence** (links present, print log). Rejected against the standing
rule: statuses are stored and manually advanced, never derived from body or links shape.

## Consequences

No view shows both axes. The Planning screen is Lesson-shaped and carries no Class; the Agenda is
occasion-shaped and carries the tick. Nothing has to reconcile two stores into one displayed state,
which the earlier ladder would have required everywhere preparation appeared.

> **Amended 2026-08-25 (issue #108).** **Bare** is renamed **Draft** and **Drafted** is renamed
> **Planned**. This record is written in the new names throughout, except the opening sentence,
> which keeps Bare and Drafted because that is what the ladder was called when this decision was
> taken. Nothing about the decision changes: the two states still sit on the Lesson, Ready still
> sits on the (Lesson, Class) pairing, and the three remain independent. The rename also freed the
> word "planned", so **Unplanned Slot** became **Open Slot** and **Planned Length** became
> **Length** — see the amendment on ADR-0007. `CONTEXT.md` is the source of truth for all four
> terms.
