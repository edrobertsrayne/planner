# Topics are assigned to a Class, not Courses

A Class is created against exactly one Course, which limits what it may be taught. What it
_actually_ teaches is an ordered subset of that Course's Topics, each given to it one at a time as
the Topic is written. The schedule is derived from those **Assigned Topics** — their Lessons,
flattened in order — not from the Course.

The alternative, and what ADR-0002 and ADR-0007 originally assumed, was that a Class follows a
Course and is scheduled to teach all of it, with new Topics appended to the Course as they are
authored. That handles incremental authoring perfectly well, needs no join table and no assignment
screen, and was the cheaper option in a three-week budget.

## Why

A Class only ever teaches **part** of a Course in one year — a Course spans more teaching than a
year holds. Course-to-Class cannot express that. It offers two ways out and both are bad: a
watermark saying "this Class is up to Topic 14", which is a second source of truth that goes stale
the moment anything is reordered; or ADR-0002's stated escape hatch of modelling the difference as
a **separate Course**, which forks the Lessons into divergent copies — precisely the drift ADR-0002
exists to prevent. Subsetting is not an edge case here, it is the normal condition of every Class.

The second reason is order. Which Topic comes next can change during a year, and assigning one at a
time means the order is never committed to in advance — it is decided as it is reached. That turns
out to be why the Course needs no Topic order of its own: nothing derives from it, so a Course is
an unordered container and the only order that exists is per-Class.

The engine was already indifferent to this. The prototype (issue #4) took a flat array of Lessons
and a Class id; it never knew about Courses. So this decision changes only how that array is
produced, which is what made it safe to take after the engine was proven.

## Consequences

ADR-0007's input is restated: the function is given the Lessons of the Class's Assigned Topics,
flattened in Assigned-Topic order then Lesson order, and lays them onto that Class's Available
Slots. Nothing else about it changes — in particular the boundary rule now carries everyday use,
not just disruptions, because assigning October's Topic in October is an ordinary re-run that
cannot touch what is already taught.

Editing content moves dates. Adding a Lesson to a half-taught Topic grows the flattened list in the
middle, so the rest of the year shifts right; deleting one pulls it earlier. This is deliberate and
unwarned — it is the same rule as every other input change, and a confirmation dialog on every
lesson plan would be intolerable. Runway is surfaced on the Classes view instead (issue #19).

Progress is measured against a Class's Assigned Topics, never against its Course. A Class teaching
half a Course would otherwise sit permanently below 50%.

A Class's Course is fixed at creation and the screens offer no way to change it, because a Class
never outlives its academic year. Correcting a mis-picked Course before anything is assigned means
deleting the Class; `bun db:studio` is the escape hatch otherwise.

Nothing forbids assigning the same Topic to a Class twice. It makes "how far into Forces is this
Class" ambiguous on the Classes view, and that was judged not worth a constraint for a case that
will not arise.
