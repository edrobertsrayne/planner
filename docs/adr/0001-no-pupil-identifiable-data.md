# No pupil-identifiable data

The planner will never store information about individual pupils — no names, no rosters, no marks,
no attendance, no SEN or pupil-premium flags, no behaviour notes. A Class is a label, a size and a
Timetable. This is a hard constraint on the schema, not a feature we have deferred.

## Why

This is a personal tool, self-hosted on a personal server and reachable from the public internet.
Without pupil data, a compromise is an embarrassment. With pupil data, it is a personal data breach
involving children, reportable to the school's data protection officer and potentially the ICO, on
infrastructure the school neither approved nor controls.

Nothing in the planner's purpose requires it. Everything the tool does — sequencing a Course,
laying it onto the Timetable, keeping it correct when lessons are lost — operates at the level of
the Class, never the pupil.

## Consequences

Anything genuinely per-pupil is out of scope for this system permanently, not merely for v1.
Should that ever be wanted, it belongs in a different tool with a different threat model, most
likely one the school hosts.

Notes on how teaching went are still supported, but they attach to a Session and must describe the
Class, not named individuals.
