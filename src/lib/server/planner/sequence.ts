// The Sequence: the shared Lessons one Class teaches, in that Class's own order (ADR-0026). The
// engine lays it onto the Class's Available Slots. Every rule about it lives here (ADR-0025); the
// form actions only call these functions.
//
// Each write runs in one transaction, re-derives this Class only, from today, and answers with
// the `WriteReport` plus `changed`: the Lessons that got a different first date.
import { and, asc, eq, inArray, lte, ne } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { addDays, mondayOf, weekday } from '$lib/date';
import type { LessonStatus } from '$lib/lesson-status';
import { timetabledSlots, type ScheduleResult, type TimetabledSlot } from './engine';
import {
	lessonNames,
	loadCalendar,
	occasionKey,
	rederiveWithResult,
	scheduleFor,
	type Db,
	type WriteReport
} from './derive';
import { nextPosition } from './ordering';
import { movedOrder } from '$lib/sequence-order';
import { required } from './fields';
import { Refused } from './refused';
import { endPairing, teachingNotesOf } from './teaching-notes';

// Fixed Lessons: those with a Session on or before today. They are what was taught, so no write
// may move or remove them. `fixedOn` is the one rule for "is this Session fixed?".
export function fixedOn(today: string) {
	return lte(schema.session.date, today);
}

export function fixedLessonIds(db: Db, classId: string, today: string): Set<string> {
	return new Set(
		db
			.select({ lessonId: schema.session.lessonId })
			.from(schema.session)
			.where(and(eq(schema.session.classId, classId), fixedOn(today)))
			.all()
			.flatMap((row) => (row.lessonId ? [row.lessonId] : []))
	);
}

// The Lessons of a Class's Sequence, in order.
export function sequenceLessonIds(db: Db, classId: string): string[] {
	return db
		.select({ lessonId: schema.classLesson.lessonId })
		.from(schema.classLesson)
		.where(eq(schema.classLesson.classId, classId))
		.orderBy(asc(schema.classLesson.position))
		.all()
		.map((row) => row.lessonId);
}

// The Lessons a Placement names on this Class.
function placedLessonIds(db: Db, classId: string): Set<string> {
	return new Set(
		db
			.select({ lessonId: schema.placement.lessonId })
			.from(schema.placement)
			.where(eq(schema.placement.classId, classId))
			.all()
			.map((row) => row.lessonId)
	);
}

// Where each Lesson of the Sequence first falls, from the engine: the date of its first part, or
// null when no Slot is left. Taught Lessons come from the record, the rest from today on.
function firstSlots(db: Db, classId: string, today: string): Map<string, string | null> {
	return firstSlotsOf(db, classId, scheduleFor(db, { classId, boundary: today }));
}

function firstSlotsOf(db: Db, classId: string, result: ScheduleResult): Map<string, string | null> {
	const first = new Map<string, string>();
	for (const part of [...result.history, ...result.scheduled]) {
		const seen = first.get(part.lessonId);
		if (seen === undefined || part.date < seen) first.set(part.lessonId, part.date);
	}
	return new Map(sequenceLessonIds(db, classId).map((id) => [id, first.get(id) ?? null]));
}

// A Lesson that held a place before a write and now falls on a different first date. `was` is its
// old first date, or null when it was past the end of the year.
export interface DateChange {
	lessonId: string;
	was: string | null;
}

// Runs one Sequence write: in one transaction, re-deriving this Class from today, and listing the
// Lessons that stay in the Sequence and now fall on a different first date.
function writeSequence<T>(
	db: Db,
	{ classId, today }: { classId: string; today: string },
	write: () => T
): T & WriteReport & { changed: DateChange[] } {
	return inTransaction(db.$client, () => {
		const before = firstSlots(db, classId, today);
		const result = write();
		const { report, result: schedule } = rederiveWithResult(db, classId, today);
		const after = firstSlotsOf(db, classId, schedule);
		const changed: DateChange[] = [];
		for (const [lessonId, at] of before) {
			if (after.has(lessonId) && after.get(lessonId) !== at) {
				changed.push({ lessonId, was: at });
			}
		}
		return { ...result, ...report, changed };
	});
}

function titleOf(db: Db, lessonId: string): string | undefined {
	return lessonNames(db, [lessonId]).get(lessonId)?.title;
}

export type SkipReason = 'in-sequence' | 'placed';

