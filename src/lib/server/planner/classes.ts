// A Class: its identity, and how far through its Sequence it has got. The Sequence itself is in
// sequence.ts.
import { asc, eq, inArray } from 'drizzle-orm';
import { nextTone } from '$lib/class-tone';
import { classDeleteText } from '$lib/delete-text';
import * as schema from '../db/schema';
import { lessonNames, loadCalendar, scheduleFor, type Db } from './derive';
import { runway as deriveRunway, type Calendar, type Runway } from './engine';
import { required } from './fields';
import { teachingNotesFor } from './teaching-notes';
import { inTransaction } from '../db';
import type { ConfirmQuestion } from './courses';

// The Tone is assigned once here, at creation — the next unused position of the fixed walk
// (ADR-0013) — and never touched again by any other write.
export function createClass(db: Db, { label, courseId }: { label: string; courseId: string }) {
	const tonesInUse = db
		.select({ tone: schema.classes.tone })
		.from(schema.classes)
		.all()
		.map((row) => row.tone);
	const [row] = db
		.insert(schema.classes)
		.values({
			label: required(label, 'A Class needs a label.'),
			courseId,
			tone: nextTone(tonesInUse)
		})
		.returning()
		.all();
	return row;
}

// Changes a Class's label only — its Course and Tone are fixed at creation and untouched here.
export function renameClass(db: Db, { id, label }: { id: string; label: string }) {
	const trimmed = required(label, 'A Class needs a label.');
	const [row] = db
		.update(schema.classes)
		.set({ label: trimmed })
		.where(eq(schema.classes.id, id))
		.returning()
		.all();
	return row;
}

// Every Class, alphabetical — what classLanes and the Class page's create form read.
export function listClasses(db: Db) {
	return db
		.select({
			id: schema.classes.id,
			label: schema.classes.label,
			courseId: schema.classes.courseId,
			tone: schema.classes.tone
		})
		.from(schema.classes)
		.orderBy(asc(schema.classes.label))
		.all();
}

export function classDetail(db: Db, id: string) {
	const [row] = db
		.select({
			id: schema.classes.id,
			label: schema.classes.label,
			tone: schema.classes.tone,
			courseId: schema.classes.courseId,
			courseName: schema.course.name
		})
		.from(schema.classes)
		.innerJoin(schema.course, eq(schema.course.id, schema.classes.courseId))
		.where(eq(schema.classes.id, id))
		.all();
	return row ?? null;
}

// Read back exactly where a Class has got to. Pure: never writes. `cal` lets a caller reading
// several Classes load the Calendar once and pass it to each.
export function classSchedule(
	db: Db,
	{ classId, today, cal }: { classId: string; today: string; cal?: Calendar }
) {
	const result = scheduleFor(db, { classId, boundary: today, cal });
	return { ...result, runway: deriveRunway(result) };
}

export interface ClassLane {
	classId: string;
	classLabel: string;
	courseId: string;
	tone: number;
	lastTaught: {
		date: string;
		period: number;
		title: string;
		topicName: string | null;
		note: string | null;
	} | null;
	nextUp: { title: string; topicName: string | null } | null;
	runway: Runway;
}

// One lane per Class (issue #37): what was last taught and its Teaching note, what is queued
// next, and the Runway. Reuses classSchedule's single derived answer per Class; there is no separate
// Classes-view computation. The Calendar and the Teaching notes are each read once for every lane,
// not once per lane. `classId` restricts to one Class, for the lane atop its own Class page.
export function classLanes(
	db: Db,
	{ today, classId }: { today: string; classId?: string }
): ClassLane[] {
	const classes = listClasses(db).filter((c) => !classId || c.id === classId);
	const cal = loadCalendar(db);
	const notes = teachingNotesFor(
		db,
		classes.map((cls) => cls.id)
	);

	const lanes = classes.map((cls) => {
		const result = classSchedule(db, { classId: cls.id, today, cal });
		return {
			cls,
			result,
			lastEntry: result.history[result.history.length - 1] ?? null,
			nextEntry: result.scheduled[0] ?? null
		};
	});

	const names = lessonNames(db, [
		...new Set(
			lanes.flatMap((lane) =>
				[lane.lastEntry?.lessonId, lane.nextEntry?.lessonId].filter((id) => id !== undefined)
			)
		)
	]);

	return lanes.map(({ cls, result, lastEntry, nextEntry }) => {
		const lastName = lastEntry ? names.get(lastEntry.lessonId) : undefined;

		return {
			classId: cls.id,
			classLabel: cls.label,
			courseId: cls.courseId,
			tone: cls.tone,
			lastTaught:
				lastEntry && lastName
					? {
							date: lastEntry.date,
							period: lastEntry.period,
							...lastName,
							note: notes.get(`${cls.id}|${lastEntry.lessonId}`) ?? null
						}
					: null,
			nextUp: (nextEntry && names.get(nextEntry.lessonId)) ?? null,
			runway: result.runway
		};
	});
}

// Deletes a Class and everything it owns, in one transaction (ADR-0022): its Slots, Blocked Slots,
// Sessions, Continuations, Placements, Class Lessons, Readiness and Teaching notes, then the Class.
// Taught Sessions go too — the confirmation names them and the Backup is the undo — so there is
// nothing to refuse. Each delete is explicit and in dependency order rather than a schema cascade,
// which would need a table rebuild: Continuations first, because `continuation.session_id` has no
// cascade, and Placements and Blocked Slots before Slots. An unknown id returns undefined, the
// door's 404.
export function deleteClass(
	db: Db,
	{ id, today, confirmed = false }: { id: string; today: string; confirmed?: boolean }
): typeof schema.classes.$inferSelect | ConfirmQuestion | undefined {
	const [row] = db.select().from(schema.classes).where(eq(schema.classes.id, id)).all();
	if (!row) return undefined;

	const dates = db
		.select({ date: schema.session.date })
		.from(schema.session)
		.where(eq(schema.session.classId, id))
		.all();
	const notes = db
		.select({ classId: schema.teachingNote.classId })
		.from(schema.teachingNote)
		.where(eq(schema.teachingNote.classId, id))
		.all();

	if (!confirmed) {
		const taught = dates.filter((session) => session.date <= today).length;
		return {
			needsConfirm: true,
			reason: classDeleteText(dates.length, taught, notes.length)
		};
	}

	const sessionsOfClass = db
		.select({ id: schema.session.id })
		.from(schema.session)
		.where(eq(schema.session.classId, id));

	return inTransaction(db.$client, () => {
		db.delete(schema.continuation)
			.where(inArray(schema.continuation.sessionId, sessionsOfClass))
			.run();
		db.delete(schema.session).where(eq(schema.session.classId, id)).run();
		db.delete(schema.placement).where(eq(schema.placement.classId, id)).run();
		db.delete(schema.blockedSlot).where(eq(schema.blockedSlot.classId, id)).run();
		db.delete(schema.slot).where(eq(schema.slot.classId, id)).run();
		db.delete(schema.classLesson).where(eq(schema.classLesson.classId, id)).run();
		db.delete(schema.readiness).where(eq(schema.readiness.classId, id)).run();
		db.delete(schema.teachingNote).where(eq(schema.teachingNote.classId, id)).run();

		const [deleted] = db.delete(schema.classes).where(eq(schema.classes.id, id)).returning().all();
		return deleted;
	});
}
