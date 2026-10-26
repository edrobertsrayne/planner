// The Teaching note of one Class and Lesson (ADR-0026): read, write, and end with the pairing.
// Both parts of a Length-2 Lesson, a Continuation and every Placement of the Lesson on this Class
// share it.
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Db } from './derive';

// The Teaching note of one Class and Lesson, or null when there is none.
export function teachingNoteOf(db: Db, classId: string, lessonId: string): string | null {
	const [row] = db
		.select({ body: schema.teachingNote.body })
		.from(schema.teachingNote)
		.where(
			and(eq(schema.teachingNote.classId, classId), eq(schema.teachingNote.lessonId, lessonId))
		)
		.all();
	return row?.body ?? null;
}

// Every Teaching note of one Class, by Lesson.
export function teachingNotesOf(db: Db, classId: string): Map<string, string> {
	return new Map(
		db
			.select({ lessonId: schema.teachingNote.lessonId, body: schema.teachingNote.body })
			.from(schema.teachingNote)
			.where(eq(schema.teachingNote.classId, classId))
			.all()
			.map((row) => [row.lessonId, row.body])
	);
}

// Every Teaching note of every named Class, keyed "classId|lessonId" — the Classes screen reads
// all its lanes' notes in one query rather than one per lane.
export function teachingNotesFor(db: Db, classIds: readonly string[]): Map<string, string> {
	if (classIds.length === 0) return new Map();
	return new Map(
		db
			.select({
				classId: schema.teachingNote.classId,
				lessonId: schema.teachingNote.lessonId,
				body: schema.teachingNote.body
			})
			.from(schema.teachingNote)
			.where(inArray(schema.teachingNote.classId, classIds))
			.all()
			.map((row) => [`${row.classId}|${row.lessonId}`, row.body])
	);
}

// Sets the Teaching note of one Class and Lesson; null deletes it.
export function setTeachingNote(
	db: Db,
	classId: string,
	lessonId: string,
	body: string | null
): void {
	if (body === null) {
		db.delete(schema.teachingNote)
			.where(
				and(eq(schema.teachingNote.classId, classId), eq(schema.teachingNote.lessonId, lessonId))
			)
			.run();
		return;
	}
	db.insert(schema.teachingNote)
		.values({ classId, lessonId, body })
		.onConflictDoUpdate({
			target: [schema.teachingNote.classId, schema.teachingNote.lessonId],
			set: { body }
		})
		.run();
}

// The (Class, Lesson) pairing ends: its Readiness and Teaching note die with it (GLOSSARY).
export function endPairing(db: Db, classId: string, lessonIds: string[]): void {
	for (const table of [schema.readiness, schema.teachingNote]) {
		db.delete(table)
			.where(and(eq(table.classId, classId), inArray(table.lessonId, lessonIds)))
			.run();
	}
}

// Readiness is recorded per Class and Lesson (ADR-0014).
// Ticking inserts the row, unticking deletes it; both idempotent. No re-derive.
export function setReadiness(db: Db, lessonId: string, classId: string, ready: boolean): void {
	if (ready) {
		db.insert(schema.readiness).values({ lessonId, classId }).onConflictDoNothing().run();
	} else {
		db.delete(schema.readiness)
			.where(and(eq(schema.readiness.lessonId, lessonId), eq(schema.readiness.classId, classId)))
			.run();
	}
}
