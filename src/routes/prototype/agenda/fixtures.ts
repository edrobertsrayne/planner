/*
	PROTOTYPE — throwaway. Issue #68: what does the Agenda look like at real density?

	A hand-written fortnight for a plausible UK secondary physics teacher, so the prototype runs on
	an empty database with no login. Same trade the Session prototype (#62) made: the question here
	is layout at density, and for that the schedule only has to be dense and realistic.

	Class ids are the real ones `classTone()` hashes, and they were *chosen* so the eight Classes
	land on eight different tones. That is not what six arbitrary ids do — `cls-7x`, `cls-8y`,
	`cls-9a`, `cls-10b`, `cls-11c`, `cls-12d` put three of six on tone 0. The hash collides readily
	at this size; worth knowing when the tones are wired for real.
*/

export interface AgendaRow {
	classId: string;
	classLabel: string;
	tone: number;
	date: string;
	week: 'A' | 'B';
	periodFrom: number;
	periodTo: number;
	room: string;
	lesson: { title: string; topicName: string } | null;
}

export const PERIODS = [1, 2, 3, 4, 5];

/** Period → the clock time it starts, for the surfaces that want a time rather than a number. */
export const PERIOD_TIMES: Record<number, string> = {
	1: '08:50',
	2: '09:50',
	3: '11:10',
	4: '12:10',
	5: '14:00'
};

const CLASSES = [
	{ id: 'cls-7x', label: '7X/Sc1', room: 'S4', topic: 'Forces and motion' },
	{ id: 'cls-7z', label: '7Z/Sc3', room: 'S4', topic: 'Space' },
	{ id: 'cls-8b', label: '8B/Sc2', room: 'S2', topic: 'Energy' },
	{ id: 'cls-9a', label: '9A/Ph1', room: 'S4', topic: 'Electricity' },
	{ id: 'cls-9x', label: '9X/Sc4', room: 'S1', topic: 'Waves' },
	{ id: 'cls-10a', label: '10A/Ph', room: 'S4', topic: 'Radioactivity' },
	{ id: 'cls-10b', label: '10B/Ph', room: 'S3', topic: 'Particle model' },
	{ id: 'cls-11d', label: '11D/Ph', room: 'S4', topic: 'Revision' }
];

const TONE_OF: Record<string, number> = {
	'cls-7x': 4,
	'cls-7z': 6,
	'cls-8b': 5,
	'cls-9a': 3,
	'cls-9x': 2,
	'cls-10a': 7,
	'cls-10b': 0,
	'cls-11d': 1
};

const LESSONS: Record<string, string[]> = {
	'cls-7x': ['Measuring speed', 'Distance–time graphs', 'Forces as arrows'],
	'cls-7z': ['The day and the year', 'Phases of the Moon', 'Seasons'],
	'cls-8b': ['Energy stores and transfers', 'Wasted energy', 'Power and efficiency'],
	'cls-9a': ['Series and parallel circuits', 'Current and charge', 'Resistance'],
	'cls-9x': ['Waves on a rope', 'Reflection', 'Refraction'],
	'cls-10a': ['Types of radiation', 'Half-life', 'Uses and dangers'],
	'cls-10b': ['Required practical: specific heat capacity', 'Internal energy', 'Gas pressure'],
	'cls-11d': ['Past paper walkthrough — P1 Q4–Q7', 'Required practical recall', 'Equation drill']
};

/* [dayIndex 0=Mon..4=Fri, periodFrom, periodTo, classIndex] — Week A then Week B. A busy but not
   impossible fortnight: 19 and 18 periods, a couple of doubles, and real free periods. */
const WEEK_A: [number, number, number, number][] = [
	[0, 1, 1, 0],
	[0, 2, 2, 3],
	[0, 4, 5, 6],
	[1, 1, 1, 7],
	[1, 3, 3, 2],
	[1, 4, 4, 1],
	[1, 5, 5, 4],
	[2, 2, 2, 0],
	[2, 3, 3, 5],
	[2, 4, 4, 3],
	[3, 1, 2, 6],
	[3, 3, 3, 7],
	[3, 5, 5, 1],
	[4, 1, 1, 2],
	[4, 2, 2, 4],
	[4, 3, 3, 5],
	[4, 5, 5, 0]
];

