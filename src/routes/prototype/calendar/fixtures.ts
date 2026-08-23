/*
	PROTOTYPE — throwaway. Issue #69: what does the Calendar (Teaching Week) grid look like at real
	density?

	A hand-written Teaching Week for the same plausible physics teacher the Agenda prototype (#68)
	invented, so this runs on an empty database with no login. Same eight Classes, same eight tones,
	same rooms — the two screens have to be judged against each other, and they can't be if their
	fixtures disagree.

	The week is deliberately loaded with every state the ticket asks to see at once, because the
	question is how they read *together* in one grid, not one at a time:

	  - planned Lessons, including two multi-Period ones (a double and a triple);
	  - Unplanned Slots, which keep the Class's colour and show no Lesson (CONTEXT.md, Calendar);
	  - Blocked Slots with notes — the school is open, this Class is not taught;
	  - one Blocked Day — Thursday, an INSET day, which blocks every Slot on it;
	  - real free Periods, which are neither.
*/

export type CellKind = 'lesson' | 'unplanned' | 'blocked';

export interface Cell {
	classId: string;
	classLabel: string;
	tone: number;
	dayIndex: number;
	periodFrom: number;
	periodTo: number;
	/**
	 * Fixture-only, and the grid does not show it: Room is neither a term in CONTEXT.md nor a
	 * column in the data, and at the tile's right edge it collided with the block control. Kept on
	 * the fixture so this screen and the Agenda's (#68) stay the same data.
	 */
	room: string;
	kind: CellKind;
	lesson?: { title: string; topicName: string };
	/** Free text on a Blocked Slot. A Blocked Day carries none — the cause is not recorded. */
	blockedNote?: string;
	/** True where this cell is blocked because the whole day is, not this Slot alone. */
	fromBlockedDay?: boolean;
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const PERIODS = [1, 2, 3, 4, 5, 6];

/** Period → the clock time it starts. The Agenda leans on these; the grid may or may not want them. */
export const PERIOD_TIMES: Record<number, string> = {
	1: '08:50',
	2: '09:50',
	3: '11:10',
	4: '12:10',
	5: '14:00',
	6: '15:00'
};

const CLASSES = [
	{ id: 'cls-7x', label: '7X/Sc1', tone: 4, room: 'S4', topic: 'Forces and motion' },
	{ id: 'cls-7z', label: '7Z/Sc3', tone: 6, room: 'S4', topic: 'Space' },
	{ id: 'cls-8b', label: '8B/Sc2', tone: 5, room: 'S2', topic: 'Energy' },
	{ id: 'cls-9a', label: '9A/Ph1', tone: 3, room: 'S4', topic: 'Electricity' },
	{ id: 'cls-9x', label: '9X/Sc4', tone: 2, room: 'S1', topic: 'Waves' },
	{ id: 'cls-10a', label: '10A/Ph', tone: 7, room: 'S4', topic: 'Radioactivity' },
	{ id: 'cls-10b', label: '10B/Ph', tone: 0, room: 'S3', topic: 'Particle model' },
	{ id: 'cls-11d', label: '11D/Ph', tone: 1, room: 'S4', topic: 'Revision' }
];

type Row = [
	day: number,
	from: number,
	to: number,
	cls: number,
	title: string | null,
	note?: string
];

/*
	[day 0=Mon..4=Fri, periodFrom, periodTo, class index, Lesson title or null for Unplanned, note]
	A note makes it a Blocked Slot. Thursday is an INSET day and is derived, not listed.
	Long titles are in here on purpose — "Required practical: specific heat capacity" is the length
	that decides whether a cell needs three lines or truncates.
*/
const WEEK_A: Row[] = [
	[0, 1, 1, 0, 'Measuring speed'],
	[0, 2, 2, 3, 'Series and parallel circuits'],
	[0, 3, 3, 7, 'Past paper walkthrough — P1 Q4–Q7'],
	[0, 5, 6, 6, 'Required practical: specific heat capacity'],

	[1, 1, 1, 7, 'Required practical recall'],
	[1, 2, 2, 4, null],
	[1, 3, 3, 2, 'Energy stores and transfers'],
	[1, 4, 4, 1, 'Phases of the Moon'],
	[1, 6, 6, 5, 'Half-life'],

	[2, 1, 1, 0, 'Distance–time graphs'],
	[2, 2, 2, 5, null],
	[2, 3, 5, 3, 'Resistance'],
	[2, 6, 6, 4, 'Reflection', 'Year 9 trip to the Science Museum'],

	[3, 1, 1, 6, 'Internal energy'],
	[3, 2, 2, 2, 'Wasted energy'],
	[3, 4, 4, 1, 'Seasons'],
	[3, 5, 5, 7, 'Equation drill'],

	[4, 1, 1, 2, 'Power and efficiency'],
	[4, 2, 2, 4, 'Refraction'],
	[4, 3, 3, 5, null],
	[4, 4, 4, 0, 'Forces as arrows', 'Cover — 8C maths'],
	[4, 6, 6, 6, null]
];

/*
	Week B. The Teaching Week is a fortnight, so half of it is a *different* timetable — same eight
	Classes, different Slots. Written to disagree with Week A everywhere it can: the doubles fall on
	different days, Friday is nearly empty where Week A's was full, and there is no Blocked Day at
	all, because a fortnight where both weeks look alike would flatter any layout that only ever
	shows one of them.
*/
const WEEK_B: Row[] = [
	[0, 1, 2, 3, 'Required practical: resistance of a wire'],
	[0, 3, 3, 1, 'Day and night'],
	[0, 4, 4, 6, null],
	[0, 6, 6, 0, 'Acceleration'],

	[1, 1, 1, 5, 'Nuclear equations'],
	[1, 2, 2, 0, 'Newton\u2019s first law'],
	[1, 4, 6, 7, 'Mock paper 1 \u2014 full sitting'],

	[2, 2, 2, 2, 'Sankey diagrams'],
	[2, 3, 3, 4, 'Total internal reflection', 'Whole-school photograph'],
	[2, 5, 5, 6, 'Specific latent heat'],
	[2, 6, 6, 3, 'Potential dividers'],

	[3, 1, 1, 4, null],
	[3, 2, 3, 2, 'Required practical: thermal insulation'],
	[3, 4, 4, 5, 'Contamination and irradiation'],
	[3, 5, 5, 1, 'The Solar System'],
	[3, 6, 6, 7, 'Exam technique \u2014 six markers'],

	[4, 2, 2, 0, 'Stopping distances'],
	[4, 5, 5, 3, 'Mains electricity']
];

/** Thursday. A Blocked Day blocks every Slot on it, so its cells drain rather than vanish. */
export const BLOCKED_DAY_INDEX = 3;
export const BLOCKED_DAY_LABEL = 'INSET day';

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

export function weekCells(letter: 'A' | 'B' = 'A'): Cell[] {
	return (letter === 'A' ? WEEK_A : WEEK_B).map(
		([dayIndex, periodFrom, periodTo, classIndex, title, note]) => {
			const cls = CLASSES[classIndex];
			const dayBlocked = letter === 'A' && dayIndex === BLOCKED_DAY_INDEX;
			const kind: CellKind = dayBlocked || note ? 'blocked' : title ? 'lesson' : 'unplanned';
			return {
				classId: cls.id,
				classLabel: cls.label,
				tone: cls.tone,
				dayIndex,
				periodFrom,
				periodTo,
				room: cls.room,
				kind,
				lesson: title ? { title, topicName: cls.topic } : undefined,
				blockedNote: dayBlocked ? undefined : note,
				fromBlockedDay: dayBlocked
			};
		}
	);
}

export type GridEntry = { type: 'start'; cell: Cell } | { type: 'covered' } | { type: 'free' };

/**
 * One entry per (day, period): the cell that starts there, a Period covered by an earlier cell's
 * rowspan (a Lesson with a Planned Length above one), or genuinely free. Lifted unchanged from
 * `src/routes/calendar/+page.svelte` — the derivation is not what this ticket is asking about.
 */
export function toGrid(cells: Cell[]): GridEntry[][] {
	const matrix: GridEntry[][] = DAY_NAMES.map(() =>
		PERIODS.map((): GridEntry => ({ type: 'free' }))
	);
	for (const cell of cells) {
		matrix[cell.dayIndex][cell.periodFrom - 1] = { type: 'start', cell };
		for (let p = cell.periodFrom + 1; p <= cell.periodTo; p++)
			matrix[cell.dayIndex][p - 1] = { type: 'covered' };
	}
	return matrix;
}

/** A ribbon of Teaching Weeks around the current one, alternating A / B as the cycle does. */
export function ribbon(monday: string) {
	return [-2, -1, 0, 1, 2].map((offset) => ({
		weekCommencing: addDays(monday, offset * 7),
		letter: (offset % 2 === 0 ? 'A' : 'B') as 'A' | 'B',
		offset
	}));
}

export const fmtDay = (iso: string) =>
	new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});

export interface Week {
	letter: 'A' | 'B';
	monday: string;
	cells: Cell[];
}

/**
 * The fortnight, or just the week the user is standing in. `?weeks=` on the prototype flips
 * between them, because whether both halves of the Teaching Week belong on screen at once is one
 * of the things the layouts disagree about.
 */
export function fortnight(monday: string, mode: 'one' | 'both'): Week[] {
	const a: Week = { letter: 'A', monday, cells: weekCells('A') };
	if (mode === 'one') return [a];
	return [a, { letter: 'B', monday: addDays(monday, 7), cells: weekCells('B') }];
}
