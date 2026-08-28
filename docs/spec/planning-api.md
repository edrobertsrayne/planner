# Specification: the Planning HTTP API

Status: **specification only — nothing is built.** This document is the destination of wayfinder map
[#126](https://github.com/edrobertsrayne/planner/issues/126). It gathers every decision that map
recorded and adds the mechanical detail (field shapes, validation, status codes) that was deferred
to it.

The companion document `docs/spec/planning-api-skill.md` holds the reference skill for a consuming
agent. Move it to `.claude/skills/planner-api/SKILL.md` when the API is built, not before.

## 1. Purpose and scope

The API gives an outside agent write access to the **Planning** half of the domain: Course, Topic,
Lesson and Link. It does two things.

1. **CRUD.** Create, read, edit and remove one record at a time.
2. **Import.** Create one Topic, with its Lessons and their Links, in a single all-or-nothing
   request.

It is one link in a larger workflow the teacher drives. It does not parse lesson plans and it makes
no editorial decision.

### Out of scope

These are ruled out of this effort. They are listed so an implementer does not add them by reflex.

- Everything in the **Scheduling** half: Class, Timetable, Slot, Session, Assigned Topic,
  Continuation, and Readiness.
- Reordering: `moveLesson` and `moveLink` get no endpoint. Order is set by creation order.
- Whole-Course Import. Import handles one Topic per request.
- Update-by-reimport. Import is create-only. To change an imported Topic, delete it and import
  again, or edit it in the Courses view.
- Scheduling a Standalone Lesson directly to a Class (ADR-0015 leaves this for a later effort).
- OAuth, multi-user support, rate limiting, and API versioning.

## 2. Authentication

### 2.1 The mechanism

The planner already has a cookie session for the browser. An agent cannot use it. The API therefore
gets a second mechanism: **one regenerable API key** (ADR-0019, superseded by ADR-0021).

- The planner mints the key the first time Settings is opened; the teacher reads it there and
  gives it to the agent.
- The server stores the token itself, in the clear. No hash of it is kept.
- Regenerating replaces the key. The old token stops working the moment the new one is minted.
  This is the only revoke: there is nothing to revoke separately.
- At most one row, enforced by the write path: regenerating deletes every row and inserts one.

One key for the account, not one per tool. With one consumer, revoking **is** breaking it, and
that is the intent.

### 2.2 The token

- 32 random bytes from `crypto.getRandomValues`.
- Encoded base64url, which gives 43 characters.
- Prefixed `pln_`, so the token is recognisable in a log or a config file.
- Example shape: `pln_8Kq2mV...` (47 characters in total).

The token is stored **as itself**, not as a digest (ADR-0021). A digest defends a stolen-database
threat this planner does not have: the same database holds the session table and every Course,
Topic and Lesson, so anyone who can read the key table already owns the account and can mint a key
of their own. What a digest costs is paid on every visit — the token could be shown once and never
again.

### 2.3 The header

```
Authorization: Bearer pln_8Kq2mV...
```

The server looks the presented token up in the key table — a plain match, nothing hashed. A miss, a
malformed header, or a missing header is **401**:

```json
{ "error": "Give a valid API key in the Authorization header." }
```

Do not say whether the key was absent, malformed, or unknown. All three get the same reply.

### 2.4 The schema

| column         | type    | notes                                       |
| -------------- | ------- | ------------------------------------------- |
| `id`           | text PK | `crypto.randomUUID()`, as every other table |
| `token`        | text    | not null, unique, the token itself          |
| `created_at`   | integer | not null, `timestamp_ms`                    |
| `last_used_at` | integer | nullable, `timestamp_ms`                    |

`last_used_at` is included. It is the only way to tell the live key from a forgotten one, and one
write per request is cheap on SQLite. Write it on every accepted request.

The table holds no `user_id`. There is one account (ADR-0011, and the Setup screen) and one key,
so a key identifies the account and nothing else.

### 2.5 The request guard

`src/hooks.server.ts` currently redirects every unauthenticated request with a **303** to `/login`.
An agent must not get an HTML login page.

`handleGuard` must let `/api/*` through. The API routes then run their own bearer check and answer
with JSON. `/api/auth/*` is already short-circuited by `svelteKitHandler` and is unaffected.

Put the bearer check in one place — a helper such as `requireApiKey(event)` — and call it first in
every handler. Do not repeat the check inline.

### 2.6 The Settings screen

API keys belong in Settings: they identify the account (the single user), not the calendar model
and not any Course. The card sits beside the change-password form.

One card, "API key":

- Opening the screen mints a key if the database has none. There is no Generate step and no state
  in which the planner has no key.
- The token is shown in full, in a read-only monospace field. No masking and no reveal toggle:
  masking defends a shoulder-surfing threat this planner does not have, and Settings is the only
  place the token can be read, so it is the only door this rule has to be kept at.
- The created and last-used dates sit beneath the field. A key nothing has used yet says so.
- Two icon buttons sit beside the field, each with an accessible name. **Copy** puts the exact
  token on the clipboard and confirms it.
- **Regenerate** asks first. It replaces the key — the only revoke this planner has, and one that
  cannot be undone — and it is a small icon button beside Copy, which is exactly why it must not
  fire on one click. It opens a confirmation that says plainly that the old token stops working at
  once and that every agent holding the key must be given the new one. Confirming replaces the key
  and the card shows the new one; cancelling leaves the key untouched.
- Report the outcome of each control as a toast, as the change-password form does.

There are **no HTTP endpoints for key management.** A key is made in the browser only. A key that
could make another key would make regeneration meaningless.

## 3. Shared rules

### 3.1 URL shape

URLs are flat. There is one level of nesting, and only for creating or listing a child:

```
POST /api/courses/:id/topics
POST /api/topics/:id/lessons
POST /api/lessons/:id/links
```

Read, edit and remove by id stay flat: `GET|PATCH|DELETE /api/courses/:id`. A Topic's id is enough
to find it, so `/api/courses/:cid/topics/:tid` would carry a part that is never needed and can
disagree with itself.

### 3.2 Responses

Plain JSON. **No envelope.** A success returns the record, or the array, directly.

```json
{ "id": "9f1c...", "name": "Year 9 Physics" }
```

An error returns:

```json
{ "error": "A Course called \"Year 9 Physics\" already exists." }
```

The message is one sentence, in Sentence case, and says what happened. It never carries a code, a
stack, or a field path.

### 3.3 Status codes

| code | meaning                                                                |
| ---- | ---------------------------------------------------------------------- |
| 200  | Read or edit succeeded. Body is the record or the array.               |
| 201  | Create succeeded. Body is the new record.                              |
| 204  | Remove succeeded. No body.                                             |
| 400  | The body is malformed, a field is missing, or a value is out of range. |
| 401  | The API key is absent or unknown.                                      |
| 404  | The record named in the path does not exist.                           |
| 409  | The write collides with an existing record, or is refused as unsafe.   |
| 500  | Unexpected. The message must not leak internals.                       |

`404` and `409` are distinct and must not be merged. `404` means "this id is wrong". `409` means
"this id is right and the write is refused".

### 3.4 PATCH semantics

PATCH is partial. Only the fields present in the body change.

An **absent** field and a **null** field mean different things:

- `body` absent → the Lesson body is unchanged.
- `body: null` → the Lesson body is cleared.
- `topicId` absent → the Lesson stays where it is.
- `topicId: null` → the Lesson is **Detached** (section 5.4).

Read the parsed object with `'topicId' in payload`, not with `payload.topicId !== undefined`. The
two differ for an explicit null in some code paths, and this distinction is load-bearing.

A PATCH with an empty body is a no-op and returns **200** with the unchanged record.

### 3.5 Unknown fields are rejected

Any field not named in this document is **400**:

```json
{ "error": "The field \"titel\" is not recognised." }
```

The client is an agent. A silently ignored typo produces a Lesson that is wrong in a way nobody
sees. A loud failure is better.

### 3.6 Validation

| field                       | rule                                                               |
| --------------------------- | ------------------------------------------------------------------ |
| `name`, `title`, `label`    | string, trimmed, 1 to 200 characters after trimming                |
| `body`                      | string or null, at most 100 000 characters                         |
| `length`                    | integer, 1 to 20                                                   |
| `status`                    | `"draft"` or `"planned"`                                           |
| `url`                       | string, 1 to 2000 characters, parses as an `http:` or `https:` URL |
| `courseId`, `topicId`, `id` | string, matching an existing record                                |

Trim every string on the way in and store the trimmed value. `"  Forces  "` and `"Forces"` are the
same Topic name and must collide.

### 3.7 The current date

`createLesson`, `updateLesson`, `deleteLesson` and `moveLessonToTopic` all take a `today` argument
and re-derive the schedule. Route handlers must supply it from the server clock, in the school's
local date, exactly as the existing form actions do. It is never a request field. An agent must not
be able to move the planner's idea of today.

### 3.8 Re-derivation

Writing a Lesson re-derives every Class assigned its Topic. This is already true of the authoring
functions and is not changed here.

**Import must re-derive once, at the end**, not once per Lesson. Calling `createLesson` in a loop
would re-derive N times for one request. Insert the rows directly, then call `rederiveTopic` once.

## 4. The records

These are the JSON shapes. They match the Drizzle schema in `src/lib/server/db/schema.ts`.

**Course**

```json
{ "id": "9f1c...", "name": "Year 9 Physics" }
```

**Topic**

```json
{ "id": "3a77...", "name": "Forces", "courseId": "9f1c..." }
```

**Lesson**

```json
{
	"id": "b204...",
	"topicId": "3a77...",
	"title": "Balanced and unbalanced forces",
	"body": "## Starter\n...",
	"status": "draft",
	"length": 1,
	"position": 0
}
```

`topicId` is **nullable**. A Lesson with `"topicId": null` is a **Standalone Lesson** (ADR-0015).
`body` is nullable. `position` is read-only — it is set by the server and no endpoint accepts it.

**Link**

```json
{
	"id": "cc90...",
	"lessonId": "b204...",
	"url": "https://...",
	"label": "Simulation",
	"position": 0
}
```

`position` is read-only here too.

## 5. Endpoints

### 5.1 Course

**`GET /api/courses`** → 200, `Course[]`, ordered by name.

This is the lookup list. An agent that knows a Course by name and needs its id starts here.

**`POST /api/courses`**

```json
{ "name": "Year 9 Physics" }
```

→ 201, `Course`. → 409 if a Course of that name already exists (section 6).

**`GET /api/courses/:id`** → 200, `Course`. → 404.

**`PATCH /api/courses/:id`**

```json
{ "name": "Year 9 Combined Science" }
```

→ 200, `Course`. → 404. → 409 on a name collision.

**`DELETE /api/courses/:id`** → 204. → 404.

→ **409** if the Course holds any Topic:

```json
{ "error": "This Course still holds Topics. Remove them first." }
```

→ **409** if any Class follows the Course:

```json
{ "error": "A Class follows this Course, so it cannot be removed." }
```

There is no cascade. A Course is a year's worth of writing and must not go in one call. The Class
check is not optional: `class.course_id` is a `NOT NULL` foreign key, so the delete would fail at
the database anyway and produce a 500 instead of a clear 409.

**`GET /api/courses/:id/topics`** → 200, `Topic[]`. → 404.

Unordered. A Course holds its Topics in no particular order (ADR-0010). Sort by name for a stable
reply.

**`POST /api/courses/:id/topics`**

```json
{ "name": "Forces" }
```

→ 201, `Topic`. → 404 if the Course does not exist. → 409 if the Course already holds a Topic of
that name.

### 5.2 Topic

**`GET /api/topics/:id`** → 200, `Topic`. → 404.

**`PATCH /api/topics/:id`**

```json
{ "name": "Forces and motion" }
```

→ 200, `Topic`. → 404. → 409 on a collision inside the same Course.

`courseId` is **not** accepted. Moving a Topic between Courses would move every Class's Assigned
Topic with it. That is a scheduling act, and scheduling is out of scope.

**`DELETE /api/topics/:id`** → 204. → 404.

→ **409** if the Topic holds any Lesson:

```json
{ "error": "This Topic still holds Lessons. Remove or detach them first." }
```

→ **409** if the Topic is assigned to any Class:

```json
{ "error": "This Topic is assigned to a Class, so it cannot be removed." }
```

**`GET /api/topics/:id/lessons`** → 200, `Lesson[]`, ordered by `position`. → 404.

Lessons are ordered within their Topic (ADR-0010), so this order is meaningful and must be kept.

**`POST /api/topics/:id/lessons`**

```json
{ "title": "Balanced and unbalanced forces", "body": null, "length": 1, "status": "draft" }
```

Only `title` is required. `body` defaults to null, `length` to 1, `status` to `"draft"`.

→ 201, `Lesson`, appended at the end of the Topic's order. → 404 if the Topic does not exist.

**There is no 409 here.** Lesson titles are not unique and gain no constraint. One Topic may hold
two Lessons called "Revision".

### 5.3 Lesson

**`GET /api/lessons/:id`** → 200, a Lesson **with its Links**:

```json
{
	"id": "b204...",
	"topicId": "3a77...",
	"title": "Balanced and unbalanced forces",
	"body": "## Starter\n...",
	"status": "draft",
	"length": 1,
	"position": 0,
	"links": [
		{
			"id": "cc90...",
			"lessonId": "b204...",
			"url": "https://...",
			"label": "Simulation",
			"position": 0
		}
	]
}
```

This mirrors `lessonDetail` in `authoring.ts`. The Lesson is the only record whose read includes
its children, because a Lesson without its Links is not the plan.

→ 404.

**`PATCH /api/lessons/:id`**

Accepts `title`, `body`, `length`, `status` and `topicId`. All optional. See section 3.4.

→ 200, `Lesson` (without `links`). → 404 if the Lesson, or a named `topicId`, does not exist.

**`DELETE /api/lessons/:id`** → 204. → 404.

→ **409** if any Class has already been taught the Lesson:

```json
{
	"error": "A Class has already been taught this Lesson, so it cannot be removed. Detach it instead with PATCH /api/lessons/:id and \"topicId\": null."
}
```

This is today's rule, unchanged. The message names the way out, because an agent that gets a bare
refusal will try again rather than detach.

Deleting a Lesson deletes its Links.

**`GET /api/lessons/:id/links`** → 200, `Link[]`, ordered by `position`. → 404.

**`POST /api/lessons/:id/links`**

```json
{ "url": "https://phet.colorado.edu/...", "label": "Forces simulation" }
```

Both required. → 201, `Link`, appended at the end. → 404.

### 5.4 Detach

Detaching is not its own endpoint. It is a PATCH:

```
PATCH /api/lessons/b204...
{ "topicId": null }
```

The Lesson keeps its title, body, Links and Length. It leaves every Class's Lesson stream, because
that stream is reached through `assignedTopic → topic → lesson` and a null `topic_id` cannot join.
Every Session that already taught it still names it. This is ADR-0015.

Detach is allowed whether or not the Lesson has been taught. Delete and Detach are one rule each,
and neither is aware of the other.

Re-attaching is the same call with a real id: `{ "topicId": "3a77..." }`. The Lesson is appended at
the end of the target Topic's order.

Both the old Topic and the new one are re-derived.

### 5.5 Link

**`PATCH /api/links/:id`**

```json
{ "url": "https://...", "label": "Forces simulation" }
```

Both optional. → 200, `Link`. → 404.

**`DELETE /api/links/:id`** → 204. → 404.

There is no `GET /api/links/:id`. A Link is read through its Lesson, which is the only place it
means anything.

### 5.6 Import

**`POST /api/import`**

Creates one Topic, its Lessons, and their Links, in one transaction.

Request:

```json
{
	"course": { "name": "Year 9 Physics" },
	"topic": {
		"name": "Forces",
		"lessons": [
			{
				"title": "Balanced and unbalanced forces",
				"body": "## Starter\n...",
				"length": 1,
				"status": "draft",
				"links": [{ "url": "https://phet.colorado.edu/...", "label": "Forces simulation" }]
			},
			{ "title": "Revision" },
			{ "title": "Revision" }
		]
	}
}
```

`course` takes **exactly one** of `id` or `name`.

- `{ "id": "9f1c..." }` — target that Course. 404 if it does not exist.
- `{ "name": "Year 9 Physics" }` — target the Course of that name if it exists, otherwise create it.

`topic.lessons` may be empty. Each Lesson needs a `title`. `body`, `length`, `status` and `links`
are optional and take the same defaults as `POST /api/topics/:id/lessons`.

Lessons keep their array order as their `position`. Links do the same inside their Lesson.

Response, **201**:

```json
{
	"course": { "id": "9f1c...", "name": "Year 9 Physics" },
	"courseCreated": true,
	"topic": { "id": "3a77...", "name": "Forces", "courseId": "9f1c..." },
	"lessons": [
		{
			"id": "b204...",
			"title": "Balanced and unbalanced forces",
			"position": 0,
			"links": [
				{ "id": "cc90...", "url": "https://...", "label": "Forces simulation", "position": 0 }
			]
		},
		{ "id": "d551...", "title": "Revision", "position": 1, "links": [] },
		{ "id": "e6a2...", "title": "Revision", "position": 2, "links": [] }
	]
}
```

**The response must carry every created Lesson id.** Two Lessons in one Topic may share a title, so
an id is the only way for the caller to name what it just made. `courseCreated` tells the caller
whether it made a Course by accident from a mistyped name.

Failures:

- **404** — `course.id` given and no such Course.
- **409** — the target Course already holds a Topic of that name:
  ```json
  { "error": "The Course \"Year 9 Physics\" already holds a Topic called \"Forces\"." }
  ```
- **400** — any field fails validation, or `course` carries both `id` and `name`, or neither.

**Nothing is committed on a failure.** A collision found on the ninth Lesson leaves no Course, no
Topic, and no Lesson behind. Wrap the whole thing in one `db.transaction`. `bun:sqlite` is
synchronous, so this is a plain synchronous transaction with no partial-await hazard.

Size limits, to keep one request bounded: at most **200** Lessons per Import, and at most **20**
Links per Lesson. Over either is 400.

There is no `PUT` and no merge. Import is create-only. Re-importing a changed Topic means deleting
the Topic and importing again, or hand-editing in the Courses view.

## 6. Uniqueness

These rules apply across several endpoints, so they are set out once here.

### 6.1 The rules

- **Course names are globally unique.**
- **Topic names are unique within their Course.** Two Courses may each hold a "Forces".
- **Lesson titles are not unique and gain no constraint.**

Uniqueness is **case-insensitive**. "Forces" and "forces" collide. The client is an agent, and an
agent that varies its capitalisation between two calls would otherwise make two Topics where the
teacher expects one.

### 6.2 The migration

No constraint exists today. Wayfinder ticket
[#127](https://github.com/edrobertsrayne/planner/issues/127) checked every local SQLite file in the
checkout for Course collisions and for Topic collisions within a Course, case-sensitive and
case-insensitive. It found none. Those are dev and test databases with 0 to 1 rows per table, so
this clears the way for a plain migration but is not a production audit. **Re-run the check against
the live database before applying the migration.**

Two unique indexes, in one migration:

```sql
CREATE UNIQUE INDEX course_name_unique ON course (name COLLATE NOCASE);
CREATE UNIQUE INDEX topic_name_per_course ON topic (course_id, name COLLATE NOCASE);
```

An index needs no table rebuild, so this is safe on tables that other tables reference. See
`docs/agents/migrations.md`.

The same migration makes `lesson.topic_id` nullable, for ADR-0015:

```sql
ALTER TABLE lesson ALTER COLUMN topic_id DROP NOT NULL;
```

That statement is verified on this project's SQLite and needs no table rebuild. Read the SQL
`drizzle-kit` generates and replace any table rebuild with these three statements.

### 6.3 Enforce it in both places

The database index is the guard of last resort. The route handler must still check first and answer
**409** with a readable message. A raw `SQLITE_CONSTRAINT` reaching the client as a 500 is a bug.

The Courses view writes the same tables through the same authoring functions, so the constraint
also applies to the browser. The Courses view must gain the same collision message, or it will show
an unhandled error where it used to succeed.

## 7. What the implementation must build

`src/lib/server/planner/authoring.ts` already holds most of the work as pure functions taking a
Drizzle `Db` handle. Route handlers should call them, not reimplement them. These already exist and
are used as they are:

`listCourses`, `topicsOf`, `lessonsOf`, `createCourse`, `renameCourse`, `createTopic`,
`renameTopic`, `createLesson`, `lessonDetail`, `linksOf`, `createLink`, `updateLink`, `deleteLink`,
`classesTaughtLesson`.

### 7.1 Gaps to fill in `authoring.ts`

| what           | why                                                                                 |
| -------------- | ----------------------------------------------------------------------------------- |
| `courseById`   | No read-one exists. `GET /api/courses/:id` needs it.                                |
| `topicById`    | Same, for `GET /api/topics/:id`.                                                    |
| `deleteCourse` | Does not exist. Must refuse when the Course holds Topics or a Class follows it.     |
| `deleteTopic`  | Does not exist. Must refuse when the Topic holds Lessons or is assigned to a Class. |
| `patchLesson`  | `updateLesson` requires `title`, `body` and `length` together. PATCH is partial.    |
| `importTopic`  | New. One transaction, direct inserts, one `rederiveTopic` at the end.               |

### 7.2 Signatures to change

- **`moveLessonToTopic`** must accept `topicId: string | null`. It currently types it `string`.
  With a null target it sets the column and re-derives the old Topic only.
- **`deleteLesson`** throws `new Error('This Lesson has already been taught…')`. A route handler
  cannot tell that apart from a real fault. Return a discriminated result instead — for example
  `{ ok: false, reason: 'taught' }` — and let the existing Lesson editor map it to the message it
  shows today.

### 7.3 The three joins from ADR-0015

Making `lesson.topic_id` nullable breaks three inner joins. They must become **left** joins, and
`topicName` becomes nullable at each:

- `lessonNames` in `derive.ts` — feeds the Agenda, the Calendar grid, the Class lanes, the at-risk
  report.
- `sessionDetail` in `sessions.ts` — feeds the Session panel.
- `planningStream` in `views.ts` — feeds the Planning tab.

The first two are load-bearing. Left unrepaired they drop a Standalone Lesson's title from exactly
the history ADR-0015 exists to preserve.

Where a Topic name would print, **print nothing**. A Standalone Lesson has no Topic, and a
placeholder such as "(no topic)" would assert otherwise.

### 7.4 Route layout

```
src/routes/api/courses/+server.ts                    GET, POST
src/routes/api/courses/[id]/+server.ts               GET, PATCH, DELETE
src/routes/api/courses/[id]/topics/+server.ts        GET, POST
src/routes/api/topics/[id]/+server.ts                GET, PATCH, DELETE
src/routes/api/topics/[id]/lessons/+server.ts        GET, POST
src/routes/api/lessons/[id]/+server.ts               GET, PATCH, DELETE
src/routes/api/lessons/[id]/links/+server.ts         GET, POST
src/routes/api/links/[id]/+server.ts                 PATCH, DELETE
src/routes/api/import/+server.ts                     POST
```

### 7.5 Documents to update when the work lands

- **`CONTEXT.md`** — the Settings entry says Settings gets no second section. It now has one.
- **A new ADR** — record the API key as a deliberate second authentication mechanism alongside the
  cookie session, and why a personal single-user planner accepts two. This was flagged during
  domain-modeling on map #126 and is not yet written.
- **`.claude/skills/planner-api/SKILL.md`** — move `docs/spec/planning-api-skill.md` into place.

## 8. Tests worth writing

Not a full plan, but the cases that carry the decisions:

- A request with no `Authorization` header gets 401 JSON, **not** a 303 to `/login`.
- A revoked key gets 401.
- Importing a Topic whose ninth Lesson is invalid leaves no Course, no Topic, and no Lesson.
- Importing with `course.name` matching an existing Course reuses it and reports
  `"courseCreated": false`.
- A Topic named "forces" collides with an existing "Forces" in the same Course, and does not
  collide with a "Forces" in a different Course.
- Two Lessons called "Revision" import into one Topic, and the response carries two different ids.
- `DELETE /api/lessons/:id` on a taught Lesson returns 409, and the Lesson is still there.
- `PATCH /api/lessons/:id` with `{"topicId": null}` on a taught Lesson succeeds, and the Session
  that taught it still shows the Lesson title with no Topic name.
- `DELETE /api/courses/:id` on a Course a Class follows returns 409, not 500.
