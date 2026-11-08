# Architecture

A map of how the planner is put together. The domain language is in
[GLOSSARY.md](../GLOSSARY.md); the reasoning behind each decision is in [docs/adr/](adr/), cited
below by number.

## Shape of the system

One SvelteKit application, built with adapter-node, running as one Node process against one SQLite
file ([ADR-0004](adr/0004-sveltekit-over-a-more-agent-familiar-stack.md),
[ADR-0008](adr/0008-sqlite-over-postgres.md), [ADR-0028](adr/0028-node-over-bun.md)). There is one
user. Pages are server-rendered with Svelte 5 and talk to the server through form actions and a few
JSON routes. An outside agent uses the Planning API ([api.md](api.md)).

```mermaid
flowchart LR
    Browser -- session cookie --> Hooks
    Agent -- bearer API key --> Hooks
    Hooks[hooks.server.ts] --> Pages[(app) pages and form actions]
    Hooks --> API[/api/* routes/]
    Hooks --> Other[session, backup, attachments]
    Pages --> Seam
    API --> Seam
    Other --> Seam
    Seam[planner seam<br/>src/lib/server/planner] --> Engine[pure engine]
    Seam --> DB[(SQLite via Drizzle)]
    Seam --> Files[attachments/ folder]
```

## Request pipeline

`src/hooks.server.ts` composes the request handlers in a fixed order:

| Step | Hook                    | Does                                                                      |
| ---- | ----------------------- | ------------------------------------------------------------------------- |
| 1    | `handleZone`            | Classifies the path once into `event.locals.zone`                         |
| 2    | `handleSecurityHeaders` | `nosniff`, `Referrer-Policy: same-origin`, `frame-ancestors 'none'`       |
| 3    | `handleBodyLimit`       | 413 for a body over 12 MiB, except `/setup/restore`; JSON for API zones   |
| 4    | `handleCsrf`            | In the app zone, refuses form-typed writes whose `Origin` is not the site |
| 5    | `handleApiLog`          | After the response: logs one line for a successful API write              |
| 6    | `handleApiKey`          | In the `api` zone, requires the bearer key; 401 JSON otherwise            |
| 7    | `handleAuth`            | In the app zone, reads the session; hands `/api/auth/*` to Better Auth    |
| 8    | `handleGuard`           | In the app zone, redirects to `/setup`, `/login` or `/` by state          |

Every later hook branches on the **zone** rather than re-reading the path (`src/lib/server/zone.ts`):

- `auth`: `/api/auth/*`, Better Auth's own surface.
- `api`: the rest of `/api/*`, the Planning API.
- `app`: everything else.

The guard answers one question per request, in order: with no user, everything goes to `/setup`; with
a user but no session, to `/login` (keeping `redirectTo`); a signed-in visitor has no business on
`/setup` or `/login`. Whether a user exists is queried every request, so `reset:credentials` brings
the wizard back without a restart.

SvelteKit's built-in CSRF origin check is switched off (`csrf.trustedOrigins: ['*']`) because it
cannot be scoped to a path and would refuse a bearer-key file upload. `handleCsrf` applies the same
rule to the app zone only. The API carries no ambient credential a forged form could ride on.

## Authentication

- **Browser:** Better Auth with email and password, session in a cookie. Sign-up is disabled at the
  endpoint and so is `/api/auth/sign-in/email`; `/login` is the only door and is throttled
  (`login-throttle.ts`). The single user is created by `/setup` through the internal adapter, under a
  queue (`firstRun`) shared with Restore so two requests cannot both create one
  ([ADR-0011](adr/0011-password-reset-is-a-cli-operation.md)). Better Auth's login session table is
  `auth_session`, because the domain already has a `session` table.
- **Agents:** one regenerable API key, stored as itself, in the `api_key` table
  ([ADR-0019](adr/0019-one-regenerable-api-key.md),
  [ADR-0021](adr/0021-the-api-key-is-stored-as-itself.md)). Minted on first view of Settings.
  `requireApiKey` matches the bearer token and stamps `last_used_at` in one `UPDATE`.

## The planner seam

`src/lib/server/planner/` is the boundary around every domain rule. Routes and form actions never
query Drizzle for scheduling data and never call the engine; they import from `planner/index.ts`,
which names everything the rest of the app may do.

