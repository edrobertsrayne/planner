# Who reads Assigned Topics or Lesson order? (issue #367)

Question: which code, screens and tests read `assigned_topic`, `lesson.position`, `loadLessonStream`
or a Class's flattened Lesson stream, and what would a stored `class_lesson(class_id, lesson_id,
position)` list do to each?

Method: grep over `src/`, `e2e/`, `scripts/`, `drizzle/` at the HEAD of this branch, then read each hit.
Line numbers are for this commit. Sources: the code itself, `GLOSSARY.md`, ADR-0010.

Verdicts:
- **Replace**: the read or write moves to `class_lesson`.
- **Beside**: stays, and also has to keep `class_lesson` in step (or read both).
- **Leave**: no change.

## The one read that matters

`loadLessonStream` (`src/lib/server/planner/derive.ts:101-109`) is the only place a Class's Lesson
stream is built. It joins `assigned_topic` → `topic` → `lesson`, ordered by
`assigned_topic.position, lesson.position`. Its only caller is `scheduleFor` (`derive.ts:168`).
`scheduleFor` is the single door for every write (`rederive`) and every read (agenda, calendar, class
lanes, planning stream, rewind). So swapping this one query to read `class_lesson` changes the
order everywhere, and nothing downstream needs to know.

## Table

### Schema and migration

| File:line | Reads / writes | Verdict |
|---|---|---|
| `src/lib/server/db/schema.ts:134-143` | defines `assigned_topic` (class, topic, position) | Beside: add `class_lesson`; keep `assigned_topic` as the set of Topics a Class follows (Q1) |
| `src/lib/server/db/schema.ts:54` | `lesson.position` column | Beside: stays as the shared default order that seeds new `class_lesson` rows |
| `drizzle/` (new migration) | not a consumer yet | Needed: create the table and backfill it from `assigned_topic` × `lesson.position`, so every Class keeps today's order |
| `src/lib/server/db/index.test.ts:36` | lists expected table names | Beside: add `class_lesson` |

### The stream and re-derive

| File:line | Reads / writes | Verdict |
|---|---|---|
| `derive.ts:101-109` `loadLessonStream` | reads `assigned_topic.position`, `lesson.position` | **Replace**: select from `class_lesson` where class, order by position |
| `derive.ts:168` `scheduleFor` | calls `loadLessonStream` | Leave |
| `derive.ts:196` `rederive`, `derive.ts:306` `rederiveAllClasses` | call `scheduleFor` | Leave |
| `derive.ts:282-290` `rederiveTopic` | reads `assigned_topic` for Classes holding a Topic | Beside: still the way to find Classes that hold a Topic (or read `class_lesson` joined to Lesson; Q1) |
| `derive.ts:361` `lessonNames`, `derive.ts:393`, `derive.ts:457` | Lesson titles for reports | Leave |

### Assign and order Topics (`classes.ts`)

| File:line | Reads / writes | Verdict |
|---|---|---|
| `classes.ts:79-107` `assignTopic` | inserts `assigned_topic` at next position | Beside: also append the Topic's Lessons to the Class's `class_lesson` (shared order) |
| `classes.ts:111-123` `assignedTopicsOf` | reads `assigned_topic` for the shelf | Beside: shelf stays (Q1) |
| `classes.ts:147-177` `unassignTopic` | deletes `assigned_topic`, readiness | Beside: also delete the Topic's `class_lesson` rows for that Class |
| `classes.ts:183-205` `moveAssignedTopic` | swaps two `assigned_topic.position` | **Replace** (if Topics stay a block in the list: move the whole block of rows). Needs a decision, Q2 |
| `classes.ts:210` `classSchedule`, `classes.ts:254-300` `classLanes` | read the derived schedule | Leave |
| `ordering.ts` `nextPosition`, `swapTargets` | position arithmetic | Beside: reuse for `class_lesson`; a "move one Lesson" needs a new helper, not a swap of neighbours across Topics |

### Lessons (`authoring.ts`)

| File:line | Reads / writes | Verdict |
|---|---|---|
| `authoring.ts:99-107` `lessonsOf` | reads `lesson.position` | Leave: the Topic's shared order on the Course page |
| `authoring.ts:205-207` `topicCascadeBlocker` | reads `assigned_topic` to refuse Topic delete | Leave |
| `authoring.ts:328-336` `deleteTopic` | deletes Lessons via `deleteLesson` | Leave (rides on `deleteLesson`) |
| `authoring.ts:346-387` `endOfTopic`, `createLesson` | writes `lesson.position`; `rederiveTopic` | Beside: also insert the new Lesson after its Topic neighbour in each assigned Class (the settled rule) |
| `authoring.ts:536-603` `editLesson` | on move: sets `lesson.position`, reads `assigned_topic` both sides | Beside: on move or Detach, drop `class_lesson` rows from Classes that no longer reach it, insert for Classes that now do |
| `authoring.ts:616-663` `deleteLesson` | deletes Lesson, re-derives | Beside: delete its `class_lesson` rows first (FK) |
| `authoring.ts:669-685` `moveLesson` | swaps two `lesson.position`, `rederiveTopic` | Beside: still edits the shared default order. It would no longer move any existing Class, so the re-derive becomes a no-op (Q3) |
| `authoring.ts:761-910` `importTopic` | inserts Lessons with `position: i` into a new Topic | Leave: a new Topic has no Class, so nothing to insert; its `rederiveTopic` finds none |
| `placement.ts:50` | creates Standalone Lesson, `position: 0` | Leave: a Standalone Lesson is reached by Placement, not by the list (ADR-0015, ADR-0022) |
| `views.ts:474-538` `planningStream` | reads `lesson.position` as final tiebreak after Course, Topic | Leave: that is the shared catalogue order, not a Class's |

### Screens and routes

| File:line | Reads / writes | Verdict |
|---|---|---|
| `routes/(app)/classes/[id]/+page.server.ts:48` (+ actions `:96-127`) | `assignedTopicsOf`; assign, unassign, move actions | Beside: the shelf stays; new Lesson-order load and action go here |
| `routes/(app)/classes/[id]/AssignedTopics.svelte` | shelf with Move, Unassign, Assign next | Beside, or Replace if the Topic move becomes Lesson move (Q2) |
| `routes/(app)/classes/[id]/+page.svelte:129` | passes `assigned` to the shelf | Beside |
| `routes/(app)/classes/+page.server.ts:39`, `+page.svelte:116` | `assignTopic` from the Classes screen | Leave |
| `routes/(app)/courses/[id]/+page.server.ts:34,128,141`, `+page.svelte:238,256` | `lessonsOf`, `createLesson`, `moveLesson` | Leave (page shows the shared order; copy may need to say it is the default) |
| `routes/(app)/lessons/[id]/+page.server.ts:35`, `+page.svelte:69-142` | `siblingIds` from `lessonsOf`: "Lesson n of N", prev/next | Leave (Q4: should stepping follow a Class's order?) |
| `lib/server/lesson-actions.ts:36-116` | `editLesson`, `deleteLesson` actions | Leave |
| `routes/api/topics/[id]/lessons/+server.ts:18,44` | `lessonsOf`, `createLesson` | Leave: API response shape is the shared order |
| `routes/api/lessons/[id]/+server.ts:69,84` | `editLesson`, `deleteLesson` | Leave |
| `routes/api/import/+server.ts:59` | `importTopic` | Leave |
| `routes/(app)/planning/+page.server.ts:12` | `planningStream` | Leave |

### Backup, Restore, seeds, scripts

| File:line | Reads / writes | Verdict |
|---|---|---|
| `server/backup/backup.ts:35` | `VACUUM INTO` copies the whole database | Leave: the new table rides along |
| `server/backup/restore.ts:129-186` | runs migrations on the staged copy; checks migration names | Leave: an old backup is migrated forward, so the backfill migration must be correct (risk) |
| `scripts/e2e-fixtures.ts:96` `assign-topic` | inserts `assigned_topic` by hand, position 0 | **Beside**: must also insert `class_lesson` rows or call `assignTopic` |
| `scripts/demo-db.ts:96` | uses `assignTopic` | Leave |
| `server/planner/fixtures.ts:85-88` | inserts Lessons with `position` | Leave |

### Tests

| File | What it touches | Verdict |
|---|---|---|
| `planner/classes.test.ts` (19 `assignTopic`, 2 `moveAssignedTopic`, `assignedTopicsOf` at 180-233) | shelf order, move | Beside: keep, add `class_lesson` assertions; rewrite if Q2 changes the move |
| `planner/derive.test.ts` (20 assign, 3 unassign, `moveLesson` :199, `moveAssignedTopic` :88) | stream order through the API | **Replace** the `moveLesson` test (:199): moving a shared Lesson must not change a Class. Others Leave |
| `planner/authoring.test.ts` (18 assign, 9 `moveLesson` at 678-969) | `moveLesson` drives the Class stream (`:925-928`, `:969`) | **Replace** those cases: they assume a shared move re-orders every Class. Add create/move/detach/delete cases for `class_lesson` |
| `planner/views.test.ts` (53 `assignTopic`, unassign :938) | agenda, calendar, lanes | Leave: goes through the API, stays green if the stream is right |
| `planner/disruptions.test.ts`, `sessions.test.ts`, `terms.test.ts`, `placement.test.ts`, `timetable.test.ts`, `attachments.test.ts` | use `assignTopic` as set-up | Leave |
| `db/index.test.ts:36` | table list | Beside |
| `backup/backup.test.ts` | builds a Lesson with `position: 0` | Leave |
| `e2e/teaching-flows.e2e.ts:105`, `the-rewind-report.e2e.ts:71-94`, `the-responsive-layouts.e2e.ts:96-99,828-957` | click Assign next Topic, Unassign, Move on the shelf | Beside: Leave unless Q2 changes the shelf controls; add one e2e for per-Class Lesson order |
| `e2e/the-rewind-report.e2e.ts:126-131` | "Move A extra up" on the **Course** page expects a Rewind report on a noted Session | **Replace**: a shared move no longer touches a Class, so the report no longer appears. Retarget to the Class's own Lesson order |
| `e2e/the-planning-api/60-refusals.e2e.ts:18-70` | `assign-topic` fixture, then Topic delete refused | Leave (fixture fix covers it) |
| `e2e/the-planning-api/30-lessons.e2e.ts:56` | reads `position: 0` in API payload | Leave |
| other `e2e/*` | no read of Assigned Topics or order | Leave |

## Count of files per verdict

Counting each distinct file once, by its strongest verdict (Replace > Beside > Leave).

- **Replace**: 5 files. `derive.ts`, `classes.ts` (`moveAssignedTopic`, pending Q2), `derive.test.ts`, `authoring.test.ts`, `e2e/the-rewind-report.e2e.ts`.
- **Beside**: 12 files. `schema.ts`, `authoring.ts`, `ordering.ts`, `classes/[id]/+page.server.ts`, `classes/[id]/+page.svelte`, `AssignedTopics.svelte`, `scripts/e2e-fixtures.ts`, `db/index.test.ts`, `classes.test.ts`, `teaching-flows.e2e.ts`, `the-responsive-layouts.e2e.ts`, plus the new migration file.
- **Leave**: about 28 files. `views.ts`, `placement.ts`, `classes/+page.server.ts`, `classes/+page.svelte`, courses page (2), lessons page (2), `lesson-actions.ts`, 3 API routes, `planning/+page.server.ts`, `backup.ts`, `restore.ts`, `demo-db.ts`, `fixtures.ts`, `views.test.ts`, 6 other planner tests, `backup.test.ts`, 3 other e2e files.

## Three riskiest consumers

1. **`authoring.ts` `createLesson` / `editLesson` / `deleteLesson`.** Three writers must keep a second table in step with `lesson.topicId`, including a Lesson moved to another Topic, a Detach, and a Class that reaches a Lesson through two routes (Topic and Placement). Miss one and a Lesson silently drops out of a Class's schedule or a dangling row breaks the FK. Today none of this is stored, so nothing can drift.
2. **The backfill migration, run by Restore.** `restore.ts` migrates an old backup forward. The migration must turn each Class's current `assigned_topic.position, lesson.position` order into `class_lesson` rows exactly, or every Class's schedule shifts after a Restore. It is the only step that cannot be redone by hand.
3. **`moveLesson` and its tests (`authoring.test.ts`, `derive.test.ts`, the Rewind e2e).** Today a shared move re-orders every Class, and the Rewind report tests rely on it. Under the settled model it must stop. That reverses tested behaviour in three places, and the Course page's Move buttons then mean "default order for new assignments", which the copy must say.

## Open questions this raises

- **Q1.** Does `assigned_topic` stay? It is still the set of Topics a Class follows (unassign, the shelf, the delete-Topic guard). Its `position` column would be dead if `class_lesson` carries the whole order.
- **Q2.** Is the Class's list still grouped by Topic (Topic blocks, move a block), or fully flat so Lessons from different Topics may interleave? That decides `moveAssignedTopic` and the shelf.
- **Q3.** What does the Course page's `moveLesson` mean afterwards: the default order for Lessons newly assigned, or removed from the screen?
- **Q4.** Should the Lesson editor's prev/next and "Lesson n of N" follow a Class's order when opened from a Class?
