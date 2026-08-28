// The two derived views over every Class at once: the Agenda's chronological stream and the
// Calendar's one-week grid. Both run the same `scheduleFor` every write and every other read
// runs, so a cell, an Agenda row and the Session panel can never disagree about one occasion.
import { eq } from 'drizzle-orm';
import { addDays } from '$lib/date';
import * as schema from '../db/schema';
import { type LessonStatus } from './authoring';
import { lessonNames, loadCalendar, scheduleFor, type Db, type LessonName } from './derive';
import { agendaRows, slotHolds, type AgendaRow, type Calendar } from './engine';
import { listClasses } from './classes';

type ClassRow = ReturnType<typeof listClasses>[number];
type Batch = { cls: ClassRow; rows: AgendaRow[] };

// Every Class's rows for one derived view. The Calendar and the Class list are loaded once for
// the whole batch rather than re-read per Class.
function derivedRows(
	db: Db,
	{
		classes,
		cal,
		today,
		keep
	}: { classes: ClassRow[]; cal: Calendar; today: string; keep: (row: AgendaRow) => boolean }
): Batch[] {
	return classes.map((cls) => ({
		cls,
		rows: agendaRows(cls.id, scheduleFor(db, { classId: cls.id, boundary: today, cal })).filter(
			keep
		)
	}));
}

// One query for every Lesson the batch is about to render.
const namesFor = (db: Db, batches: Batch[]) =>
	lessonNames(db, [
		...new Set(
			batches.flatMap(({ rows }) => rows.flatMap((r) => (r.lesson ? [r.lesson.lessonId] : [])))
		)
	]);

const sortKey = (r: { date: string; periodFrom: number }) =>
	r.date + String(r.periodFrom).padStart(2, '0');

export interface AgendaEntry {
	classId: string;
	classLabel: string;
	tone: number;
	date: string;
	week: 'A' | 'B';
	periodFrom: number;
	periodTo: number;
	lesson: {
		id: string;
		title: string;
		topicName: string | null;
		ready: boolean;
	} | null;
}

