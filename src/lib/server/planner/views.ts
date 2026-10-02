// The derived views over every Class at once: the Agenda's chronological stream, its look-back
// over the past week, and the Calendar's one-week grid. The forward views run the same
// `scheduleFor` every write and every other read runs, so a cell, an Agenda row and the Session
// panel can never disagree about one occasion. The look-back, and the Calendar before today, read
// the recorded Sessions.
import { and, eq, gte, lt } from 'drizzle-orm';
import { addDays, weekday } from '$lib/date';
import * as schema from '../db/schema';
import { tagsByLesson, type LessonStatus } from './authoring';
import {
	lessonNames,
	loadCalendar,
	scheduleFor,
	teachingWeeks,
	type Db,
	type LessonName
} from './derive';
import {
	agendaRows,
	inAnyTerm,
	slotHolds,
	type AgendaRow,
	type Calendar,
	type SessionRecord
} from './engine';
import { listClasses } from './classes';

type ClassRow = ReturnType<typeof listClasses>[number];
type Batch = { cls: ClassRow; rows: AgendaRow[]; history: SessionRecord[] };

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
	return classes.map((cls) => {
		const result = scheduleFor(db, { classId: cls.id, boundary: today, cal });
		return { cls, rows: agendaRows(cls.id, result).filter(keep), history: result.history };
	});
}

// One recorded occasion: a Lesson with Length above one, or a Continuation, is one run across its
// consecutive Periods on one date. The rule the forward view's `agendaRows` applies to `scheduled`,
// applied to the record. `sessions` must be sorted by Class, date and Period.
type SessionRun = {
	classId: string;
	date: string;
	periodFrom: number;
	periodTo: number;
	lessonId: string;
};

function sessionRuns(sessions: readonly SessionRecord[]): SessionRun[] {
	const runs: SessionRun[] = [];
	for (const s of sessions) {
		const prev = runs[runs.length - 1];
		if (
			prev?.classId === s.classId &&
			prev.date === s.date &&
			prev.periodTo + 1 === s.period &&
			prev.lessonId === s.lessonId
		) {
			prev.periodTo = s.period;
			continue;
		}
		runs.push({
			classId: s.classId,
			date: s.date,
			periodFrom: s.period,
			periodTo: s.period,
			lessonId: s.lessonId
		});
	}
	return runs;
}

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
		tags: string[];
	} | null;
}

// One Agenda row before its Lesson is looked up: the part `agenda` and `agendaLookBack` differ on.
type Occasion = {
	cls: ClassRow;
	date: string;
	week: 'A' | 'B';
	periodFrom: number;
	periodTo: number;
	lessonId: string | null;
};

// Title, Topic and Tags for every Lesson in one query each, then sorted by date and Period.
function toEntries(
	db: Db,
	occasions: Occasion[],
	ready: (lessonId: string, classId: string) => boolean
): AgendaEntry[] {
	const lessonIds = [...new Set(occasions.flatMap((o) => (o.lessonId ? [o.lessonId] : [])))];
	const names = lessonNames(db, lessonIds);
	const tags = tagsByLesson(db, lessonIds);

	return occasions
		.map(({ cls, lessonId, ...o }) => {
			const lessonInfo = lessonId ? names.get(lessonId) : undefined;
			return {
				classId: cls.id,
				classLabel: cls.label,
				tone: cls.tone,
				date: o.date,
				week: o.week,
				periodFrom: o.periodFrom,
				periodTo: o.periodTo,
				lesson:
					lessonId && lessonInfo
						? {
								id: lessonId,
								title: lessonInfo.title,
								topicName: lessonInfo.topicName,
								ready: ready(lessonId, cls.id),
								tags: tags.get(lessonId) ?? []
							}
						: null
			};
		})
		.sort((a, b) => a.date.localeCompare(b.date) || a.periodFrom - b.periodFrom);
}

