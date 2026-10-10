# Backlog

Ideas for later. Not scoped, not scheduled, not promised. When an idea is
ready to work on, turn it into a GitHub issue (see
`docs/agents/issue-tracker.md`) and remove it from here.

Add new entries at the top, dated:

- YYYY-MM-DD: idea

- 2026-10-10: A keyboard way to move a Lesson in a Class's Sequence (for example, ↑ and ↓ on
  a focused grip). The Sequence tab moves a Lesson only by a drag, ruled in #372: the one
  teacher uses a mouse or a finger.

- 2026-10-10: Decide if the Planning page has value. The Class page is now the only place to
  change a Class's teaching order (#379), so Planning is only a to-do list of Draft and Planned
  Lessons. Keep it as that, change it, or remove it. Ruled out of scope on the per-Class lesson
  order map (#366).

- 2026-10-06: Show the Rewind report of placing a Lesson on the Session page. `POST
/session/placement` sends `report`, but `session-body.svelte` ignores it, so a Placement
  that shifts a noted Session or another Placement stays silent (found in #357).

- 2026-10-06: A search control over Lessons and Sessions (#265). The dashed "Search" room in
  the sidebar and top bar was removed as a no-op placeholder (PR #354 review); build the
  control with the feature.

- 2026-08-27: End-of-year rollover. A destructive control that clears the calendar model
  and wipes every Session for a fresh start in a new academic year. Ruled out of scope
  while charting the calendar-editing map (#152), which decided how Terms and Blocked
  Days are edited but deliberately left the yearly reset alone.
