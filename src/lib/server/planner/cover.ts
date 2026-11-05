// Cover: the work set for one Class in one Slot of an Absence, recorded as a Lesson (ADR-0030).
// Unlike a Placement it is not an input to the schedule — the displaced Lesson has already shifted
// right — so nothing here re-derives, and only the views read it back.
import { and, asc, eq, isNull } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { loadCalendar, type Db } from './derive';
import { attachmentsOf } from './attachments';
import { deleteLesson } from './lessons';
import { linksOf } from './links';
import { timetabledSlots } from './engine';
import { Refused } from './refused';
import { required, requireRow } from './fields';

// Records a Cover for an absent Slot: an existing Lesson when `lessonId` is given, else a new
// Standalone Lesson titled `title`. Any date, past included, because the teacher may log what was
// set after the fact. The Lesson and the Cover commit together.
export function setCover(
	db: Db,
	{
		classId,
		date,
		slotId,
		lessonId,
		title
	}: { classId: string; date: string; slotId: string; lessonId?: string; title?: string }
): { lesson: typeof schema.lesson.$inferSelect; coverId: string } {
	const slot = timetabledSlots(loadCalendar(db), classId).find(
		(s) => s.date === date && s.slotId === slotId
	);
	if (!slot?.removedBy.some((removal) => removal.kind !== 'outside-term' && removal.absent)) {
		throw new Refused('invalid', `${date} is not an Absence for that Slot.`);
	}

	const [taken] = db
		.select({ id: schema.cover.id })
		.from(schema.cover)
		.where(
			and(
				eq(schema.cover.classId, classId),
				eq(schema.cover.date, date),
				eq(schema.cover.slotId, slotId)
			)
		)
		.all();
	if (taken) throw new Refused('conflict', 'That Slot already has a Cover.');

	return inTransaction(db.$client, () => {
		const [lesson] = lessonId
			? [requireStandalone(requireRow(db, schema.lesson, lessonId, 'No such Lesson.'))]
			: db
					.insert(schema.lesson)
					.values({
						topicId: null,
						title: required(title ?? '', 'A Lesson needs a title.'),
						position: 0
					})
					.returning()
					.all();

		const [cover] = db
			.insert(schema.cover)
			.values({ classId, date, slotId, lessonId: lesson.id })
			.returning()
			.all();
		return { lesson, coverId: cover.id };
	});
}

// A Cover is a Standalone Lesson: a Topic Lesson belongs to Sequences and Planning, which a Cover
// must not leave (ADR-0030).
function requireStandalone(lesson: typeof schema.lesson.$inferSelect) {
	if (lesson.topicId !== null) {
		throw new Refused('invalid', 'Only a Standalone Lesson can be a Cover.');
	}
	return lesson;
}

// Takes back the Covers on `date` whose Slot is no longer taken by an Absence. Called after any
// unblock: a Blocked Day and a Blocked Slot can both cover one Slot, so a Cover ends only when the
// last Absence on it does (ADR-0030).
export function dropEndedCovers(db: Db, date: string) {
	const absent = new Set(
		timetabledSlots(loadCalendar(db))
			.filter(
				(slot) =>
					slot.date === date &&
					slot.removedBy.some((removal) => removal.kind !== 'outside-term' && removal.absent)
			)
			.map((slot) => `${slot.classId}|${slot.slotId}`)
	);
	for (const cover of db.select().from(schema.cover).where(eq(schema.cover.date, date)).all()) {
		if (!absent.has(`${cover.classId}|${cover.slotId}`)) {
			db.delete(schema.cover).where(eq(schema.cover.id, cover.id)).run();
		}
	}
}

// Removes a Cover, leaving its Lesson standing as a Standalone Lesson. Null when there is none.
export function clearCover(db: Db, { id }: { id: string }) {
	const [row] = db.select().from(schema.cover).where(eq(schema.cover.id, id)).all();
	if (!row) return null;

	db.delete(schema.cover).where(eq(schema.cover.id, id)).run();
	return row;
}

// The Lessons a Cover may reuse: the Standalone ones. A Topic Lesson stays out, because it belongs
// to Sequences and Planning and a Cover must not.
export function coverChoices(db: Db) {
	return db
		.select({ id: schema.lesson.id, title: schema.lesson.title })
		.from(schema.lesson)
		.where(isNull(schema.lesson.topicId))
		.orderBy(asc(schema.lesson.title))
		.all();
}

// Set cover opens the new Lesson at once to make the teacher decide what it is; leaving it with no
// plan, Links or Attachments takes the Cover and the Lesson back (ADR-0030). True when it did. Only
// a Cover made with a new Lesson is ever sent here — an existing Lesson is never discarded.
export function discardBlankCover(
	db: Db,
	{ coverId, dir, today }: { coverId: string; dir: string; today: string }
): boolean {
	const [cover] = db.select().from(schema.cover).where(eq(schema.cover.id, coverId)).all();
	if (!cover) return false;

	const [lesson] = db
		.select()
		.from(schema.lesson)
		.where(eq(schema.lesson.id, cover.lessonId))
		.all();
	const blank =
		!lesson.body?.trim() &&
		linksOf(db, lesson.id).length === 0 &&
		attachmentsOf(db, lesson.id).length === 0;
	if (!blank) return false;

	// Cover first: deleting a Lesson a Cover names is refused (ADR-0030). deleteLesson commits its own
	// write, so a fault in it leaves a Standalone Lesson, never a Cover with no Lesson.
	db.delete(schema.cover).where(eq(schema.cover.id, coverId)).run();
	deleteLesson(db, { id: lesson.id, today, dir });
	return true;
}

// A Cover read for the Lesson editor's banner: which Class, date and Period it was set for.
export function coverDetail(db: Db, id: string) {
	const [row] = db
		.select({
			id: schema.cover.id,
			lessonId: schema.cover.lessonId,
			date: schema.cover.date,
			classLabel: schema.classes.label,
			period: schema.slot.period
		})
		.from(schema.cover)
		.innerJoin(schema.classes, eq(schema.classes.id, schema.cover.classId))
		.innerJoin(schema.slot, eq(schema.slot.id, schema.cover.slotId))
		.where(eq(schema.cover.id, id))
		.all();
	return row ?? null;
}