// The chronological stream of upcoming Sessions across every Class, grouped by day (issue #34).
// Windowed to a horizon of calendar days from `today` — so a weekend or a Blocked Day inside it
// honestly produces no row, rather than being padded out to look like a full week of teaching.
// A `null` horizon keeps every row to the close of the last Term (issue #281). `lastTermCloses`
// is that day, for the prose about the window.
export function agenda(
	db: Db,
	{ today, horizonDays }: { today: string; horizonDays: number | null }
): { rows: AgendaEntry[]; lastTermCloses: string } {
	const horizonEnd = horizonDays === null ? null : addDays(today, horizonDays);
	const cal = loadCalendar(db);
	const batches = derivedRows(db, {
		classes: listClasses(db),
		cal,
		today,
		keep: (r) => horizonEnd === null || r.date < horizonEnd
	});
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

	return {
		rows: toEntries(
			db,
			batches.flatMap(({ cls, rows }) =>
				rows.map((r) => ({ cls, ...r, lessonId: r.lesson?.lessonId ?? null }))
			),
			(lessonId, classId) => readinessSet.has(`${lessonId}|${classId}`)
		),
		// With no Terms, the window ends today.
		lastTermCloses: cal.terms.reduce((last, t) => (t.closes > last ? t.closes : last), today)
	};
}

const LOOK_BACK_DAYS = 7;

// The Sessions of the seven calendar days before `today`, across every Class (issue #273). Read
// straight from the record: a Session dated before `today` is history, and nothing re-derives it.
// A weekend, a Blocked Day or a holiday inside the window has no Session, so it gives no row. An
// Open Slot has no Session either. Readiness is never read for a past day, so every row is not ready.
export function agendaLookBack(db: Db, { today }: { today: string }): AgendaEntry[] {
	const classes = new Map(listClasses(db).map((c) => [c.id, c]));
	const letters = new Map(teachingWeeks(db).map((w) => [w.weekCommencing, w.letter]));
	const sessions = db
		.select({
			classId: schema.session.classId,
			date: schema.session.date,
			period: schema.session.period,
			lessonId: schema.session.lessonId
		})
		.from(schema.session)
		.where(
			and(gte(schema.session.date, addDays(today, -LOOK_BACK_DAYS)), lt(schema.session.date, today))
		)
		.orderBy(schema.session.classId, schema.session.date, schema.session.period)
		.all()
		.filter((s): s is SessionRecord => s.lessonId !== null);

	const occasions = sessionRuns(sessions).flatMap(({ classId, ...run }): Occasion[] => {
		const cls = classes.get(classId);
		const week = letters.get(addDays(run.date, 1 - weekday(run.date)));
		return cls && week ? [{ cls, week, ...run }] : [];
	});

	return toEntries(db, occasions, () => false);
}

export interface CalendarCell {
	date: string;
	// Dated before `today`: the record, not the plan. A past cell is never blocked for being past.
	past: boolean;
	periodFrom: number;
	periodTo: number;
	classId: string;
	classLabel: string;
	tone: number;
	kind: 'lesson' | 'open' | 'blocked';
	lesson: LessonName | null;
	blockedNote: string | null;
	// One id per Period the cell covers, in order: slotIds[i] belongs to periodFrom + i. The
	// rule is the engine's AgendaRow's — the cell only passes its list through. A recorded
	// Session on a position no Slot holds any more has none: there is no Slot left to block.
	slotIds: string[];
	blockedDayId: string | null;
	blockedSlotId: string | null;
}

// The three states a day column in the Calendar can show: an ordinary teaching day, a Blocked
// Day, or a School Holiday — a date outside every Term. When a Blocked Day is entered outside
// every Term, the holiday wins: the school is simply not running, and the header's unblock
// control remains the way to remove the day.
export type DayKind = 'teaching' | 'blocked' | 'holiday';