const WEEK_B: [number, number, number, number][] = [
	[0, 1, 1, 3],
	[0, 3, 3, 7],
	[0, 5, 5, 2],
	[1, 2, 3, 6],
	[1, 4, 4, 0],
	[2, 1, 1, 1],
	[2, 2, 2, 5],
	[2, 4, 4, 4],
	[2, 5, 5, 7],
	[3, 1, 1, 2],
	[3, 2, 2, 0],
	[3, 4, 5, 6],
	[4, 1, 1, 3],
	[4, 3, 3, 1],
	[4, 4, 4, 5]
];

export function addDays(iso: string, n: number): string {
	const d = new Date(iso + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** The Monday of the week `iso` falls in; Sat/Sun roll forward to the next Monday. */
export function mondayOf(iso: string): string {
	const day = new Date(iso + 'T00:00:00Z').getUTCDay(); // 0=Sun .. 6=Sat
	if (day === 0) return addDays(iso, 1);
	if (day === 6) return addDays(iso, 2);
	return addDays(iso, 1 - day);
}

function build(monday: string, letter: 'A' | 'B'): AgendaRow[] {
	const table = letter === 'A' ? WEEK_A : WEEK_B;
	return table.map(([dayIndex, periodFrom, periodTo, classIndex], i) => {
		const cls = CLASSES[classIndex];
		// Not everything is planned. Roughly one in five Slots is still Unplanned, and Week B more
		// than Week A — the further out you look, the emptier it gets, which is the honest case.
		const planned = letter === 'A' ? i % 6 !== 2 : i % 3 !== 1;
		const titles = LESSONS[cls.id];
		return {
			classId: cls.id,
			classLabel: cls.label,
			tone: TONE_OF[cls.id],
			date: addDays(monday, dayIndex),
			week: letter,
			periodFrom,
			periodTo,
			room: cls.room,
			lesson: planned ? { title: titles[i % titles.length], topicName: cls.topic } : null
		};
	});
}

const byDateThenPeriod = (a: AgendaRow, b: AgendaRow) =>
	(a.date + String(a.periodFrom).padStart(2, '0')).localeCompare(
		b.date + String(b.periodFrom).padStart(2, '0')
	);

export type DataSet = 'full' | 'sparse' | 'empty';

/**
 * `full` is the fortnight from today. `sparse` is the end-of-term case — a couple of occasions
 * scattered over the same window, which is where a day-grouped list starts to look like mostly
 * headings. `empty` is a horizon with nothing in it at all.
 */
export function agendaFixture(today: string, dataSet: DataSet = 'full'): AgendaRow[] {
	if (dataSet === 'empty') return [];
	const monday = mondayOf(today);
	const rows = [...build(monday, 'A'), ...build(addDays(monday, 7), 'B')]
		.filter((r) => r.date >= today)
		.sort(byDateThenPeriod);
	if (dataSet === 'sparse') {
		// One occasion on every third day, so the fortnight holds a handful of lessons spread thin
		// rather than a short dense list. That is the case a day-grouped list has to survive.
		const dates = [...new Set(rows.map((r) => r.date))].filter((_, i) => i % 3 === 0);
		return dates.map((d) => rows.find((r) => r.date === d)!);
	}
	return rows;
}

/** Rows inside the horizon window, counted in days from today inclusive. */
export function withinHorizon(rows: AgendaRow[], today: string, horizonDays: number) {
	const last = addDays(today, horizonDays - 1);
	return rows.filter((r) => r.date <= last);
}

export const HORIZONS: [number, string][] = [
	[1, 'Today'],
	[3, '3 days'],
	[7, 'Week'],
	[14, 'Fortnight']
];