// Assign Topic: appends the Topic's Lessons, as they are now and in Topic order, at the end of the
// Sequence. A Lesson already in the Sequence, or named by a Placement on this Class, is skipped
// with its reason. A Class or Topic that is not there is `missing`; a Topic outside the Class's
// Course is `invalid`. Assigning a Topic again adds the Lessons written since, and the ones the
// teacher removed.
export function assignTopic(
	db: Db,
	{ classId, topicId, today }: { classId: string; topicId: string; today: string }
) {
	const [cls] = db
		.select({ courseId: schema.classes.courseId })
		.from(schema.classes)
		.where(eq(schema.classes.id, classId))
		.all();
	if (!cls) throw new Refused('missing', 'Class not found.');
	const [top] = db
		.select({ courseId: schema.topic.courseId, name: schema.topic.name })
		.from(schema.topic)
		.where(eq(schema.topic.id, topicId))
		.all();
	if (!top) throw new Refused('missing', 'Topic not found.');
	if (cls.courseId !== top.courseId) {
		throw new Refused('invalid', "This Topic does not belong to the Class's Course.");
	}

	return writeSequence(db, { classId, today }, () => {
		const inSequence = new Set(sequenceLessonIds(db, classId));
		const placed = placedLessonIds(db, classId);
		const added: { id: string; title: string }[] = [];
		const skipped: { id: string; title: string; reason: SkipReason }[] = [];

		const lessons = db
			.select({ id: schema.lesson.id, title: schema.lesson.title })
			.from(schema.lesson)
			.where(eq(schema.lesson.topicId, topicId))
			.orderBy(asc(schema.lesson.position))
			.all();
		let position = nextPosition(
			db
				.select({ position: schema.classLesson.position })
				.from(schema.classLesson)
				.where(eq(schema.classLesson.classId, classId))
				.all()
		);
		for (const lesson of lessons) {
			if (inSequence.has(lesson.id)) {
				skipped.push({ ...lesson, reason: 'in-sequence' });
			} else if (placed.has(lesson.id)) {
				skipped.push({ ...lesson, reason: 'placed' });
			} else {
				db.insert(schema.classLesson).values({ classId, lessonId: lesson.id, position }).run();
				position++;
				added.push(lesson);
			}
		}
		return { topicName: top.name, added, skipped };
	});
}

// Move: the Lessons of `lessonIds` go, in their current order, into the place of `targetId` (see
// `movedOrder`). It changes this Class only, and a Placement stays on its date. A fixed Lesson
// cannot move, and nothing may land in front of one, so a later Rewind lays the past again as it
// was taught (ADR-0026). The first refusal that applies wins.
export function moveLessons(
	db: Db,
	{
		classId,
		lessonIds,
		targetId,
		today
	}: { classId: string; lessonIds: string[]; targetId: string; today: string }
) {
	const order = sequenceLessonIds(db, classId);
	const next = movedOrder(order, lessonIds, targetId);
	if (!next) {
		throw new Refused(
			'invalid',
			'Those Lessons are not in this Sequence, or the target is one of them.'
		);
	}

	const fixed = fixedLessonIds(db, classId, today);
	const taught = lessonIds.find((id) => fixed.has(id));
	if (taught) {
		throw new Refused('conflict', `“${titleOf(db, taught)}” was taught, so it cannot move.`);
	}
	refuseInFrontOfTaught(db, next.slice(next.findIndex((id) => lessonIds.includes(id))), fixed);

	return writeSequence(db, { classId, today }, () => {
		writeOrder(db, classId, next);
		return {};
	});
}

// Nothing may land in front of a taught Lesson: `after` is the part of the new order behind the
// place the change makes, and a fixed Lesson in it refuses the write.
function refuseInFrontOfTaught(db: Db, after: string[], fixed: Set<string>) {
	const inFront = after.find((id) => fixed.has(id));
	if (inFront) {
		throw new Refused(
			'conflict',
			`A Lesson cannot go in front of “${titleOf(db, inFront)}”, which was taught.`
		);
	}
}

// Rewrites the `position` of every Lesson in the Class's Sequence from a full order.
export function writeOrder(db: Db, classId: string, order: string[]) {
	order.forEach((lessonId, position) =>
		db
			.update(schema.classLesson)
			.set({ position })
			.where(
				and(eq(schema.classLesson.classId, classId), eq(schema.classLesson.lessonId, lessonId))
			)
			.run()
	);
}

