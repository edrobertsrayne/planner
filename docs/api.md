# Planning API reference

The Planning API gives an outside agent access to the planning half of the planner: Courses,
Topics, Lessons, Links and Attachments, plus the six Terms and the Blocked Days that decide which
Sessions exist. It is plain JSON over HTTP under `/api`.

This is the reference. [spec/planning-api.md](spec/planning-api.md) is the design document it was
built from and carries the reasoning; where the two differ, this file and the code win. Domain
terms (Standalone Lesson, Detach, Placement, Rewind, Absence) are defined in
[GLOSSARY.md](../GLOSSARY.md).

## What is not in the API

Classes, Timetables, Slots, Sessions, Sequences, Teaching notes, Continuations, Readiness, Blocked
Slots, Events and Covers are browser-only. So are reordering Lessons or Links, moving a Topic to
another Course, Attachment downloads, key management, Backup and Restore. Import creates only; it
never updates.

## Contents

- [Authentication](#authentication)
- [Conventions](#conventions)
- [Records](#records)
- [Endpoints](#endpoints): [Courses](#courses) · [Topics](#topics) · [Lessons](#lessons) ·
  [Links](#links) · [Attachments](#attachments) · [Import](#import) · [Terms](#terms) ·
  [Blocked Days](#blocked-days)
- [Errors](#errors)
- [Uniqueness](#uniqueness)
- [Worked example](#worked-example)
- [Browser-only HTTP routes](#browser-only-http-routes)

## Authentication

Every request under `/api` (except `/api/auth/*`, which belongs to Better Auth) must carry the API
key as a bearer token:

```http
Authorization: Bearer pln_8Kq2mV...
```

- There is one key for the account. It is minted the first time **Settings** is opened and shown in
  full on the **API key** card, with Copy and Regenerate buttons.
- Regenerating replaces the key at once; the old token stops working immediately. That is the only
  way to revoke it.
- A token is `pln_` plus 43 base64url characters (32 random bytes).
- A missing header, a malformed header and an unknown token all answer the same:

```http
HTTP/1.1 401 Unauthorized
{ "error": "Give a valid API key in the Authorization header." }
```

- An unknown `/api/...` path answers 401 without a valid key and 404 with one.
- The key cannot be created, read or rotated over HTTP.
- The session cookie is not accepted on `/api`, and the API never redirects to a login page.

Every accepted request stamps the key's `last_used_at` (shown in Settings). Every successful
(2xx) non-`GET` request writes one line, `METHOD /path STATUS`, to the server's standard output.
Bodies are never logged.

## Conventions

**Content type.** Send `Content-Type: application/json` for every request with a body, except
[attachment upload](#attachments), which is `multipart/form-data`. A body that does not parse, or
parses to anything but an object, is `400 The body must be a JSON object.`

**Responses.** No envelope: a success returns the record or array directly. Exceptions:

- `GET /api/terms` returns `{ "terms": [...] }` and `GET /api/blocked-days` returns
  `{ "blockedDays": [...] }`, because those records have no ids.
- A write that can move a Session returns the record under its own name beside a
  [`report`](#the-report).

**Status codes.**

| Code | Meaning                                                                            |
| ---- | ---------------------------------------------------------------------------------- |
| 200  | Read or edit succeeded                                                             |
| 201  | Create succeeded; body is the new record                                           |
| 204  | Delete succeeded; no body (`DELETE /api/blocked-days/:date` answers 200)           |
| 400  | Malformed body, wrong field type, or a value the planner's rules refuse            |
| 401  | Key missing, malformed or unknown                                                  |
| 404  | The record named in the URL (or a `topicId` / `course.id` in the body) is wrong    |
| 409  | The id is right and the write is refused: a name clash, or a delete that is unsafe |
| 413  | Request body over 12 MiB                                                           |
| 500  | Unexpected fault; message does not leak internals                                  |

**Errors** are always `{ "error": "<one sentence>" }`. See [Errors](#errors).

**PATCH is partial.** Only fields present in the body change. For nullable fields, absent and
`null` differ: `"body": null` clears the body; omitting `body` leaves it. `"topicId": null`
[Detaches](#detach) the Lesson; omitting `topicId` leaves it where it is. A PATCH that sets nothing
returns 200 and the stored record.

**Unknown fields are ignored.** Fields not documented here are read and dropped, never an error.
Read-only fields (`id`, `position`, `courseId` on a Topic) are among them.

**Validation.** The API checks only types; the planner's own rules check values, and the messages
are the ones the teacher sees in the app. Names, titles, labels and URLs are trimmed before they
are stored. A `body` is never trimmed, and a blank one is stored as `null`.

| Field                 | Type           | Rule                                       |
| --------------------- | -------------- | ------------------------------------------ |
| Course/Topic `name`   | string         | not empty after trimming                   |
| Lesson `title`        | string         | not empty after trimming                   |
| Lesson `body`         | string or null | none                                       |
| Lesson `length`       | number         | whole number of Periods, 1 to 20           |
| Lesson `status`       | string         | `"draft"` or `"planned"`                   |
| Link `label`          | string         | not empty after trimming                   |
| Link `url`            | string         | not empty; an `http:` or `https:` URL      |
| Term `opens`/`closes` | string         | a real `YYYY-MM-DD` date                   |
| Blocked Day `date`    | string         | a real `YYYY-MM-DD` date, Monday to Friday |

A wrong JSON type is `400 The "<field>" field must be a string.` (or `a number`, `a boolean`,
`a string or null`).

**Time.** The planner decides "today" from the server clock. It is never a request field.

### The report

A write that can change the schedule answers with `report`:

```json
{
	"placementsMoved": [
		{
			"placementId": "…",
			"classId": "…",
			"classLabel": "9B/Sc1",
			"lessonTitle": "Revision",
			"anchorDate": "2026-11-26",
			"anchorPeriod": 3,
			"date": "2026-11-27",
			"period": 1
		}
	]
}
```

Each entry is a Placement whose chosen slot has been taken, with the anchor the teacher chose and
where it landed. `stranded: true` is added when no Slot at or after the anchor remains; `date` and
`period` then repeat the anchor. The list is empty when nothing moved, which is the usual case.
Creating a Lesson, filing it in a Topic and Import never move anything. A Length change, a Terms
replacement and blocking or unblocking a day can.

## Records

Ids are UUID strings.

**Course** `{ "id", "name" }`

**Topic** `{ "id", "name", "courseId" }`

**Lesson**

```json
{
	"id": "b204…",
	"topicId": "3a77…",
	"title": "Balanced and unbalanced forces",
	"body": "## Starter\n…",
	"status": "draft",
	"length": 1,
	"position": 0
}
```

`topicId` is `null` for a Standalone Lesson. `body` is `null` when empty. `position` is the
Lesson's order inside its Topic and is read-only.

**Link** `{ "id", "lessonId", "url", "label", "position" }`

**Attachment** `{ "id", "lessonId", "filename", "mimeType", "size", "position" }`

**Term** `{ "name", "opens", "closes" }`. `name` is derived from date order (`Autumn 1`,
`Autumn 2`, `Spring 1`, `Spring 2`, `Summer 1`, `Summer 2`), never stored and never accepted.

**Blocked Day** `{ "date", "note", "absent" }`. No id: the date is its address. `note` is nullable.
`absent` is `true` when the day is the teacher's own Absence rather than a closure (ADR-0030).

## Endpoints

| Method | Path                           | Purpose                                 | Success |
| ------ | ------------------------------ | --------------------------------------- | ------- |
| GET    | `/api/courses`                 | List Courses, by name                   | 200     |
| POST   | `/api/courses`                 | Create a Course                         | 201     |
| GET    | `/api/courses/:id`             | Read a Course                           | 200     |
| PATCH  | `/api/courses/:id`             | Rename a Course                         | 200     |
| DELETE | `/api/courses/:id`             | Delete an empty Course                  | 204     |
| GET    | `/api/courses/:id/topics`      | List a Course's Topics, by name         | 200     |
| POST   | `/api/courses/:id/topics`      | Create a Topic                          | 201     |
| GET    | `/api/topics/:id`              | Read a Topic                            | 200     |
| PATCH  | `/api/topics/:id`              | Rename a Topic                          | 200     |
| DELETE | `/api/topics/:id`              | Delete a Topic with no Lessons          | 204     |
| GET    | `/api/topics/:id/lessons`      | List a Topic's Lessons, in order        | 200     |
| POST   | `/api/topics/:id/lessons`      | Create a Lesson at the end of the Topic | 201     |
| GET    | `/api/lessons/:id`             | Read a whole Lesson                     | 200     |
| PATCH  | `/api/lessons/:id`             | Edit, file or Detach a Lesson           | 200     |
| DELETE | `/api/lessons/:id`             | Delete a Lesson                         | 204     |
| GET    | `/api/lessons/:id/links`       | List a Lesson's Links, in order         | 200     |
| POST   | `/api/lessons/:id/links`       | Add a Link                              | 201     |
| PATCH  | `/api/links/:id`               | Edit a Link                             | 200     |
| DELETE | `/api/links/:id`               | Remove a Link                           | 204     |
| POST   | `/api/lessons/:id/attachments` | Upload a file to a Lesson               | 201     |
| DELETE | `/api/attachments/:id`         | Remove an Attachment and its file       | 204     |
| POST   | `/api/import`                  | Create one Topic with Lessons and Links | 201     |
| GET    | `/api/terms`                   | Read the six Terms                      | 200     |
| PUT    | `/api/terms`                   | Replace the six Terms                   | 200     |
| GET    | `/api/blocked-days`            | List Blocked Days                       | 200     |
| POST   | `/api/blocked-days`            | Block a day                             | 201     |
| DELETE | `/api/blocked-days/:date`      | Unblock a day                           | 200     |

URLs are flat. Nesting appears only to list or create a child. A missing `:id` is `404` with
`Course not found.`, `Topic not found.`, `Lesson not found.`, `Link not found.` or
`Attachment not found.`.

### Courses

**`GET /api/courses`** → `200 Course[]`, ordered by name. Use this to find an id from a name.

**`POST /api/courses`** `{ "name": "Year 9 Physics" }` → `201 Course`.
`409` if the name is taken (case-insensitive).

**`GET /api/courses/:id`** → `200 Course`.

**`PATCH /api/courses/:id`** `{ "name": "Year 9 Combined Science" }` → `200 Course`.
`409` on a name clash.

**`DELETE /api/courses/:id`** → `204`. There is no cascade. `409` if the Course holds any Topic
(`Delete KS3 Science? Its 2 Topics go. …`) or any Class follows it
(`A Class follows this Course, so it cannot be removed.`). Delete or move the Topics first.

### Topics

**`GET /api/courses/:id/topics`** → `200 Topic[]`, ordered by name. `404` if the Course is missing.

**`POST /api/courses/:id/topics`** `{ "name": "Forces" }` → `201 Topic`. `404` if the Course is
missing. `409` if the Course already holds a Topic of that name.

**`GET /api/topics/:id`** → `200 Topic`.

**`PATCH /api/topics/:id`** `{ "name": "Forces and motion" }` → `200 Topic`. `409` on a name clash
inside the Course. `courseId` is ignored: the API cannot move a Topic between Courses.

**`DELETE /api/topics/:id`** → `204`. `409` if the Topic holds any Lesson. (In the browser, deleting
a Topic asks first and turns its Lessons into Standalone Lessons; the API has no confirm, so it
refuses.)

**`GET /api/topics/:id/lessons`** → `200 Lesson[]`, ordered by `position`. `404` if the Topic is
missing.

**`POST /api/topics/:id/lessons`**

```json
{ "title": "Balanced and unbalanced forces", "body": null, "length": 1, "status": "draft" }
```

Only `title` is required. Defaults: `body` `null`, `length` `1`, `status` `"draft"`.
→ `201 Lesson`, appended at the end of the Topic. No `409`: Lesson titles are not unique.

### Lessons

**`GET /api/lessons/:id`** → `200`, the whole Lesson, including its Topic, Course, Tags, Links and
Attachments. The Lesson is the one record whose read includes its children.

```json
{
	"id": "b204…",
	"topicId": "3a77…",
	"title": "Balanced and unbalanced forces",
	"body": "## Starter\n…",
	"status": "draft",
	"length": 1,
	"position": 0,
	"topic": { "id": "3a77…", "name": "Forces", "courseId": "9c11…" },
	"course": { "id": "9c11…", "name": "KS3 Science" },
	"tags": [{ "id": "f2a1…", "name": "Practical" }],
	"links": [
		{ "id": "cc90…", "lessonId": "b204…", "url": "https://…", "label": "Simulation", "position": 0 }
	],
	"attachments": [
		{
			"id": "e1f0…",
			"lessonId": "b204…",
			"filename": "worksheet.pdf",
			"mimeType": "application/pdf",
			"size": 48213,
			"position": 0
		}
	]
}
```

`topic` and `course` are `null` for a Standalone Lesson. Tags are read-only in the API.

**`PATCH /api/lessons/:id`** Accepts any of `title`, `body`, `length`, `status`, `topicId`.

→ `200 { "lesson": Lesson, "report": Report }`. The `lesson` has no children. Only a change of
`length` can move a date, so `report.placementsMoved` is empty otherwise.

`404` if the Lesson, or a `topicId` that names no Topic, does not exist.

#### Detach

There is no Detach endpoint. Detaching is a PATCH:

```sh
curl -X PATCH "$BASE/api/lessons/$ID" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{ "topicId": null }'
```

The Lesson keeps its title, body, Links, Length, Attachments and every Class's Sequence entry,
Readiness, Placement and Teaching note. `{ "topicId": "<topic id>" }` on a Standalone Lesson files
it in that Topic, at the end of the Topic's order. Neither moves a date.

**`DELETE /api/lessons/:id`** → `204`. Removes its Links and Attachment files too. `409` when:

| Reason                      | Message                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------- |
| A Class has been taught it  | `A Class has already been taught this Lesson, so it cannot be removed.`               |
| A Placement names it        | `A Placement names this Lesson, so it cannot be removed. Remove the Placement first.` |
| A Class's Sequence holds it | `This Lesson is in 9B/Sc1 and 9C/Sc1's Sequences. Delete it?` (names the Classes)     |

Other refusals follow the same pattern (for example a Cover that names it, ADR-0030). The API
has no confirm: to delete such a Lesson, remove it from the Sequences in the browser first.

### Links

**`GET /api/lessons/:id/links`** → `200 Link[]`, ordered by `position`.

**`POST /api/lessons/:id/links`** `{ "url": "https://…", "label": "Forces simulation" }`, both
required → `201 Link`, appended at the end. `404` if the Lesson is missing.

**`PATCH /api/links/:id`** `{ "url": …, "label": … }`, both optional → `200 Link`.

**`DELETE /api/links/:id`** → `204`. There is no `GET /api/links/:id`; read Links through their
Lesson.

### Attachments

**`POST /api/lessons/:id/attachments`** is `multipart/form-data` with one `file` field.

```sh
curl -X POST "$BASE/api/lessons/$ID/attachments" -H "$AUTH" -F 'file=@worksheet.pdf'
```

→ `201 Attachment`, appended at the end. The same rules as the Lesson editor apply:

- Allowed extensions: `.pdf`, `.md`, `.txt`, `.docx`, `.pptx`, `.xlsx`.
- Maximum 10 MB (10 MiB) per file.
- The declared MIME type must match the extension. `.pdf` accepts only `application/pdf`; the
  others also accept `application/octet-stream`.

`400` if there is no `file` field, the file has no name, or it is refused (the message says why).
`404` if the Lesson is missing. A refused upload leaves no row and no file.

**`DELETE /api/attachments/:id`** → `204`. Removes the row and the file.

Attachments are read through `attachments` on `GET /api/lessons/:id`. There is no list or download
endpoint in the API; the browser downloads at [`/attachments/:id`](#browser-only-http-routes).
Import does not take Attachments.

### Import

**`POST /api/import`** creates one Topic, its Lessons and their Links in a single transaction.

```json
{
	"course": { "name": "Year 9 Physics" },
	"topic": {
		"name": "Forces",
		"lessons": [
			{
				"title": "Balanced and unbalanced forces",
				"body": "## Starter\n…",
				"length": 1,
				"status": "draft",
				"links": [{ "url": "https://phet.colorado.edu/…", "label": "Forces simulation" }]
			},
			{ "title": "Revision" }
		]
	}
}
```

- `course` takes **exactly one** of `id` (must exist, else `404`) or `name` (use the Course of that
  name, creating it if absent).
- `topic.name` is required; `topic.lessons` may be empty or omitted.
- Each Lesson needs a `title`; `body`, `length`, `status` and `links` are optional with the same
  defaults as creating a Lesson. Array order becomes `position`.

→ `201`:

```json
{
	"course": { "id": "9f1c…", "name": "Year 9 Physics" },
	"courseCreated": true,
	"topic": { "id": "3a77…", "name": "Forces", "courseId": "9f1c…" },
	"lessons": [
		{
			"id": "b204…",
			"title": "Balanced and unbalanced forces",
			"position": 0,
			"links": [{ "id": "cc90…", "url": "https://…", "label": "Forces simulation", "position": 0 }]
		},
		{ "id": "d551…", "title": "Revision", "position": 1, "links": [] }
	],
	"report": { "placementsMoved": [] }
}
```

Keep the returned Lesson ids: titles are not unique, so an id is the only way to name a Lesson you
just made. `courseCreated` tells you whether a mistyped name created a new Course.

Failures: `404` for an unknown `course.id`; `409` if the Course already holds a Topic of that name;
`400` for any invalid field, or `course` with both or neither of `id` and `name`. **Nothing is
committed on a failure.** Import never updates. To change an imported Topic, edit its Lessons, or
delete the Topic (its Lessons become Standalone Lessons) and import again.

### Terms

**`GET /api/terms`** → `200 { "terms": Term[] }`, in date order. The list is empty until a year has
been set up.

**`PUT /api/terms`** replaces all six as one document, in any order. Extra fields are ignored.

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

→ `200 { "terms": Term[], "report": Report }`. Every Class is re-derived from the first Term that
changed; a save that changes nothing re-derives nothing. `400` refusals, first one wins:

- `A year needs exactly six Terms, and 5 were given.`
- `"2026-02-30" is not a real date.`
- `A Term cannot open after it closes: opens 2027-07-19, closes 2027-06-07.`
- `Terms cannot overlap or touch: one closes 2027-06-07, the next opens 2027-06-07.`

A non-array `terms` is treated as an empty list (so the six-Terms refusal applies); an element that
is not an object is `400 The "terms" field must be an array of Term objects.`

There is no POST or DELETE: a Term is never created or removed on its own.

### Blocked Days

A Blocked Day removes a whole day's Sessions; the schedule shifts right to fill the gap.

**`GET /api/blocked-days`** → `200 { "blockedDays": BlockedDay[] }`, in date order across the year.

**`POST /api/blocked-days`**

```json
{ "date": "2026-11-26", "note": "INSET", "absent": false }
```

`date` is required. `note` is optional, a string or `null`. `absent` is optional and defaults to
`false`; `true` makes the day an Absence, which offers a Cover for each Class in the browser.
→ `201 { "blockedDay": BlockedDay, "report": Report }`.

- `400 The "date" field is required.` (also when it is not a string)
- `400 The "note" field must be a string.`
- `400 The "absent" field must be a boolean.`
- `400 "2026-11-28" falls on a weekend. A Blocked Day must be a Monday to Friday.`
- `409 "2026-11-26" is already a Blocked Day.`

**`DELETE /api/blocked-days/:date`** → `200 { "report": Report }`. `404 No such Blocked Day.` if the
date is not blocked. It is the one delete that answers with a body, because unblocking a day
re-derives the Classes and may move Placements.

## Errors

All errors are `{ "error": "…" }` with a one-sentence message and no code, stack or field path.

| Source                                                                                | Status |
| ------------------------------------------------------------------------------------- | ------ |
| Wrong JSON type, missing required field                                               | 400    |
| Value rule refused (empty name, bad URL, Length out of range, bad date, bad Term set) | 400    |
| Upload refused (type, size, MIME mismatch, no file)                                   | 400    |
| Id in the URL names no record                                                         | 404    |
| `topicId` or `course.id` in the body names no record                                  | 404    |
| Name already taken                                                                    | 409    |
| Delete refused as unsafe                                                              | 409    |
| Body over 12 MiB                                                                      | 413    |

`404` means "this id is wrong"; `409` means "this id is right and the write is refused". They are
never merged. A raw database constraint error should never reach a client; if you see a `500` from
the API, it is a bug.

## Uniqueness

- Course names are unique across the planner.
- Topic names are unique within their Course (two Courses may each hold a "Forces").
- Lesson titles are not unique.

Comparison is case-insensitive and trimmed: `Forces`, `forces` and `Forces` are the same name.

## Worked example

```sh
BASE=https://planner.example.com
AUTH="Authorization: Bearer $PLANNER_API_KEY"
JSON='Content-Type: application/json'

# Import a Topic, creating the Course if needed.
curl -sS -X POST "$BASE/api/import" -H "$AUTH" -H "$JSON" -d '{
  "course": { "name": "Year 9 Physics" },
  "topic": { "name": "Forces", "lessons": [{ "title": "Balanced forces" }, { "title": "Revision" }] }
}'

# Add a worksheet to the first Lesson, then fill in its plan.
LESSON=$(curl -sS "$BASE/api/topics/$TOPIC/lessons" -H "$AUTH" | jq -r '.[0].id')
curl -sS -X POST "$BASE/api/lessons/$LESSON/attachments" -H "$AUTH" -F 'file=@balanced-forces.pdf'
curl -sS -X PATCH "$BASE/api/lessons/$LESSON" -H "$AUTH" -H "$JSON" \
  -d '{ "body": "## Starter\nRecap resultant force.", "status": "planned", "length": 2 }'

# Block an INSET day.
curl -sS -X POST "$BASE/api/blocked-days" -H "$AUTH" -H "$JSON" \
  -d '{ "date": "2026-11-26", "note": "INSET" }'
```

## Browser-only HTTP routes

These routes exist for the web app. They sit behind the **session cookie**, not the API key, and a
signed-out request is redirected to `/login`. They are not a supported integration surface and may
change with the UI.

| Route                                 | Purpose                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /attachments/:id`                | Download an Attachment under its own name (`Content-Disposition: attachment`)                                |
| `GET /backup`                         | Download a Backup tar (`planner-backup-<date>.tar`): the database and every Attachment                       |
| `POST /setup/restore`                 | Restore a Backup into an **empty** instance (raw tar as body; no size limit); only while no account exists   |
| `GET /session`, `POST /session`       | Read a Session by `classId`, `date`, `period`; write the Teaching note                                       |
| `POST`/`DELETE /session/continuation` | Record or undo a Continuation on an occasion                                                                 |
| `POST`/`DELETE /session/placement`    | Place a Lesson in an Open Slot, or remove a Placement                                                        |
| `GET /feedback`, `POST /feedback`     | Whether the in-app feedback button is enabled; file feedback as a GitHub issue                               |
| `POST /logout`                        | Sign out                                                                                                     |
| `/api/auth/*`                         | Better Auth's own endpoints. Sign-up and email sign-in are disabled; the login form is the only sign-in door |

Cross-site form-typed writes (`application/x-www-form-urlencoded`, `multipart/form-data`,
`text/plain`) to the app are refused with 403 unless the `Origin` header matches the site.