Three rules follow ([ADR-0025](adr/0025-the-seam-owns-every-value-rule.md)):

1. **A door parses; the seam decides.** Doors (form actions, API routes, `load`, session routes)
   narrow untyped input to types and map outcomes to statuses. They hold no value rule.
2. **Refusals leave as `Refused`.** A seam function throws `Refused(kind, message)` with a message
   already written for the teacher. `kind` maps to a status in one table (`refused.ts`):
   `invalid` 400, `missing` 404, `conflict` and `unconfirmed` 409. The API wrapper `apiRoute`, the
   form-action helper and the session routes all use it, so doors cannot drift. A URL-addressed
   record that does not exist is not a refusal: the function returns `undefined` and the door answers 404.
3. **A write that can move a date answers with its report.** Every scheduling write re-derives the
   affected Classes in the same call and returns `{ placementsMoved }`. There is no separate
   "recompute" action anywhere.

| Module                                                                        | Concern                                                    |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `engine`                                                                      | The pure scheduling function: no I/O, no clock, no Drizzle |
| `derive`                                                                      | Feeds the engine from the database and persists its answer |
| `courses`, `lessons`, `links`, `tags`, `attachments`, `import`                | The planning half                                          |
| `classes`, `timetable`, `sequence`, `placement`, `sessions`, `teaching-notes` | A Class and its schedule                                   |
| `events`                                                                      | Recurring commitments that never clash with a Class        |
| `disruptions`, `terms`, `cover`                                               | Blocked Days and Slots, the six Terms, Absence Cover       |
| `views`                                                                       | The Agenda stream and Calendar grid across every Class     |
| `ordering`, `fields`, `refused`                                               | Shared position arithmetic, field rules, the refusal       |

## Scheduling

The schedule is **derived, never edited**
([ADR-0007](adr/0007-the-schedule-is-derived-never-edited.md)). The engine is one pure function: take
a Class's Sequence of Lessons in order, take its Available Slots in order, zip them. There are no
move, shift or insert operations; every disruption is a change to the function's input and the
schedule is recomputed.

Inputs:

- **Sequence**: the Class's own ordered Lessons (`class_lesson`,
  [ADR-0026](adr/0026-each-class-holds-its-own-sequence.md)). Lessons are shared; only the order is
  per Class.
- **Available Slots**: the Class's Timetable Slots over the Teaching Weeks of the Terms, minus
  Blocked Days, Blocked Slots and Placements.
- **Placements**: a Standalone Lesson scheduled directly onto a Class at a chosen date and Slot
  ([ADR-0022](adr/0022-a-lesson-is-scheduled-directly-by-a-placement.md)).
- **Continuations**: widen a Lesson onto the next Available Slot.
- **Length**: a Lesson takes that many Periods.

Events occupy the Timetable but are not an input to the schedule
([ADR-0029](adr/0029-events-occupy-the-timetable-but-are-not-input-to-the-schedule.md)). Cover is
read only by views, never by the engine ([ADR-0030](adr/0030-an-absence-is-a-block-and-its-cover-is-a-lesson.md)).

The engine takes a **boundary** (today) and writes on and after it, never before. Sessions dated
before it are the record of what was taught. A **Rewind** moves the boundary back so a disruption
entered after the fact re-derives recorded Sessions; it is the one operation that is not a plain
re-run. Dates are ISO `YYYY-MM-DD` text throughout and compared as strings
([`src/lib/date.ts`](../src/lib/date.ts)); the clock is read in one place, `today()`.

The Week letter (A or B) is computed from the Teaching Weeks, never stored
([ADR-0020](adr/0020-the-week-letter-is-computed-never-stored.md),
[ADR-0005](adr/0005-teaching-weeks-carry-the-cycle.md)).

## Data model

Defined in `src/lib/server/db/schema.ts` (Drizzle) and `auth.schema.ts` (generated by Better Auth).
Ids are `crypto.randomUUID()` text.