// Remove: takes the Lessons out of this Class's Sequence, with the Readiness and Teaching note of
// each pair. The later Lessons move up into the free Slots. The Lessons stay, even a Standalone
// Lesson in no other Class. It refuses when any Lesson is fixed, and then changes nothing.
export function removeFromSequence(
	db: Db,
	{ classId, lessonIds, today }: { classId: string; lessonIds: string[]; today: string }
) {
	if (lessonIds.length === 0) throw new Refused('invalid', 'Pick a Lesson to remove.');
	const fixed = fixedLessonIds(db, classId, today);
	const taught = lessonIds.find((id) => fixed.has(id));
	if (taught !== undefined) {
		throw new Refused('conflict', `“${titleOf(db, taught)}” was taught, so it cannot be removed.`);
	}

	return writeSequence(db, { classId, today }, () => {
		db.delete(schema.classLesson)
			.where(
				and(
					eq(schema.classLesson.classId, classId),
					inArray(schema.classLesson.lessonId, lessonIds)
				)
			)
			.run();
		endPairing(db, classId, lessonIds);
		return {};
	});
}

// Add Lesson: makes a new Standalone Lesson (Length 1, Draft) in this Class only, and puts it in
// the Sequence straight after `afterLessonId`, or at the first untaught place when none is given:
// after the last fixed Lesson, or first when none is fixed. Nothing may go in front of a fixed
// Lesson, so a given Lesson with a fixed Lesson after it is refused.
export function addLesson(
	db: Db,
	{
		classId,
		title,
		afterLessonId,
		today
	}: { classId: string; title: string; afterLessonId?: string | null; today: string }
) {
	const name = required(title, 'A Lesson needs a title.');
	const order = sequenceLessonIds(db, classId);
	const fixed = fixedLessonIds(db, classId, today);

	let at: number;
	if (afterLessonId) {
		const index = order.indexOf(afterLessonId);
		if (index < 0) throw new Refused('invalid', 'That Lesson is not in this Sequence.');
		refuseInFrontOfTaught(db, order.slice(index + 1), fixed);
		at = index + 1;
	} else {
		at = order.findLastIndex((id) => fixed.has(id)) + 1;
	}

	return writeSequence(db, { classId, today }, () => {
		const [lesson] = db
			.insert(schema.lesson)
			.values({ topicId: null, title: name, position: 0 })
			.returning()
			.all();
		db.insert(schema.classLesson)
			.values({ classId, lessonId: lesson.id, position: order.length })
			.run();
		order.splice(at, 0, lesson.id);
		writeOrder(db, classId, order);
		return { lesson };
	});
}

export interface SequenceEntry {
	lessonId: string;
	title: string;
	topicId: string | null;
	topicName: string | null;
	length: number;
	status: LessonStatus;
	// The date of the Lesson's first part, or null when no Slot is left this year.
	firstDate: string | null;
	fixed: boolean;
	note: string | null;
	ready: boolean;
	// How many Slots the Lesson still takes: one per part not yet taught. Zero for a fixed Lesson.
	parts: number;
	// A Standalone Lesson that no other Class holds: after a removal no Class can add it again.
	onlyHere: boolean;
}

// One Slot of a week row. A Slot stays in its place; the Lessons move through the Slots.
//   movable  a Slot a Sequence Lesson may take, empty or not   taught   a fixed Lesson (it was taught)
//   placed   a Placement, fixed in its Slot                    past     a Slot before today with no Session
//   blocked  a Blocked Day or Blocked Slot
// What a movable Slot shows is laid out by the client from the Sequence order (layOutSequence).
export type WeekCell = { key: string; date: string; day: number; period: number } & (
	| { kind: 'movable' }
	| { kind: 'taught'; lessonId: string }
	// A Placement's Lesson is not in the Sequence, so the entries cannot name it.
	| { kind: 'placed'; title: string | null }
	| { kind: 'past' }
	| { kind: 'blocked' }
);

export type WeekRow =
	| { kind: 'week'; weekCommencing: string; letter: 'A' | 'B'; cells: WeekCell[] }
	| { kind: 'holiday'; from: string; to: string };

export interface TopicChip {
	topicId: string;
	name: string;
	// Lessons of the Topic in the Sequence that are not fixed.
	untaught: number;
}