export interface CalendarWeek {
	weekCommencing: string;
	letter: 'A' | 'B';
	days: { date: string; kind: DayKind }[];
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

// The Slots that hold one position in a Teaching Week of the given letter, on that date.
const slotsAt = (cal: Calendar, letter: 'A' | 'B', date: string, period: number) =>
	cal.slots.filter(
		(s) => s.week === letter && s.day === weekday(date) && s.period === period && slotHolds(s, date)
	);

// The positions that the schedule and the record leave out, but that a Class still holds on the
// raw Timetable. A Blocked Day, a Blocked Slot or a date outside every Term makes a removed cell.
// The cell carries the note of its block. The grid then shows whose position it is. Any other
// such position is a past Open Slot: the engine lays nothing before `today`, and an Open Slot
// records no Session. A position that no Class holds gets no cell: it is free, not blocked.
function uncoveredCells(
	db: Db,
	{
		dates,
		today,
		letter,
		cal,
		classes,
		covered
	}: {
		dates: string[];
		today: string;
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

	return dates.flatMap((date) => {
		const cells: CalendarCell[] = [];
		for (let period = 1; period <= PERIODS_PER_DAY; period++) {
			if (covered.has(`${date}|${period}`)) continue;

			const [slot] = slotsAt(cal, letter, date, period);
			const cls = slot && byId.get(slot.classId);
			if (!slot || !cls) continue;

			const dayBlock = dayBlocks.get(date);
			const slotBlock = slotBlocks.get(`${cls.id}|${date}|${slot.id}`);
			const blocked = dayBlock || slotBlock || !inAnyTerm(cal.terms, date);
			cells.push({
				date,
				past: date < today,
				periodFrom: period,
				periodTo: period,
				classId: cls.id,
				classLabel: cls.label,
				tone: cls.tone,
				kind: blocked ? 'blocked' : 'open',
				lesson: null,
				blockedNote: dayBlock?.note ?? slotBlock?.note ?? null,
				slotIds: [slot.id],
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

	// Before `today` the engine lays nothing: those positions come from its `history`, the record.
	const slotAt = (classId: string, date: string, period: number) =>
		slotsAt(cal, week.letter, date, period).find((s) => s.classId === classId);
	const occupied = batches.map(({ cls, rows, history }) => ({
		cls,
		rows: [
			...sessionRuns(history.filter((s) => dateSet.has(s.date))).map((run) => {
				const slots = Array.from({ length: run.periodTo - run.periodFrom + 1 }, (_, i) =>
					slotAt(cls.id, run.date, run.periodFrom + i)
				);
				return {
					...run,
					slotIds: slots.every((s) => s !== undefined) ? slots.map((s) => s.id) : []
				};
			}),
			...rows.map((r) => ({ ...r, lessonId: r.lesson?.lessonId ?? null }))
		]
	}));
	const names = lessonNames(db, [
		...new Set(occupied.flatMap(({ rows }) => rows.flatMap((r) => r.lessonId ?? [])))
	]);

	const covered = new Set<string>();
	const cells: CalendarCell[] = occupied.flatMap(({ cls, rows }) =>
		rows.map((r): CalendarCell => {
			for (let p = r.periodFrom; p <= r.periodTo; p++) covered.add(`${r.date}|${p}`);
			return {
				date: r.date,
				past: r.date < today,
				periodFrom: r.periodFrom,
				periodTo: r.periodTo,
				classId: cls.id,
				classLabel: cls.label,
				tone: cls.tone,
				kind: r.lessonId ? 'lesson' : 'open',
				lesson: r.lessonId ? (names.get(r.lessonId) ?? null) : null,
				blockedNote: null,
				slotIds: r.slotIds,
				blockedDayId: null,
				blockedSlotId: null
			};
		})
	);

	cells.push(...uncoveredCells(db, { dates, today, letter: week.letter, cal, classes, covered }));

	const dayBlocks = blockedDaysByDate(db);
	return {
		weekCommencing,
		letter: week.letter,
		days: dates.map((date) => ({
			date,
			kind: !inAnyTerm(cal.terms, date) ? 'holiday' : dayBlocks.has(date) ? 'blocked' : 'teaching'
		})),
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
	tags: string[];
}

// The Planning stream: one row per Lesson across every Course and Topic, ordered by soonest next
// Scheduled occurrence on or after `today` across all Classes (ADR-0007). Lessons with no scheduled
// occurrence sit at the bottom. Given a `classId`, the occurrence comes from that Class's schedule
// only, and Lessons it does not teach from `today` on are left out.
export function planningStream(db: Db, today: string, classId?: string): PlanningEntry[] {
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
	const classes = listClasses(db).filter((c) => !classId || c.id === classId);

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

	const tags = tagsByLesson(
		db,
		lessons.map((l) => l.id)
	);

	const entries: EntryWithPosition[] = lessons
		.filter((l) => !classId || soonestByLesson.has(l.id))
		.map((l) => ({
			id: l.id,
			title: l.title,
			topicName: l.topicName,
			courseName: l.courseName,
			status: l.status,
			position: l.position,
			occurrence: soonestByLesson.get(l.id) ?? null,
			tags: tags.get(l.id) ?? []
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
		occurrence: entry.occurrence,
		tags: entry.tags
	}));
}
