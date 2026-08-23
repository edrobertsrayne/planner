# Class tones are assigned at creation, not hashed

Since #36 a Class's colour came from hashing its id into the palette, chosen so that no Class ever
changes colour when an unrelated Class is created or deleted. The Agenda prototype (#68) showed the
cost: three of six plausible ids landed on the same tone, and past nine live Classes a collision is
guaranteed by pigeonhole whatever the hash. On #77 Ed ruled collisions themselves acceptable — what
he wanted instead is that each new Class takes the next colour in a sequence, assigned automatically
with no way to edit it, and that adding even three Classes produces colours spread around the wheel.

## Decision

A Class's tone is stored on the Class (a `tone` column) and assigned once, at creation: the next
unused position in a fixed permutation of the eight slots, ordered so consecutive additions land far
apart on the hue wheel rather than on neighbouring hues. Deleting a Class frees its position for the
next new Class; nothing else moves, so #36's constraint — an existing Class never shifts when
another Class is created or deleted — holds exactly as it did under the hash. Past eight live
Classes the sequence wraps and duplicates appear, spaced apart; this is accepted.

## Considered options

**Keep hashing, spread better.** No deterministic function of the id can see its siblings, so no
hash beats pigeonhole — it only shuffles which pairs collide.

**Derive by rank among the current Classes.** Needs no schema change, but deleting any Class slides
every later Class back one slot and repaints half the app mid-year — precisely what #36 refused.

**Teacher-picked colours.** Declined: auto-assignment is what was wanted, and editing would need
uniqueness rules the sequence provides for free below eight.

## Consequences

This is a deliberate exception to the redesign map's frozen data model (#53): the carve-out is
recorded on the map, and this ADR is why. Existing Classes backfill once, in creation order. The
change lands with the production rebuild — whichever rebuild ticket owns `class-tone.ts` carries the
column, the migration and backfill, the creation-time assignment, and the literal-Tailwind-to-token
swap already owed by #59/#67, together.