export interface TopicOption {
	id: string;
	name: string;
	lessonCount: number;
	// Lessons of the Topic already in the Sequence or Placed on this Class.
	counted: number;
}

// The Course's Topics, by name, each with how many of its Lessons this Class's Sequence or a
// Placement on it already holds: what the Assign Topic menu lists.
export function topicOptions(
	db: Db,
	{ classId, courseId }: { classId: string; courseId: string }
): TopicOption[] {
	const held = new Set([...sequenceLessonIds(db, classId), ...placedLessonIds(db, classId)]);
	const topicLessons = db
		.select({ id: schema.lesson.id, topicId: schema.lesson.topicId })
		.from(schema.lesson)
		.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
		.where(eq(schema.topic.courseId, courseId))
		.all();
	return db
		.select({ id: schema.topic.id, name: schema.topic.name })
		.from(schema.topic)
		.where(eq(schema.topic.courseId, courseId))
		.orderBy(asc(schema.topic.name))
		.all()
		.map((topic) => {
			const lessons = topicLessons.filter((lesson) => lesson.topicId === topic.id);
			return {
				...topic,
				lessonCount: lessons.length,
				counted: lessons.filter((lesson) => held.has(lesson.id)).length
			};
		});
}

// The Sequence tab's read: the entries in order, and the Course's Topics with their counts.
export function sequenceView(db: Db, { classId, today }: { classId: string; today: string }) {
	const [cls] = db
		.select({ courseId: schema.classes.courseId })
		.from(schema.classes)
		.where(eq(schema.classes.id, classId))
		.all();
	if (!cls) return null;

	const fixed = fixedLessonIds(db, classId, today);
	const cal = loadCalendar(db);
	const result = scheduleFor(db, { classId, boundary: today, cal });
	const slots = firstSlotsOf(db, classId, result);
	// The parts each Sequence Lesson still takes. A Placement's parts are not the Sequence's.
	const parts = new Map<string, number>();
	for (const part of [...result.scheduled.filter((s) => !s.placementId), ...result.unplaced]) {
		parts.set(part.lessonId, (parts.get(part.lessonId) ?? 0) + 1);
	}
	const ready = new Set(
		db
			.select({ lessonId: schema.readiness.lessonId })
			.from(schema.readiness)
			.where(eq(schema.readiness.classId, classId))
			.all()
			.map((row) => row.lessonId)
	);
	const notes = teachingNotesOf(db, classId);

	const elsewhere = new Set([
		...db
			.select({ lessonId: schema.classLesson.lessonId })
			.from(schema.classLesson)
			.where(ne(schema.classLesson.classId, classId))
			.all()
			.map((row) => row.lessonId),
		...db
			.select({ lessonId: schema.placement.lessonId })
			.from(schema.placement)
			.where(ne(schema.placement.classId, classId))
			.all()
			.map((row) => row.lessonId)
	]);

	const entries: SequenceEntry[] = db
		.select({
			lessonId: schema.lesson.id,
			title: schema.lesson.title,
			topicId: schema.topic.id,
			topicName: schema.topic.name,
			length: schema.lesson.length,
			status: schema.lesson.status
		})
		.from(schema.classLesson)
		.innerJoin(schema.lesson, eq(schema.lesson.id, schema.classLesson.lessonId))
		.leftJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
		.where(eq(schema.classLesson.classId, classId))
		.orderBy(asc(schema.classLesson.position))
		.all()
		.map((row) => ({
			...row,
			firstDate: slots.get(row.lessonId) ?? null,
			fixed: fixed.has(row.lessonId),
			note: notes.get(row.lessonId) ?? null,
			ready: ready.has(row.lessonId),
			parts: fixed.has(row.lessonId) ? 0 : (parts.get(row.lessonId) ?? 0),
			onlyHere: row.topicId === null && !elsewhere.has(row.lessonId)
		}));

	const topics = topicOptions(db, { classId, courseId: cls.courseId });

	const { weeks, freeAfter } = weekRows(db, { classId, cal, result, fixed, entries });
	const chips = new Map<string, TopicChip>();
	for (const entry of entries) {
		if (!entry.topicId || !entry.topicName) continue;
		const chip = chips.get(entry.topicId) ?? {
			topicId: entry.topicId,
			name: entry.topicName,
			untaught: 0
		};
		if (!entry.fixed) chip.untaught++;
		chips.set(entry.topicId, chip);
	}

	return { entries, topics, weeks, freeAfter, chips: [...chips.values()] };
}