// The chronological stream of upcoming Sessions across every Class, grouped by day (issue #34).
// Windowed to a horizon of calendar days from `today` — so a weekend or a Blocked Day inside it
// honestly produces no row, rather than being padded out to look like a full week of teaching.
export function agenda(
	db: Db,
	{ today, horizonDays }: { today: string; horizonDays: number }
): AgendaEntry[] {
	const horizonEnd = addDays(today, horizonDays);
	const batches = derivedRows(db, {
		classes: listClasses(db),
		cal: loadCalendar(db),
		today,
		keep: (r) => r.date < horizonEnd
	});
	const names = namesFor(db, batches);
	const readinessSet = new Set(
		db
			.select({
				lessonId: schema.readiness.lessonId,
				classId: schema.readiness.classId
			})
			.from(schema.readiness)
			.all()
			.map((r) => `${r.lessonId}|${r.classId}`)
	);

	return batches
		.flatMap(({ cls, rows }) =>
			rows.map((r) => {
				const lessonId = r.lesson?.lessonId;
				const lessonInfo = lessonId ? names.get(lessonId) : undefined;
				return {
					classId: cls.id,
					classLabel: cls.label,
					tone: cls.tone,
					date: r.date,
					week: r.week,
					periodFrom: r.periodFrom,
					periodTo: r.periodTo,
					lesson:
						lessonId && lessonInfo
							? {
									id: lessonId,
									title: lessonInfo.title,
									topicName: lessonInfo.topicName,
									ready: readinessSet.has(`${lessonId}|${cls.id}`)
								}
							: null
				};
			})
		)
		.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export interface CalendarCell {
	date: string;
	periodFrom: number;
	periodTo: number;
	classId: string;
	classLabel: string;
	tone: number;
	kind: 'lesson' | 'open' | 'blocked';
	lesson: LessonName | null;
	blockedNote: string | null;
	slotId: string;
	blockedDayId: string | null;
	blockedSlotId: string | null;
}

export interface CalendarWeek {
	weekCommencing: string;
	letter: 'A' | 'B';
	dates: string[];
	cells: CalendarCell[];
	blockedDays: { id: string; date: string; note: string | null }[];
}

const PERIODS_PER_DAY = 6;

function blockedDaysByDate(db: Db) {
	return new Map(
		db
			.select({
				id: schema.blockedDay.id,
				date: schema.blockedDay.date,
				note: schema.blockedDay.note
			})
			.from(schema.blockedDay)
			.all()
			.map((row) => [row.date, row])
	);
}

// The positions the schedule stayed silent on — a Blocked Day, a Blocked Slot, or a date outside
// every Term, none of which ever reach availableSlots — but which a Class still holds on the raw
// Timetable. Shown as removed, with whichever block explains them, so the grid says whose
// position it is rather than leaving it looking like a Period nobody teaches. A position no
// Class holds is left out entirely: genuinely free, not blocked.
function blockedCells(
	db: Db,
	{
		dates,
		letter,
		cal,
		classes,
		covered
	}: {
		dates: string[];
		letter: 'A' | 'B';
		cal: Calendar;
		classes: ClassRow[];
		covered: Set<string>;
	}
): CalendarCell[] {
	const byId = new Map(classes.map((c) => [c.id, c]));
	const dayBlocks = blockedDaysByDate(db);
	const slotBlocks = new Map(
		db
			.select({
				id: schema.blockedSlot.id,
				classId: schema.blockedSlot.classId,
				date: schema.blockedSlot.date,
				slotId: schema.blockedSlot.slotId,
				note: schema.blockedSlot.note
			})
			.from(schema.blockedSlot)
			.all()
			.map((row) => [`${row.classId}|${row.date}|${row.slotId}`, row])
	);

	return dates.flatMap((date, i) => {
		const cells: CalendarCell[] = [];
		for (let period = 1; period <= PERIODS_PER_DAY; period++) {
			if (covered.has(`${date}|${period}`)) continue;

			const slot = cal.slots.find(
				(s) => s.week === letter && s.day === i + 1 && s.period === period && slotHolds(s, date)
			);
			const cls = slot && byId.get(slot.classId);
			if (!slot || !cls) continue;

			const dayBlock = dayBlocks.get(date);
			const slotBlock = slotBlocks.get(`${cls.id}|${date}|${slot.id}`);
			cells.push({
				date,
				periodFrom: period,
				periodTo: period,
				classId: cls.id,
				classLabel: cls.label,
				tone: cls.tone,
				kind: 'blocked',
				lesson: null,
				blockedNote: dayBlock?.note ?? slotBlock?.note ?? null,
				slotId: slot.id,
				blockedDayId: dayBlock?.id ?? null,
				blockedSlotId: slotBlock?.id ?? null
			});
		}
		return cells;
	});
}

// One Teaching Week as Periods × days, across every Class (issue #36).
export function calendarWeek(
	db: Db,
	{ weekCommencing, today }: { weekCommencing: string; today: string }
): CalendarWeek | null {
	const cal = loadCalendar(db);
	const week = cal.teachingWeeks.find((w) => w.weekCommencing === weekCommencing);
	if (!week) return null;

	const dates = Array.from({ length: 5 }, (_, i) => addDays(weekCommencing, i));
	const dateSet = new Set(dates);
	const classes = listClasses(db);

	const batches = derivedRows(db, { classes, cal, today, keep: (r) => dateSet.has(r.date) });
	const names = namesFor(db, batches);

	const covered = new Set<string>();
	const cells: CalendarCell[] = batches.flatMap(({ cls, rows }) =>
		rows.map((r): CalendarCell => {
			for (let p = r.periodFrom; p <= r.periodTo; p++) covered.add(`${r.date}|${p}`);
			return {
				date: r.date,
				periodFrom: r.periodFrom,
				periodTo: r.periodTo,
				classId: cls.id,
				classLabel: cls.label,
				tone: cls.tone,
				kind: r.lesson ? 'lesson' : 'open',
				lesson: r.lesson ? (names.get(r.lesson.lessonId) ?? null) : null,
				blockedNote: null,
				slotId: r.slotId,
				blockedDayId: null,
				blockedSlotId: null
			};
		})
	);

	cells.push(...blockedCells(db, { dates, letter: week.letter, cal, classes, covered }));

	const dayBlocks = blockedDaysByDate(db);
	return {
		weekCommencing,
		letter: week.letter,
		dates,
		cells,
		blockedDays: dates.flatMap((date) => {
			const row = dayBlocks.get(date);
			return row ? [{ id: row.id, date, note: row.note }] : [];
		})
	};
}

export interface PlanningOccurrence {
	classId: string;
	label: string;
	tone: number;
	date: string;
	period: number;
}

export interface PlanningEntry {
	id: string;
	title: string;
	topicName: string | null;
	courseName: string | null;
	status: LessonStatus;
	occurrence: PlanningOccurrence | null;
}

// The Planning stream: one row per Lesson across every Course and Topic, ordered by soonest next
// Scheduled occurrence on or after `today` across all Classes (ADR-0007). Lessons with no scheduled
// occurrence sit at the bottom.
export function planningStream(db: Db, today: string): PlanningEntry[] {
	const lessons = db
		.select({
			id: schema.lesson.id,
			title: schema.lesson.title,
			status: schema.lesson.status,
			position: schema.lesson.position,
			topicId: schema.topic.id,
			topicName: schema.topic.name,
			courseId: schema.course.id,
			courseName: schema.course.name
		})
		.from(schema.lesson)
		.leftJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
		.leftJoin(schema.course, eq(schema.course.id, schema.topic.courseId))
		.all();

	const cal = loadCalendar(db);
	const classes = listClasses(db);

	const soonestByLesson = new Map<string, PlanningOccurrence>();

	for (const cls of classes) {
		const result = scheduleFor(db, { classId: cls.id, boundary: today, cal });
		for (const s of result.scheduled) {
			const current = soonestByLesson.get(s.lessonId);
			const isSooner =
				!current || s.date < current.date || (s.date === current.date && s.period < current.period);

			if (isSooner) {
				soonestByLesson.set(s.lessonId, {
					classId: cls.id,
					label: cls.label,
					tone: cls.tone,
					date: s.date,
					period: s.period
				});
			}
		}
	}

	type EntryWithPosition = PlanningEntry & { position: number };

	const entries: EntryWithPosition[] = lessons.map((l) => ({
		id: l.id,
		title: l.title,
		topicName: l.topicName,
		courseName: l.courseName,
		status: l.status,
		position: l.position,
		occurrence: soonestByLesson.get(l.id) ?? null
	}));

	const compareSecondary = (a: EntryWithPosition, b: EntryWithPosition) => {
		const ca = a.courseName ?? '';
		const cb = b.courseName ?? '';
		const c = ca.localeCompare(cb);
		if (c !== 0) return c;
		const ta = a.topicName ?? '';
		const tb = b.topicName ?? '';
		const t = ta.localeCompare(tb);
		if (t !== 0) return t;
		return a.position - b.position;
	};

	entries.sort((a, b) => {
		if (a.occurrence && b.occurrence) {
			const d = a.occurrence.date.localeCompare(b.occurrence.date);
			if (d !== 0) return d;
			const p = a.occurrence.period - b.occurrence.period;
			if (p !== 0) return p;
			return compareSecondary(a, b);
		}
		if (a.occurrence) return -1;
		if (b.occurrence) return 1;
		return compareSecondary(a, b);
	});

	return entries.map((entry) => ({
		id: entry.id,
		title: entry.title,
		topicName: entry.topicName,
		courseName: entry.courseName,
		status: entry.status,
		occurrence: entry.occurrence
	}));
}
