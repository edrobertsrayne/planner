# Slots hold between dates instead of versioning the Timetable

A Slot carries an optional start date and an optional end date, over which it *holds*. Null bounds
mean it holds for the whole year. A timetable change is expressed by ending one Slot and starting
another; there is no Timetable version, no snapshot, and no history table.

Uniqueness is therefore window-aware: no two Slots may share a position — Week, Day, Period — over
dates where both hold. Postgres enforces this with an exclusion constraint over a date range.

## Why

The timetable does change during the year: classes are swapped, periods move, and exam groups
vanish onto study leave in the summer. A model where Slots simply describe the present cannot say
"the Year 11 Monday P1 stopped existing in May", so every Session generated after that date would
be wrong, and correcting it would mean deleting Slots and losing the record of what was taught.

Full versioning — a Timetable entity with dated revisions — models this properly and costs
considerably more: a second aggregate, a resolution step on every scheduling run, and a migration
story for revisions. Validity windows get the same expressiveness by adding two nullable columns
and one clause to the definition of Available Slot.

Nullable bounds rather than defaults of 1 September and 31 July: a Slot only becomes Available on a
date already inside a Term, so year-shaped defaults constrain nothing that Terms do not already
constrain. They would be two more values to maintain at rollover, and two more chances to be wrong.

## Consequences

Available Slot gains a clause — the date must lie within the dates the Slot holds — which every
scheduling query must honour.

Windows govern future scheduling only. Ending a Slot does not rewrite Sessions already taught in
it; those remain historical fact. Editing the Timetable re-runs scheduling forward from today.

Study leave, a mid-year timetable rewrite, and dropping a class are the same operation. There is no
separate concept for any of them.

The uniqueness constraint cannot be a plain unique index, and a naive one would make replacing a
Slot mid-year impossible — the replacement would collide with the Slot it replaces.
