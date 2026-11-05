// Cover: the work set for one Class in one Slot of an Absence, recorded as a Lesson (ADR-0030).
// Unlike a Placement it is not an input to the schedule — the displaced Lesson has already shifted
// right — so nothing here re-derives, and only the views read it back.
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { loadCalendar, type Db } from './derive';
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
): { lesson: typeof schema.lesson.$inferSelect } {
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
			? [requireRow(db, schema.lesson, lessonId, 'No such Lesson.')]
			: db
					.insert(schema.lesson)
					.values({
						topicId: null,
						title: required(title ?? '', 'A Lesson needs a title.'),
						position: 0
					})
					.returning()
					.all();

		db.insert(schema.cover).values({ classId, date, slotId, lessonId: lesson.id }).run();
		return { lesson };
	});
}

// Removes a Cover, leaving its Lesson standing as a Standalone Lesson. Null when there is none.
export function clearCover(db: Db, { id }: { id: string }) {
	const [row] = db.select().from(schema.cover).where(eq(schema.cover.id, id)).all();
	if (!row) return null;

	db.delete(schema.cover).where(eq(schema.cover.id, id)).run();
	return row;
}
