# Draft skill: `planner-api`

Status: **draft — the API it describes is not built.** This is the second half of the destination of
wayfinder map [#126](https://github.com/edrobertsrayne/planner/issues/126). Move it to
`.claude/skills/planner-api/SKILL.md`, frontmatter and all, when the API described in
`docs/spec/planning-api.md` is live. It is kept out of `.claude/skills/` until then so that no agent
loads a skill for endpoints that answer 404.

The content below the rule is the skill file exactly as it should be written.

---

````markdown
---
name: planner-api
description: Reads and writes Course, Topic, Lesson and Link records in the planner over its HTTP API, including the all-or-nothing Import of one Topic with its Lessons and Links. Use when adding, editing or removing planner course content from outside the browser, or when a workflow needs planner ids. Triggers on "import into the planner", "add a topic", "planner API", "PLANNER_API_KEY".
user-invocable: false
allowed-tools: Bash(curl *)
---

# planner-api

The planner is a personal electronic teacher planner for one UK state secondary school teacher. It
exposes an HTTP API over the **Planning** half of its domain: Course, Topic, Lesson and Link.

This skill is a **reference**. It tells you which request to send and how to read the reply. It does
not decide what a Lesson should say. You are one link in a workflow the teacher drives — get the
content from them, then write it.

## The words

Use these words. The planner's glossary is load-bearing and the API mirrors it.

- **Course** — the body of teaching material for a subject and year group, such as "Year 9 Physics".
  Holds Topics in no particular order. Never call it a module, unit, scheme of work or syllabus.
- **Topic** — a named block of teaching within a Course, such as "Forces". Holds Lessons **in
  order**. Belongs to exactly one Course. Never call it a unit, module, block or chapter.
- **Lesson** — one teaching episode, the plan rather than the event. A title alone is a complete
  Lesson. Never call it a period, session or class.
- **Link** — one URL with a label, attached to a Lesson, in order.
- **Standalone Lesson** — a Lesson belonging to no Topic (`"topicId": null`).
- **Detach** — removing a Lesson from its Topic, making it a Standalone Lesson.
- **Import** — creating one Topic, with its Lessons and their Links, in a single request.

## Connecting

Two things are needed:

- `PLANNER_URL` — the planner's base URL.
- `PLANNER_API_KEY` — a key the teacher created in the planner's Settings screen. It begins `pln_`.

Send it on every request:

```bash
curl -sS -H "Authorization: Bearer $PLANNER_API_KEY" "$PLANNER_URL/api/courses"
```
````

If either is missing, **ask the teacher**. Do not guess a URL and do not proceed without a key.

A **401** means the key is absent, malformed, or revoked. Stop and tell the teacher. Do not retry.

## Reading the replies

Every reply is plain JSON with no wrapper. A success gives you the record, or the array, directly.
An error gives you `{ "error": "..." }` and a status code.

| code | what it means to you                                                      |
| ---- | ------------------------------------------------------------------------- |
| 200  | Done. The body is what you asked for.                                     |
| 201  | Created. The body is the new record. **Keep the `id`.**                   |
| 204  | Removed. No body.                                                         |
| 400  | Your request is wrong. Read the message, fix it, send it again.           |
| 401  | The key is bad. Stop and tell the teacher.                                |
| 404  | An id in the path does not exist. Look it up again; do not invent one.    |
| 409  | The id is right but the write is refused. Read the message — it says why. |
| 500  | The planner failed. Stop and tell the teacher.                            |

A **409 is never fixed by retrying the same request.** It means a name collides, or a record is
still in use. Change the request or ask the teacher.

## The records

**Course** — `{ "id", "name" }`

**Topic** — `{ "id", "name", "courseId" }`

**Lesson** — `{ "id", "topicId", "title", "body", "status", "length", "position" }`

- `topicId` may be `null` — that is a Standalone Lesson.
- `body` is markdown, or `null`.
- `status` is `"draft"` or `"planned"`. A Lesson starts `"draft"`. Only the teacher decides it is
  `"planned"` — never set it yourself unless told to.
- `length` is the number of school Periods the Lesson is meant to occupy. It defaults to `1`.
- `position` is set by the planner. You cannot send it.

**Link** — `{ "id", "lessonId", "url", "label", "position" }`

## Finding ids

**Never address a record by its title.** Lesson titles are not unique — one Topic may hold two
Lessons called "Revision" — so a title is not an identity. Always carry the `id`.

Start from the Course list and walk down:

```bash
curl -sS -H "Authorization: Bearer $PLANNER_API_KEY" "$PLANNER_URL/api/courses"
curl -sS -H "Authorization: Bearer $PLANNER_API_KEY" "$PLANNER_URL/api/courses/$COURSE_ID/topics"
curl -sS -H "Authorization: Bearer $PLANNER_API_KEY" "$PLANNER_URL/api/topics/$TOPIC_ID/lessons"
```

`GET /api/lessons/:id` gives one Lesson **with its Links**. That is the only read that includes
children.

## Writing one record at a time

| do this         | send                           | body                                       |
| --------------- | ------------------------------ | ------------------------------------------ |
| Make a Course   | `POST /api/courses`            | `{"name": "Year 9 Physics"}`               |
| Rename a Course | `PATCH /api/courses/:id`       | `{"name": "..."}`                          |
| Remove a Course | `DELETE /api/courses/:id`      | —                                          |
| Make a Topic    | `POST /api/courses/:id/topics` | `{"name": "Forces"}`                       |
| Rename a Topic  | `PATCH /api/topics/:id`        | `{"name": "..."}`                          |
| Remove a Topic  | `DELETE /api/topics/:id`       | —                                          |
| Make a Lesson   | `POST /api/topics/:id/lessons` | `{"title": "..."}` and optional fields     |
| Edit a Lesson   | `PATCH /api/lessons/:id`       | any of `title`, `body`, `length`, `status` |
| Remove a Lesson | `DELETE /api/lessons/:id`      | —                                          |
| Detach a Lesson | `PATCH /api/lessons/:id`       | `{"topicId": null}`                        |
| Make a Link     | `POST /api/lessons/:id/links`  | `{"url": "...", "label": "..."}`           |
| Edit a Link     | `PATCH /api/links/:id`         | `url` and/or `label`                       |
| Remove a Link   | `DELETE /api/links/:id`        | —                                          |

Send `Content-Type: application/json` on every request that carries a body.

**PATCH is partial.** Only the fields you send change. Sending `null` is different from leaving a
field out: `{"body": null}` clears the body, while an absent `body` leaves it alone.

**Any field the API does not recognise is a 400.** A typed field name fails loudly rather than being
ignored.

## Import

Use Import when the teacher gives you a whole Topic. It creates the Topic, its Lessons and their
Links in one transaction. If any part fails, **nothing is created**.

```bash
curl -sS -X POST "$PLANNER_URL/api/import" \
  -H "Authorization: Bearer $PLANNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "course": { "name": "Year 9 Physics" },
    "topic": {
      "name": "Forces",
      "lessons": [
        {
          "title": "Balanced and unbalanced forces",
          "body": "## Starter\n...",
          "links": [{ "url": "https://phet.colorado.edu/...", "label": "Forces simulation" }]
        },
        { "title": "Revision" },
        { "title": "Revision" }
      ]
    }
  }'
```

`course` takes **exactly one** of `id` or `name`:

- `{"id": "..."}` — target that Course. 404 if it does not exist.
- `{"name": "..."}` — target the Course of that name, or create it if there is none.

The reply, **201**:

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
			"links": [{ "id": "cc90...", "url": "...", "label": "...", "position": 0 }]
		},
		{ "id": "d551...", "title": "Revision", "position": 1, "links": [] },
		{ "id": "e6a2...", "title": "Revision", "position": 2, "links": [] }
	]
}
```

**Check `courseCreated`.** If it is `true` and you expected the Course to exist, you have made a
second Course from a mistyped name. Tell the teacher at once and offer to remove it.

**Keep the Lesson ids.** Two of the three Lessons above share a title, so the ids are the only way
to say which is which afterwards.

### Rules

- Lessons keep the order you send them in. Links do too, inside their Lesson.
- Only `title` is required per Lesson. `body`, `length`, `status` and `links` are optional.
- `topic.lessons` may be empty.
- At most **200** Lessons per Import, and at most **20** Links per Lesson.
- Import is **create-only**. There is no merge and no upsert. To change an imported Topic, remove it
  and import again, or ask the teacher to edit it in the planner.

## Names must not collide

- **Course names are unique across the planner.**
- **Topic names are unique within their Course.** Two Courses may each hold a "Forces".
- **Lesson titles are not unique.** Duplicates are allowed and normal.

Matching ignores case: "Forces" and "forces" are the same name. Leading and trailing spaces are
trimmed before matching.

A collision is **409**. Do not work around it by adding a number to the name. Read the message, then
either use the existing record or ask the teacher what they want.

## Removing things is deliberately hard

There is no cascade anywhere. Each of these is refused with a **409**:

- Removing a Course that still holds Topics.
- Removing a Course that a Class follows.
- Removing a Topic that still holds Lessons.
- Removing a Topic that is assigned to a Class.
- Removing a Lesson that a Class has already been taught.

Removing a Lesson does remove its Links. That is the only cascade.

### When a Lesson has been taught

A Lesson a Class has already been taught cannot be removed. Sessions in the record name it, and
removing it would erase part of the history of what was taught.

**Detach it instead:**

```bash
curl -sS -X PATCH "$PLANNER_URL/api/lessons/$LESSON_ID" \
  -H "Authorization: Bearer $PLANNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topicId": null}'
