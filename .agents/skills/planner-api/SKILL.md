---
name: planner-api
description: Call the planner's HTTP API to read and write Courses, Topics, Lessons, Links, Attachments, Import, Terms and Blocked Days. Use when an agent must change a teacher's plan over HTTP rather than through the browser.
---

# Planner API

The planner serves a JSON API at `/api`, for one outside agent with one key. The full reference is
[`docs/spec/planning-api.md`](../../../docs/spec/planning-api.md); this page is the working guide.

## Steps

1. **Get the key.** The teacher reads it in Settings, under "API key", and gives it to you. Send it
   on every request: `Authorization: Bearer pln_...`. A missing or wrong key is
   `401 { "error": "Give a valid API key in the Authorization header." }` — never a login page.
2. **Read before you write.** `GET /api/courses`, then `GET /api/courses/:id/topics` — a Topic
   lives under its Course, and a Lesson under its Topic. Every record's id comes from a read or a
   create response; nothing is looked up by name except in Import.
3. **Write.** One record at a time (§Flow), or one whole Topic through Import. A create answers
   its record with `201`; a read or edit answers the record with `200`; a remove answers `204` with
   no body.
4. **Read the report** any time a write could move a Session (§Reports). Done when the write's
   status is one you expected and, for a report-carrying write, `placementsMoved` is empty or its
   entries are the moves you meant.

## Authentication

- One key, `pln_` + 43 base64url characters, regenerable in Settings. Regenerating breaks the old
  one immediately.
- `/api/auth/*` is the browser's own sign-in surface, not part of this API.

## Flow

```
POST /api/courses                          { "name": "KS3 Science" }
POST /api/courses/:courseId/topics         { "name": "Forces" }
POST /api/topics/:topicId/lessons          { "title": "Balanced forces" }
POST /api/lessons/:lessonId/links          { "url": "https://...", "label": "Simulation" }
POST /api/lessons/:lessonId/attachments    multipart/form-data, one `file` field
```

- `GET /api/courses/:id`, `/api/topics/:id` answer the record; `GET /api/lessons/:id` answers the
  whole Lesson: its row, `topic` and `course` (both `null` for a Standalone Lesson), `links`,
  `tags` (`{ id, name }`) and `attachments`.
- `PATCH` on a Course, Topic or Lesson is partial: a field you leave out keeps its value.
- `PATCH /api/lessons/:id` takes `title`, `body`, `length`, `status` and `topicId`.
  `"topicId": null` detaches the Lesson from its Topic; `"body": null` clears the plan.
- Course names are globally unique and Topic names unique within their Course, both
  case-insensitively; a collision is `409`. Lesson titles are not unique.
- Deletes: `DELETE /api/courses/:id`, `/api/topics/:id`, `/api/lessons/:id`, `/api/links/:id`,
  `/api/attachments/:id` → `204`. A delete that would be asked about in the browser — a Course a
  Class follows, a Topic or Lesson that a Sequence holds — answers `409` with the question as the
  message; there is no confirm parameter, so do not retry it. A Lesson that has been taught is
  `409` too.

## Import

`POST /api/import` creates one Topic, its Lessons and their Links in one transaction:

```json
{
	"course": { "name": "KS3 Science" },
	"topic": {
		"name": "Forces",
		"lessons": [
			{ "title": "Balanced forces", "links": [{ "url": "https://...", "label": "Simulation" }] }
		]
	}
}
```

- `course` takes exactly one of `id` or `name`. A `name` that matches an existing Course (any
  case) reuses it; a new one is created and reported as `"courseCreated": true`.
- Answers `201` with `course`, `courseCreated`, `topic`, `lessons` (each with its `id`, `title`,
  `position` and `links`) and an empty `report`.
- A failure anywhere commits nothing. Use it for a fresh Topic; it never updates an existing one.

## Terms

`GET /api/terms` → `{ "terms": [{ "name": "Autumn 1", "opens": "2026-09-03", "closes": "2026-10-23" }] }`
in date order — an empty list before the year is set up. The name is derived from position and is
not accepted on write.

`PUT /api/terms` replaces all six as one document:

```json
{ "terms": [{ "opens": "2026-09-03", "closes": "2026-10-23" }, ... exactly six ...] }
```

Any order; extra fields ignored. Answers `200` with the six in order beside a `report`. A wrong
count, an unreal date, a Term opening after it closes, and two Terms that overlap or touch are each
`400` with the seam's message — read the message, not a code. Sending the same six back changes
nothing, so it is safe to read, edit one, and write all six.

## Blocked Days

- `GET /api/blocked-days` → `{ "blockedDays": [{ "date": "2026-11-26", "note": "INSET" }] }`, the
  whole year in date order. A Blocked Day has no id: the date is the address.
- `POST /api/blocked-days` `{ "date": "...", "note": "..." }` → `201` with
  `{ "blockedDay": {...}, "report": {...} }`. A weekend is `400`; a date already blocked is `409`.
- `DELETE /api/blocked-days/:date` → `200` with `{ "report": {...} }` — this is the one remove that
  carries a body, because unblocking a day can move a Session. A date not blocked is `404`.

## Reports

`report` is `{ "placementsMoved": [...] }`: each entry names a Placement that the write moved,
with `classId`, `classLabel`, `lessonTitle`, `anchorDate`, `anchorPeriod`, and where it now sits
(`date`, `period`), or `"stranded": true` when every Slot at or after its anchor is gone. An empty
list means the schedule did not move.

Writes that carry one: `PATCH` and `DELETE` of a Lesson, `POST` and `DELETE` of a Blocked Day,
`PUT /api/terms`, and `POST /api/import` (always empty). Every other write is a plain record —
creating a Lesson moves nothing, because a new Lesson is in no Sequence.

## Errors

```json
{ "error": "A Course called \"Year 9 Physics\" already exists." }
```

- `400` — the body is malformed, a field is missing or the wrong type, or the seam refused a value.
  The message is the teacher's own sentence.
- `401` — no key, or a key that is no longer valid.
- `404` — the id or date in the URL does not exist.
- `409` — the write collides with an existing record, or is refused as unsafe (a delete that asks
  first). Do not retry either without changing the request.
- `500` — unexpected; the message names nothing internal.
