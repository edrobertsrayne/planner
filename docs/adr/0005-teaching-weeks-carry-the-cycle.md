# Teaching Weeks carry the cycle, and the cycle is stored

Week A and Week B alternate across Teaching Weeks — calendar weeks containing at least one taught
day — starting from Week A in the first Teaching Week of the academic year. A week falling entirely
inside a break is not a Teaching Week and takes no turn in the cycle.

That rule is a _generator_, not an invariant. It is run once when the academic year is set up, to
produce a stored row per Teaching Week carrying its letter. Thereafter the stored letter is the
truth and can be edited.

## Why

The obvious implementation is arithmetic: fix an anchor date and alternate on calendar week parity
forever. It is wrong here. Every one-week break — the October, February and Whit half-terms —
consumes a parity step that the school does not, so parity and reality diverge three times a year.
Verified against the real 2026/27 calendar: parity puts w/c 2 November 2026 in Week B, the school
has it in Week A, and every subsequent week of that Term inherits the error.

Storing rather than computing costs one table and buys two things. The whole year becomes a
40-row list that can be checked against the school's published calendar before September, when a
mistake is still cheap. And when the school announces a one-off swap after a disruption — "we'll
stay on Week A next week" — there is a row to edit. Under pure computation the model would simply
be unable to express what the school had decided.

## Consequences

An academic year must be set up before any scheduling can happen; the Teaching Week rows are a
prerequisite, not a derivation available on demand.

A stored letter can drift from what the generator would now produce, if Term dates are edited after
setup. This is intentional — the stored value wins — but it means editing Term dates does not
silently re-letter the year, and re-running the generator is a deliberate act.

Nothing may infer a week's letter from its date. The letter is looked up.
