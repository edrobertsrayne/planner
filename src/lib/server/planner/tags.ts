// Tags — short, user-typed labels a Lesson may carry. Names are unique across the planner,
// case-insensitive; attaching a name that matches an existing Tag reuses it, because attach, never
// create-or-refuse, is the point. A Tag is descriptive metadata and never changes a date.
import { and, asc, eq, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { required, requireRow, sameName } from './fields';
import { inTransaction } from '../db';
import type { Db } from './derive';

// A Lesson's Tag names, for a list that shows many Lessons at once and never detaches one.
export function tagsOf(db: Db, lessonId: string): string[] {
	return attachedTags(db, lessonId).map((tag) => tag.name);
}

// A Lesson's Tags with their ids — what `lessonDetail` carries, so the editor can post a detach.
export function attachedTags(db: Db, lessonId: string): { id: string; name: string }[] {
	return db
		.select({ id: schema.tag.id, name: schema.tag.name })
		.from(schema.lessonTag)
		.innerJoin(schema.tag, eq(schema.tag.id, schema.lessonTag.tagId))
		.where(eq(schema.lessonTag.lessonId, lessonId))
		.orderBy(asc(schema.tag.name))
		.all();
}

// Batch form of tagsOf, for a row of Lessons rendered together — the Agenda, Planning and the
// Courses list each resolve every Lesson's Tags in one query rather than one per row, mirroring
// derive.ts's lessonNames. Lives here, not in derive.ts, because Tag is authored from this module;
// views.ts and sessions.ts import it from here, through no re-export.
export function tagsByLesson(db: Db, lessonIds: readonly string[]): Map<string, string[]> {
	const map = new Map<string, string[]>();
	if (lessonIds.length === 0) return map;

	const rows = db
		.select({ lessonId: schema.lessonTag.lessonId, name: schema.tag.name })
		.from(schema.lessonTag)
		.innerJoin(schema.tag, eq(schema.tag.id, schema.lessonTag.tagId))
		.where(inArray(schema.lessonTag.lessonId, lessonIds))
		.orderBy(asc(schema.tag.name))
		.all();

	for (const row of rows) {
		const existing = map.get(row.lessonId);
		if (existing) existing.push(row.name);
		else map.set(row.lessonId, [row.name]);
	}
	return map;
}

// Every distinct Tag name that exists, sorted — the Lesson editor's typing suggestions, so a
// teacher reaching for "Practical" a second time sees it rather than retyping it slightly
// differently.
export function listTagNames(db: Db): string[] {
	return db
		.select({ name: schema.tag.name })
		.from(schema.tag)
		.orderBy(asc(schema.tag.name))
		.all()
		.map((row) => row.name);
}

// Tag names are unique across the planner, case-insensitive. Typing a name that matches an existing
// Tag reuses it — attach, never create-or-refuse, is Tag's whole point — and the seam trims the
// name like every other name it stores. An empty or whitespace-only name is an `invalid`, the one
// input the seam itself refuses. No re-derive: a Tag is descriptive metadata, exactly like
// Readiness, and never changes a date.
export function attachTag(
	db: Db,
	{ lessonId, name }: { lessonId: string; name: string }
): string[] {
	const trimmed = required(name, 'A Tag needs a name.');
	requireRow(db, schema.lesson, lessonId, 'Lesson not found.');

	// The Tag row and its lesson_tag attachment are one write: if the attachment fails, the Tag
	// it would have left behind is rolled back with it.
	return inTransaction(db.$client, () => {
		const [existing] = db.select().from(schema.tag).where(sameName(schema.tag.name, trimmed)).all();
		const tagRow = existing ?? db.insert(schema.tag).values({ name: trimmed }).returning().all()[0];

		db.insert(schema.lessonTag).values({ lessonId, tagId: tagRow.id }).onConflictDoNothing().run();

		return tagsOf(db, lessonId);
	});
}

// Deletes the one lesson_tag row. Idempotent: detaching a Tag the Lesson doesn't carry is a
// no-op, not an error, the same way unblocking an already-open day is.
export function detachTag(db: Db, { lessonId, tagId }: { lessonId: string; tagId: string }): void {
	db.delete(schema.lessonTag)
		.where(and(eq(schema.lessonTag.lessonId, lessonId), eq(schema.lessonTag.tagId, tagId)))
		.run();
}
