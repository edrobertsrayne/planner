# Backlog

Ideas for later. Not scoped, not scheduled, not promised. When an idea is
ready to work on, turn it into a GitHub issue (see
`docs/agents/issue-tracker.md`) and remove it from here.

Add new entries at the top, dated:

- YYYY-MM-DD: idea

- 2026-10-05: One query-string helper for every filter. `withParam` (issue #338) sets one
  parameter and keeps the rest. The Agenda's horizon and look-back now use it (issue #341);
  the Class page (`?from=`) still builds its hrefs by hand. Move that one to `withParam` so
  one convention serves every filter.

- 2026-08-27: End-of-year rollover. A destructive control that clears the calendar model
  and wipes every Session for a fresh start in a new academic year. Ruled out of scope
  while charting the calendar-editing map (#152), which decided how Terms and Blocked
  Days are edited but deliberately left the yearly reset alone.