```mermaid
erDiagram
    course ||--o{ topic : holds
    topic ||--o{ lesson : files
    lesson ||--o{ link : has
    lesson ||--o{ attachment : holds
    lesson }o--o{ tag : "lesson_tag"
    course ||--o{ class : "followed by"
    class ||--o{ class_lesson : "Sequence"
    lesson ||--o{ class_lesson : in
    class ||--o{ slot : holds
    class ||--o{ session : taught
    lesson ||--o{ session : names
    class ||--o{ placement : has
    slot ||--o{ placement : anchors
    class ||--o{ blocked_slot : has
    class ||--o{ cover : has
    event ||--o{ event_slot : occupies
    event ||--o{ event_note : has
```

| Group      | Tables                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Planning   | `course`, `topic`, `lesson`, `link`, `tag`, `lesson_tag`, `attachment`                                         |
| Scheduling | `class`, `class_lesson`, `slot`, `session`, `placement`, `continuation`, `readiness`, `teaching_note`, `cover` |
| Events     | `event`, `event_slot`, `event_note`                                                                            |
| Calendar   | `term`, `blocked_day`, `blocked_slot`                                                                          |
| Access     | `api_key`; Better Auth's `user`, `auth_session`, `account`, `verification`                                     |

Points that matter when changing the model:

- `lesson.topic_id` is nullable: a null Topic is a Standalone Lesson
  ([ADR-0015](adr/0015-a-lesson-may-stand-outside-a-topic.md)).
- A Session is identified by its occasion (Class, date, Period), unique by that triple, never by a
  row id ([ADR-0002](adr/0002-lessons-are-shared-sessions-are-per-class.md)).
- Course names are unique, and Topic names unique within a Course, case-insensitively, by
  `COLLATE NOCASE` unique indexes.
- Readiness and Teaching notes belong to a (Class, Lesson) pairing and cascade with it.
- No table holds pupil data ([ADR-0001](adr/0001-no-pupil-identifiable-data.md)).
- Every connection sets `foreign_keys=ON`, `journal_mode=WAL` and a `busy_timeout`; without them
  SQLite silently permits orphans.

Migrations are applied at startup. See [development.md](development.md#migrations).

## Files and Backup

Attachment bytes live in `attachments/` beside the database, one file per row, named by the row's
UUID with no extension, so moving a Lesson never moves a file. `attachmentsDir(databaseUrl)` derives
the path. Creation validates first, writes the file, then inserts the row, and undoes the file if
the row fails.

Backup (`VACUUM INTO` a temp copy, then stream a tar of the copy plus each Attachment it names) and
Restore (stream the upload into a scratch folder, validate, copy into the live database in one
transaction) are in `src/lib/server/backup/`
([ADR-0024](adr/0024-the-planner-backs-itself-up-on-demand.md)). Memory use does not grow with the
number of Attachments.

## Content

Lesson plans and notes are stored as Markdown and edited with Tiptap
([ADR-0023](adr/0023-lesson-plans-are-markdown-end-to-end.md)). They render through `markdown-it`
with `html: false` and KaTeX with `trust: false`, so rendering with `{@html}` is safe; do not relax
either option without a Content Security Policy (see [backlog](backlog.md)).

## Front end

- Svelte 5, runes mode enforced for the project.
- Tailwind 4 with shadcn-svelte components in `src/lib/components/ui/`, on the project's own tokens
  ([ADR-0012](adr/0012-shadcn-svelte-on-our-own-tokens.md)). Class and course colours are assigned,
  not hashed ([ADR-0013](adr/0013-class-tones-are-assigned-not-hashed.md)).
- The app shell is a sidebar on laptops, icons only on tablets, and a top bar with a drawer on
  phones. Screens are listed in `src/routes/(app)/nav.ts`.
- Write controls (drag to reorder, Ready ticks) appear from a tablet up; a phone mostly reads.
- Forms are SvelteKit form actions enhanced with `use:enhance`; `src/lib/client/enhance.ts` refreshes the page data and toasts a refusal's reason.

## Testing seams

- `setClock` in `src/lib/date.ts` pins today; the server sets it from `PLANNER_NOW` at startup, which
  the e2e suite uses.
- `setEnvForTests` in `src/lib/server/env.ts` pins optional-integration variables.
- Seam tests build their state with fixtures (`planner/fixtures.ts`, `sequence-fixtures.ts`,
  `authoring-fixtures.ts`) over a throwaway database file, migrated fresh for each test.