```

The Lesson keeps its title, body, Links and Length, and leaves the plan. Past Sessions still name
it. This is the correct answer to a Lesson imported into the wrong Topic after teaching has started.

Detach is allowed whether or not the Lesson has been taught. Re-attach it by sending a real
`topicId`; it lands at the end of that Topic's order.

## What this API does not do

Do not look for these. They are deliberately absent.

- **Anything in the Scheduling half** — Class, Timetable, Slot, Session, Assigned Topic,
  Continuation, Readiness. The planner derives the schedule itself and it is never edited.
- **Reordering.** There is no endpoint to move a Lesson within its Topic, or a Link within its
  Lesson. Order comes from creation order. Ask the teacher to reorder in the planner.
- **Moving a Topic to a different Course.**
- **Managing API keys.** Keys are made and revoked in the planner's Settings screen only.
- **Bulk import of a whole Course.** Import handles one Topic per request. Send several requests.

## Before you write

Three habits keep this safe.

1. **Read before you write.** List the Courses and Topics first, so you know whether you are adding
   to something that exists or making something new.
2. **Show the teacher what you are about to import.** An Import that makes a Topic in the wrong
   Course is tedious to undo, because Courses and Topics refuse to be removed while they hold
   anything.
3. **Report the ids you created.** They are how the teacher, and your next call, finds the work
   again.

```

```