// The By week rows. They run from the week of the first Lesson that can still move to the week of
// the last, plus one week of free Slots; a School Holiday between two rows is one thin row. Every
// Slot of the Class stands in its place in its week. `freeAfter` counts the Open Slots the rows
// leave out, to the end of the year.
function weekRows(
	db: Db,
	{
		classId,
		cal,
		result,
		fixed,
		entries
	}: {
		classId: string;
		cal: ReturnType<typeof loadCalendar>;
		result: ScheduleResult;
		fixed: Set<string>;
		entries: SequenceEntry[];
	}
) {
	const inSequence = new Set(entries.map((e) => e.lessonId));
	const known = new Map<
		string,
		{ kind: 'taught' | 'placed'; lessonId: string } | { kind: 'movable' }
	>();
	const lessonKeys = new Set<string>();
	const openKeys = new Set<string>();
	const placedIds = new Set<string>();
	for (const s of result.history) {
		const kind = inSequence.has(s.lessonId) ? 'taught' : 'placed';
		if (kind === 'placed') placedIds.add(s.lessonId);
		known.set(occasionKey(s), { kind, lessonId: s.lessonId });
	}
	for (const s of result.scheduled) {
		const key = occasionKey(s);
		if (s.placementId || fixed.has(s.lessonId)) {
			const kind = s.placementId ? 'placed' : 'taught';
			if (kind === 'placed') placedIds.add(s.lessonId);
			known.set(key, { kind, lessonId: s.lessonId });
		} else {
			lessonKeys.add(key);
			known.set(key, { kind: 'movable' });
		}
	}
	for (const s of result.openSlots) {
		openKeys.add(occasionKey(s));
		known.set(occasionKey(s), { kind: 'movable' });
	}
	const titles = lessonNames(db, [...placedIds]);

	// A Slot of the Class that is not an Available Slot, and not known, is blocked. The walk over
	// the Timetable is `timetabledSlots`'; a date outside every Term takes no cell in these rows.
	const byWeek = new Map<string, TimetabledSlot[]>();
	for (const slot of timetabledSlots(cal, classId)) {
		if (slot.removedBy.some((removal) => removal.kind === 'outside-term')) continue;
		const week = mondayOf(slot.date);
		const group = byWeek.get(week);
		if (group) group.push(slot);
		else byWeek.set(week, [slot]);
	}

	const all = cal.teachingWeeks.map((week) => {
		const cells: WeekCell[] = [];
		for (const slot of byWeek.get(week.weekCommencing) ?? []) {
			const key = occasionKey(slot);
			const at = known.get(key);
			const base = { key, date: slot.date, day: weekday(slot.date), period: slot.period };
			if (!at) cells.push({ ...base, kind: slot.removedBy.length === 0 ? 'past' : 'blocked' });
			else if (at.kind === 'movable') cells.push({ ...base, kind: 'movable' });
			else if (at.kind === 'taught') cells.push({ ...base, kind: 'taught', lessonId: at.lessonId });
			else cells.push({ ...base, kind: 'placed', title: titles.get(at.lessonId)?.title ?? null });
		}
		return {
			kind: 'week' as const,
			weekCommencing: week.weekCommencing,
			letter: week.letter,
			cells
		};
	});

	const has = (keys: Set<string>) => (row: (typeof all)[number]) =>
		row.cells.some((cell) => keys.has(cell.key));
	let first = all.findIndex(has(lessonKeys));
	if (first === -1) first = all.findIndex(has(openKeys));
	if (first === -1) return { weeks: [] as WeekRow[], freeAfter: 0 };
	const last = all.findLastIndex(has(lessonKeys));
	const shown = all.slice(first, Math.min(Math.max(last, first) + 2, all.length));

	const weeks: WeekRow[] = [];
	for (const row of shown) {
		const before = weeks.at(-1);
		if (before?.kind === 'week' && row.weekCommencing > addDays(before.weekCommencing, 7)) {
			weeks.push({
				kind: 'holiday',
				from: addDays(before.weekCommencing, 7),
				to: addDays(row.weekCommencing, -3)
			});
		}
		weeks.push(row);
	}
	const freeShown = shown.reduce(
		(n, row) => n + row.cells.filter((c) => openKeys.has(c.key)).length,
		0
	);
	return { weeks, freeAfter: result.openSlots.length - freeShown };
}
