// The two derived views over every Class at once: the Agenda's chronological stream and the
// Calendar's one-week grid. Both run the same `scheduleFor` every write and every other read
// runs, so a cell, an Agenda row and the Session panel can never disagree about one occasion.
import { eq } from 'drizzle-orm';
import { addDays } from '$lib/date';
import * as schema from '../db/schema';
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
	lesson: LessonName | null;
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

	return batches
		.flatMap(({ cls, rows }) =>
			rows.map((r) => ({
				classId: cls.id,
				classLabel: cls.label,
				tone: cls.tone,
				date: r.date,
				week: r.week,
				periodFrom: r.periodFrom,
				periodTo: r.periodTo,
				lesson: r.lesson ? (names.get(r.lesson.lessonId) ?? null) : null
			}))
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
	kind: 'lesson' | 'unplanned' | 'blocked';
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
	const [week] = db
		.select({ letter: schema.teachingWeek.letter })
		.from(schema.teachingWeek)
		.where(eq(schema.teachingWeek.weekCommencing, weekCommencing))
		.all();
	if (!week) return null;

	const dates = Array.from({ length: 5 }, (_, i) => addDays(weekCommencing, i));
	const dateSet = new Set(dates);
	const cal = loadCalendar(db);
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
				kind: r.lesson ? 'lesson' : 'unplanned',
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
