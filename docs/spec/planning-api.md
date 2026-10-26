# Specification: the Planning HTTP API

Status: **built.** This document describes the API as it runs. It began as the destination of
wayfinder map [#126](https://github.com/edrobertsrayne/planner/issues/126); every decision that map
recorded is now in the code, and the shapes below are read from it.

The companion skill for an agent that calls the API is
[`.agents/skills/planner-api/SKILL.md`](../../.agents/skills/planner-api/SKILL.md).

## 1. Purpose and scope

The API gives an outside agent access to the **Planning** half of the domain: Course, Topic,
Lesson, Link and Attachment. It also reads and replaces the six Terms, and reads, adds and removes
Blocked Days — the Calendar inputs that decide which Sessions exist at all. It does three things.

1. **CRUD.** Create, read, edit and remove one record at a time.
2. **Import.** Create one Topic, with its Lessons and their Links, in a single all-or-nothing
   request.
3. **The Calendar's inputs.** Read and replace the six Terms as one document; add and remove
   Blocked Days by date.

It is one link in a larger workflow the teacher drives. It does not parse lesson plans and it makes
no editorial decision.

### Out of scope

These are ruled out of this effort. They are listed so an implementer does not add them by reflex.

- Everything else in the **Scheduling** half: Class, Timetable, Slot, Session, Sequence, Teaching
  note, Continuation, Readiness, and Blocked Slots. A Sequence has no endpoint: a Lesson reaches a
  Class through the browser. A Standalone Lesson reaches a Class's Sequence only through the
  browser (Add Lesson, ADR-0026). A Blocked Slot is one Class's Slot on one date, so it belongs
  with the Timetable in the browser.
- Reordering: `moveLesson` and `moveLink` get no endpoint. Order is set by creation order.
- Whole-Course Import. Import handles one Topic per request.
- Update-by-reimport. Import is create-only. To change an imported Topic, delete it and import
  again, or edit it in the Courses view. A deleted Topic leaves its old Lessons as Standalone
  Lessons, so a re-import makes new Lessons beside them.
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

`src/hooks.server.ts` never redirects an `/api/*` request: `handleGuard` returns before its redirect
for any `/api` path, so an agent never gets an HTML login page, and the session query is skipped for
the API entirely.

The bearer check is one hook, `handleApiKey`, in the same chain: it checks the key for every
`/api/*` request except `/api/auth/*` and answers 401 JSON when the key is missing or wrong. No
handler checks the key itself, so a new route cannot be left open by forgetting two lines.
`/api/auth/*` is Better Auth's own surface and is not behind the key.

An unknown `/api/*` path therefore answers 401 without a valid key, and 404 only with one.

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

A create returns its record. Only a write that can move a Session returns a report: the response is
the record under its own name, with `report` beside it.

```json
{ "lesson": { "id": "b204...", "title": "..." }, "report": { "placementsMoved": [] } }
```

Two reads wrap their list, because the records have no id: `GET /api/terms` answers
`{ "terms": [...] }` and `GET /api/blocked-days` answers `{ "blockedDays": [...] }`. `PUT
/api/terms` answers the new six in that same wrapper beside its report. Every other list is a bare
array.

An error returns:

```json
{ "error": "A Course called \"Year 9 Physics\" already exists." }
```

The message is one sentence, in Sentence case, and says what happened. It never carries a code, a
stack, or a field path.

### 3.3 Status codes

| code | meaning                                                                         |
| ---- | ------------------------------------------------------------------------------- |
| 200  | Read or edit succeeded. Body is the record or the array.                        |
| 201  | Create succeeded. Body is the new record.                                       |
| 204  | Remove succeeded. No body.                                                      |
| 200  | Remove succeeded and carried a Rewind report: `DELETE /api/blocked-days/:date`. |
| 400  | The body is malformed, a field is missing, or a value is out of range.          |
| 401  | The API key is absent or unknown.                                               |
| 404  | The record named in the path does not exist.                                    |
| 409  | The write collides with an existing record, or is refused as unsafe.            |
| 500  | Unexpected. The message must not leak internals.                                |

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

### 3.5 Unknown fields are ignored

A field not named in this document is read and ignored. The API checks only the fields it reads.
There is no allow-list to keep in step with the seam (ADR-0025).

### 3.6 Validation

The door checks only types. The planner seam owns every value rule, and the forms, the Session
panel and this API share it. A refused value is **400** with the message the teacher sees in the
app.

| field                       | type           | value rule (in the seam)               | refusal                                                                      |
| --------------------------- | -------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Course `name`               | string         | not empty after trimming               | `A Course needs a name.`                                                     |
| Topic `name`                | string         | not empty after trimming               | `A Topic needs a name.`                                                      |
| Lesson `title`              | string         | not empty after trimming               | `A Lesson needs a title.`                                                    |
| Link `label`                | string         | not empty after trimming               | `A Link needs a label.`                                                      |
| Link `url`                  | string         | not empty; an `http:` or `https:` URL  | `A Link needs a url.` / `A Link must be an http(s) URL.`                     |
| `body`                      | string or null | none; a blank body is stored as `null` | —                                                                            |
| `length`                    | number         | a whole number from 1 to 20            | `A Length must be a whole number of Periods from 1 to 20.`                   |
| `status`                    | string         | `"draft"` or `"planned"`               | `A Lesson must be Draft or Planned.`                                         |
| `courseId`, `topicId`, `id` | string         | matching an existing record            | 404                                                                          |
| Term `opens`, `closes`      | string         | a real `YYYY-MM-DD` date               | `"2026-02-30" is not a real date.`                                           |
| Blocked Day `date`          | string         | a real date on a Monday to Friday      | `"2026-11-28" falls on a weekend. A Blocked Day must be a Monday to Friday.` |

A wrong type is **400** `The "<field>" field must be a string.` (or `a number`, or `a string or
null`). There are no size limits: the request body limit bounds every request.

The seam trims every name, title, label and url, and stores the trimmed value. It never trims a
`body`: Markdown gives whitespace meaning. `"  Forces  "` and `"Forces"` are the same Topic name
and must collide.

### 3.7 The current date

`editLesson` and `deleteLesson` take a `today` argument and re-derive the Classes that hold or
Place the Lesson. Route handlers must supply it from the server clock, in the school's
local date, exactly as the existing form actions do. It is never a request field. An agent must not
be able to move the planner's idea of today.

### 3.8 Re-derivation

Each Class holds its own Sequence of Lessons (ADR-0026). A write to the Topic's Lessons changes no
Sequence, so it moves no date: creating a Lesson, filing it, and the order of a Topic's Lessons
re-derive nothing. A change of a Lesson's Length re-derives each Class that holds the Lesson in its
Sequence or by a Placement.

**Import re-derives nothing.** A new Topic is in no Sequence, so no Class has a date to change.

**Replacing the Terms re-derives every Class from the first Term that changed** (§5.7). A Term
decides which weeks are Teaching Weeks and so which Week letter each one carries; a save that
changes no Term re-derives nothing at all.

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

**Term**

```json
{ "name": "Autumn 1", "opens": "2026-09-03", "closes": "2026-10-23" }
```

A Term has no id and is never addressed on its own: the six are one document, and `name` is
derived from position in date order (Autumn 1 through Summer 2), never stored and never accepted.

**Blocked Day**

```json
{ "date": "2026-11-26", "note": "INSET" }
```

A Blocked Day has no id either: it is addressed by `date`. `note` is nullable.

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
{
	"error": "Delete KS3 Science? Its 2 Topics go. Its 12 Lessons become Standalone Lessons. Every Class keeps them in its Sequence."
}
```

→ **409** if any Class follows the Course:

```json
{ "error": "A Class follows this Course, so it cannot be removed." }
```

A Course with no Topics that no Class follows goes at once. There is no cascade: a Course is a
year's worth of writing and must not go in one call. The Class check is not optional:
`class.course_id` is a `NOT NULL` foreign key, so the delete would fail at the database anyway and
produce a 500 instead of a clear 409.

**`GET /api/courses/:id/topics`** → 200, `Topic[]`, ordered by name. → 404.

A Course holds its Topics in no particular order (ADR-0010); the route sorts by name so the reply
is stable.

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

`courseId` is **not** accepted. The browser can file a Topic in another Course (`moveTopicToCourse`,
Move to… on the Course page). The API does not expose it.

**`DELETE /api/topics/:id`** → 204. → 404.

→ **409** if the Topic holds any Lesson:

```json
{
	"error": "Delete Forces? Its 12 Lessons become Standalone Lessons. Every Class keeps them in its Sequence."
}
```

The API has no confirm, so a Topic with Lessons is refused. In the browser, Delete Topic asks
first and then detaches: the Lessons become Standalone Lessons, and every Sequence keeps them.

**`GET /api/topics/:id/lessons`** → 200, `Lesson[]`, ordered by `position`. → 404.

Lessons are ordered within their Topic (ADR-0010), so this order is meaningful and must be kept.

**`POST /api/topics/:id/lessons`**

```json
{ "title": "Balanced and unbalanced forces", "body": null, "length": 1, "status": "draft" }
```

Only `title` is required. `body` defaults to null, `length` to 1, `status` to `"draft"`.

→ 201, the `Lesson` record, appended at the end of the Topic's order. A new Lesson is in no
Sequence and has no Placement, so it moves no date: there is no report. → 404 if the Topic does not
exist.

**There is no 409 here.** Lesson titles are not unique and gain no constraint. One Topic may hold
two Lessons called "Revision".

### 5.3 Lesson

**`GET /api/lessons/:id`** → 200, the **whole Lesson** — its Topic and Course, Links, Tags and
Attachments:

```json
{
	"id": "b204...",
	"topicId": "3a77...",
	"title": "Balanced and unbalanced forces",
	"body": "## Starter\n...",
	"status": "draft",
	"length": 1,
	"position": 0,
	"topic": { "id": "3a77...", "name": "Forces", "courseId": "9c11..." },
	"course": { "id": "9c11...", "name": "KS3 Science" },
	"tags": [{ "id": "f2a1...", "name": "Practical" }],
	"links": [
		{
			"id": "cc90...",
			"lessonId": "b204...",
			"url": "https://...",
			"label": "Simulation",
			"position": 0
		}
	],
	"attachments": [
		{
			"id": "e1f0...",
			"lessonId": "b204...",
			"filename": "worksheet.pdf",
			"mimeType": "application/pdf",
			"size": 48213,
			"position": 0
		}
	]
}
```

`topic` and `course` are `null` for a Standalone Lesson, and `course` is `null` for a Topic with no
Course. `tags` carries each Tag's id as well as its name, so the editor can detach one. This is
`lessonDetail` in the planner seam, the same read the Lesson editor and the Session page use; the
Lesson is the only record whose read includes its children, because a Lesson without its Links is
not the plan.

→ 404.

**`PATCH /api/lessons/:id`**

Accepts `title`, `body`, `length`, `status` and `topicId`. All optional. See section 3.4.

→ 200, `{ "lesson": Lesson, "report": { "placementsMoved": [...] } }`. The
`Lesson` has no `links`. `report` is the report of the change; the list is empty when
the change moves no Placement. A change that sets nothing is a no-op: it returns the stored Lesson and an
empty report. → 404 if the Lesson, or a named `topicId`, does not exist.
A `topicId` that names a Topic files the Lesson there, at the end of the Topic's order, whether the
Lesson was in another Topic or Standalone. Filing changes no Sequence and no Placement.

**`DELETE /api/lessons/:id`** → 204. → 404.

→ **409** if any Class has already been taught the Lesson:

```json
{
	"error": "A Class has already been taught this Lesson, so it cannot be removed."
}
```

This is today's rule, unchanged. Detach no longer helps: a Detach files the Lesson and leaves it in
every Sequence, so the message does not suggest it. A Standalone Lesson gets the same message.

→ **409** if a Placement names the Lesson (ADR-0022):

```json
{ "error": "A Placement names this Lesson, so it cannot be removed. Remove the Placement first." }
```

→ **409** if the Sequence of any Class holds the Lesson (ADR-0026). The error names the Classes. The
API has no confirm; in the browser, Delete Lesson asks first and then deletes the Lesson with its
entries, its Readiness and its Teaching notes:

```json
{ "error": "This Lesson is in 9B/Sc1 and 9C/Sc1's Sequences. Delete it?" }
```

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

The Lesson keeps its title, body, Links and Length. It changes no Sequence: every Class that holds
the Lesson in its Sequence keeps it, with its Readiness and its Teaching note, and a Placement of it
stays. Every Session that already taught it still names it. This is ADR-0015 and ADR-0026.

Detach is allowed whether or not the Lesson has been taught. Delete and Detach are one rule each,
and neither is aware of the other.

> **Amended (ADR-0026).** Detach is two-way. `{ "topicId": "3a77..." }` on a Standalone Lesson files
> it in that Topic, at the end of the Topic's order, and answers 200. Filing changes no Sequence,
> Readiness or Placement, so no date moves.

### 5.5 Link

**`PATCH /api/links/:id`**

```json
{ "url": "https://...", "label": "Forces simulation" }
```

Both optional. → 200, `Link`. → 404.

**`DELETE /api/links/:id`** → 204. → 404.

There is no `GET /api/links/:id`. A Link is read through its Lesson, which is the only place it
means anything.

### 5.5.1 Attachment

**`POST /api/lessons/:id/attachments`**

`multipart/form-data` with one `file` field. It applies the same allow-list (PDF, .md, .txt, .docx,
.pptx, .xlsx), the same 10 MiB ceiling and the same extension/MIME mismatch refusal as the Lesson
editor, because both call `createAttachment`. → 201, the Attachment row (`id`, `lessonId`,
`filename`, `mimeType`, `size`, `position`), appended at the end. → 404 if the Lesson does not
exist. → 400 `{ "error" }` if there is no `file` field, the file has no name, or the file is
refused; the message is the refusal's own. A refused upload writes no row and no file.

**`DELETE /api/attachments/:id`** → 204. It removes the row and the file on disk. → 404.

An Attachment is read through its Lesson (`attachments` on `GET /api/lessons/:id`, in `position`
order). There is no list or download endpoint: downloads stay browser-only at `/attachments/:id`.
Import does not take Attachments. An Attachment write never changes the schedule.

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
	],
	"report": { "placementsMoved": [] }
}
```

**The response must carry every created Lesson id.** Two Lessons in one Topic may share a title, so
an id is the only way for the caller to name what it just made. `courseCreated` tells the caller
whether it made a Course by accident from a mistyped name. `report` is the report of the
import. A new Topic is in no Sequence, so it is always empty.

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

There is no `PUT` and no merge. Import is create-only. Re-importing a changed Topic means deleting
the Topic and importing again, or hand-editing in the Courses view. The deleted Topic's old Lessons
stay as Standalone Lessons, and every Sequence keeps them.

### 5.7 Terms

**`GET /api/terms`** → 200, `{ "terms": Term[] }` in date order — the six of the year, or an empty
list before a year has been set up.

**`PUT /api/terms`**

```json
{
	"terms": [
		{ "opens": "2026-09-03", "closes": "2026-10-23" },
		{ "opens": "2026-11-02", "closes": "2026-12-22" },
		{ "opens": "2027-01-05", "closes": "2027-02-12" },
		{ "opens": "2027-02-22", "closes": "2027-03-26" },
		{ "opens": "2027-04-19", "closes": "2027-05-28" },
		{ "opens": "2027-06-07", "closes": "2027-07-19" }
	]
}
```

The six replaced as one document, in any order; extra fields are ignored. → 200,
`{ "terms": Term[], "report": { "placementsMoved": [] } }` — the six in date order with their
derived names, and the Rewind's report beside them, because a Term change can move a Session.

Refusals are the seam's, and the first one wins:

- **400** — `A year needs exactly six Terms, and 5 were given.`
- **400** — `"2026-02-30" is not a real date.`
- **400** — `A Term cannot open after it closes: opens 2027-07-19, closes 2027-06-07.`
- **400** — `Terms cannot overlap or touch: one closes 2027-06-07, the next opens 2027-06-07.`

There is no POST and no DELETE: a Term is never created or removed on its own.

### 5.8 Blocked Days

**`GET /api/blocked-days`** → 200, `{ "blockedDays": [{ "date": "2026-11-26", "note": "INSET" }] }`
in date order, across the whole year, with no ids — the date is the address.

**`POST /api/blocked-days`**

```json
{ "date": "2026-11-26", "note": "INSET" }
```

`date` is required and `note` optional (stored trimmed; absent is `null`). → 201,
`{ "blockedDay": { "date": "...", "note": "..." }, "report": { "placementsMoved": [] } }` — the
stored day beside the Rewind's report, because blocking a day can move a Placement.

- **400** — `The "date" field is required.` (also when it is not a string).
- **400** — `"2026-11-28" falls on a weekend. A Blocked Day must be a Monday to Friday.`
- **409** — `"2026-11-26" is already a Blocked Day.`

**`DELETE /api/blocked-days/:date`** → 200, `{ "report": { "placementsMoved": [] } }`. → 404
`No such Blocked Day.` When the date is not blocked. This is the one remove that answers a body:
unblocking a day re-derives the Classes it held, and that report can name moved Placements.

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

Wayfinder ticket [#127](https://github.com/edrobertsrayne/planner/issues/127) checked every local
SQLite file in the checkout for Course collisions and for Topic collisions within a Course,
case-sensitive and case-insensitive. It found none, and the migration shipped with the API. The
same migration makes `lesson.topic_id` nullable, for ADR-0015.

Two unique indexes:

```sql
CREATE UNIQUE INDEX course_name_unique ON course (name COLLATE NOCASE);
CREATE UNIQUE INDEX topic_name_per_course ON topic (course_id, name COLLATE NOCASE);
```

An index needs no table rebuild, so this is safe on tables that other tables reference. See
`docs/agents/migrations.md`.

The same migration made `lesson.topic_id` nullable, with plain `ALTER TABLE ... ALTER COLUMN ...
DROP NOT NULL` and no table rebuild.

### 6.3 Enforce it in both places

The database index is the guard of last resort. The route handler must still check first and answer
**409** with a readable message. A raw `SQLITE_CONSTRAINT` reaching the client as a 500 is a bug.

The Courses view writes the same tables through the same seam functions, so the rule applies to the
browser too, and it shows the same collision message.

## 7. As built

The rules live in the planner seam (`src/lib/server/planner/`), not in the routes: the routes
narrow types and map `Refused` to a status (ADR-0025). The modules:

- `courses.ts` — Courses and Topics, the whole-Course and whole-Topic deletes.
- `lessons.ts` — Lessons, `lessonDetail` (the whole-Lesson read) and the delete rules.
- `links.ts`, `tags.ts` — Links and Tags.
- `import.ts` — one Topic, its Lessons and their Links, in one transaction.
- `terms.ts` — the six as one document.
- `disruptions.ts` — Blocked Days and Blocked Slots; the API uses the Blocked Day half.
- `attachments.ts` — the allow-list, the size ceiling, the file on disk.

Routes:

```
src/routes/api/courses/+server.ts                    GET, POST
src/routes/api/courses/[id]/+server.ts               GET, PATCH, DELETE
src/routes/api/courses/[id]/topics/+server.ts        GET, POST
src/routes/api/topics/[id]/+server.ts                GET, PATCH, DELETE
src/routes/api/topics/[id]/lessons/+server.ts        GET, POST
src/routes/api/lessons/[id]/+server.ts               GET, PATCH, DELETE
src/routes/api/lessons/[id]/links/+server.ts         GET, POST
src/routes/api/links/[id]/+server.ts                 PATCH, DELETE
src/routes/api/lessons/[id]/attachments/+server.ts   POST
src/routes/api/attachments/[id]/+server.ts           DELETE
src/routes/api/terms/+server.ts                      GET, PUT
src/routes/api/blocked-days/+server.ts               GET, POST
src/routes/api/blocked-days/[date]/+server.ts        DELETE
src/routes/api/import/+server.ts                     POST
```

The key check is one hook (`handleApiKey` in `src/hooks.server.ts`, §2.5), and each successful API
write leaves one line in the container log.

## 8. Tests

Over real HTTP, one file per area, under `e2e/the-planning-api/`: the key gate and the Course
endpoints (`10-courses`), Topics (`20-topics`), Lessons (`30-lessons`), Links and Attachments
(`40-links`, `45-attachments`), Import (`50-import`), the refusals shared across the API
(`60-refusals`), Blocked Days (`70-blocked-days`), Terms (`80-terms`) and the key itself
(`90-the-key`). Run them with `bun run test:e2e -- e2e/the-planning-api`.

Each file resets the database to the standard state and creates the records it reads, so any file
runs alone.
