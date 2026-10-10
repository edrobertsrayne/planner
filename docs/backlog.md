# Backlog

Ideas for later. Not scoped, not scheduled, not promised. When an idea is
ready to work on, turn it into a GitHub issue (see
`docs/agents/issue-tracker.md`) and remove it from here.

Add new entries at the top, dated:

- YYYY-MM-DD: idea

- 2026-10-10: Re-import a changed Topic in place, matching its Lessons by id or position. Ruled
  out in "What is a Topic with no Course, and where does the teacher see it?" (#376): Delete Topic
  now keeps its Lessons as Standalone Lessons, so delete-and-import-again leaves the old copies
  behind. The teacher accepts this; rollover tidies them. Import stays create-only.

- 2026-10-07: Ask whether stored Sessions still earn their place. Raised in "What may the teacher
  move across the taught boundary?" (#371): with taught Sequence entries locked and notes kept on
  the Sequence entry, a relabel no longer strands a note, so `atRisk` may go and Sessions might be
  derived on demand. Stored history still guards the past against later inputs, such as a Length
  edit to a taught Lesson. Beyond the per-Class order map (#366).

- 2026-10-07: Teach one Topic Lesson to one Class more than once, for example as revision. Ruled
  out in "What do Assign Topic and Unassign Topic do on a flat Class list?" (#369): a Lesson is in
  a Class's Sequence once at most, because taught parts, Continuations and Readiness are keyed by
  Lesson and Class, not by Sequence entry. Needs that state keyed per entry.

- 2026-10-07: Fork one Lesson for one Class, so a Class can change a Lesson's content without
  changing other Classes. Ruled out of scope while charting the per-Class order map (#366): the
  teacher needs only a different order, so Lessons stay shared.

- 2026-10-10: Decide if the Planning page has value. The Class page is now the only place to
  change a Class's teaching order (#379), so Planning is only a to-do list of Draft and Planned
  Lessons. Keep it as that, change it, or remove it. Ruled out of scope on the per-Class lesson
  order map (#366).

- 2026-10-06: Show the Rewind report of placing a Lesson on the Session page. `POST
/session/placement` sends `report`, but `session-body.svelte` ignores it, so a Placement
  that shifts another Placement stays silent (found in #357; `atRisk` retired in #371).

- 2026-10-06: A search control over Lessons and Sessions (#265). The dashed "Search" room in
  the sidebar and top bar was removed as a no-op placeholder (PR #354 review); build the
  control with the feature.

- 2026-08-27: End-of-year rollover. A destructive control that clears the calendar model
  and wipes every Session for a fresh start in a new academic year. Ruled out of scope
  while charting the calendar-editing map (#152), which decided how Terms and Blocked
  Days are edited but deliberately left the yearly reset alone. When it is designed: it
  tidies every Standalone Lesson, Placed or not, and it wipes Sessions and Placements first,
  so no history names a Lesson it removes (#376).
