# ADR-0025: The planner seam owns every value rule

**Status:** Accepted (2026-10-01)

## Context

Three kinds of door write to the planner: the form actions, the planning API and the Session routes.
Each door had its own copy of the field rules, and the copies did not agree:

- The forms refused a Link url that was not http(s). The Import did not, so a `javascript:` url
  could reach an href.
- The API refused a Length above 20. The Lesson editor clamped the Length silently, and the Session
  panel had no upper limit.
- An unknown status in an Import got to the database CHECK and failed as a 500.
- The API alone had size limits (200 characters for a name, 100 000 for a body, 200 Lessons per
  Import) and refused unknown fields.

A rule that one door enforces and another door skips does not protect the data.

## Decision

The planner seam (`src/lib/server/planner/`) owns every value rule. The rules are in
`planner/fields.ts`, and each writer applies them. A breach throws `Refused('invalid', …)` with the
message the teacher reads, so every door shows the same words.

- **Doors only convert types.** A door reads its request, checks that each field is the right type
  and is present, and calls the seam. It does not trim and it does not check values.
- **Only rules that prevent breakage exist.** A name, title, label or url must not be empty after
  trimming. A Link url must be http(s), because it becomes a real href. A Length must be a whole
  number from 1 to 20, because the layout draws one part per Period. A status must be draft or
  planned, because the database refuses any other value.
- **The seam trims** names, titles, labels and urls. It stores a blank body as `null` and never
  trims a body otherwise (ADR-0023).
- **No size limits.** The request body limit (`BODY_LIMIT`, 12 MiB, ADR-0024) bounds every request.
  A long name breaks nothing.
- **The API ignores unknown fields.** It reads the fields it needs. An allow-list in each route is a
  second list of fields that must change each time the seam changes.

## Consequences

- A new door gets every rule without more work. A new rule goes in one place.
- The API's refusal messages are the teacher's words, for example `A Lesson needs a title.`, not
  `The "title" field must not be empty.`
- An agent that sends a field with a typo gets no error. The field has no effect, and the response
  shows the record as it was stored.
- A Link stored before the http(s) rule existed is shown as stored. Saving a change to that Link
  refuses until its url is corrected.
