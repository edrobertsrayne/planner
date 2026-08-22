// PROTOTYPE — throwaway. A hand-written set of Classes, a fortnight of Slots and a Course's
// Topics, so the prototype renders on a machine with an empty database and no login. Nothing here
// touches `$lib/server/db`.
//
// Shapes mirror the real loaders in src/routes/classes/**/+page.server.ts closely enough to judge
// density, but are not imported from them — the prototype must not drag server code into scope.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const PERIODS = [1, 2, 3, 4, 5, 6];
export const WEEKS = ['A', 'B'] as const;
export type Week = (typeof WEEKS)[number];

export interface Lane {
	classId: string;
	classLabel: string;
	courseId: string;
	courseName: string;
	/** Provisional Class tone index — the real tokens are still open on #67. */
	tone: number;
	taught: number;
	total: number;
	lastTaught: { title: string; note: string | null; date: string; period: number } | null;
	/** The Assigned Topic being taught right now — the one the next Lesson sits inside. */
	currentTopic: string | null;
	nextUp: { title: string } | null;
	runway: { date: string | null; lessonsRemaining: number };
}

export const LANES: Lane[] = [
	{
		classId: 'cls-7x',
		currentTopic: 'Forces and motion',
		classLabel: '7X/Sc1',
		courseId: 'crs-ks3',
		courseName: 'KS3 Science',
		tone: 0,
		taught: 31,
		total: 58,
		lastTaught: {
			title: 'Measuring speed',
			note: 'Ran out of time on the plenary. Two trolleys have stiff wheels.',
			date: '2026-09-14',
			period: 1
		},
		nextUp: { title: 'Distance–time graphs' },
		runway: { date: '2027-03-19', lessonsRemaining: 0 }
	},
	{
		classId: 'cls-8y',
		currentTopic: 'Energy',
		classLabel: '8Y/Sc2',
		courseId: 'crs-ks3',
		courseName: 'KS3 Science',
		tone: 1,
		taught: 22,
		total: 40,
		lastTaught: { title: 'Energy stores and transfers', note: null, date: '2026-09-15', period: 2 },
		nextUp: { title: 'Sankey diagrams' },
		runway: { date: '2027-01-22', lessonsRemaining: 9 }
	},
	{
		classId: 'cls-9a',
		currentTopic: 'Electricity',
		classLabel: '9A/Ph1',
		courseId: 'crs-ks4',
		courseName: 'AQA GCSE Physics',
		tone: 2,
		taught: 18,
		total: 44,
		lastTaught: {
			title: 'Series and parallel circuits',
			note: 'Ammeter readings confused half of them. Redo the practical Thursday.',
			date: '2026-09-16',
			period: 1
		},
		nextUp: { title: 'Resistance and I–V characteristics' },
		runway: { date: '2027-05-07', lessonsRemaining: 0 }
	},
	{
		classId: 'cls-10b',
		currentTopic: 'Particle model of matter',
		classLabel: '10B/Ph',
		courseId: 'crs-ks4',
		courseName: 'AQA GCSE Physics',
		tone: 3,
		taught: 27,
		total: 44,
		lastTaught: {
			title: 'Required practical: specific heat capacity',
			note: null,
			date: '2026-09-14',
			period: 3
		},
		nextUp: { title: 'Latent heat' },
		runway: { date: null, lessonsRemaining: 0 }
	},
	{
		classId: 'cls-11c',
		currentTopic: 'Revision',
		classLabel: '11C/Ph',
		courseId: 'crs-ks4',
		courseName: 'AQA GCSE Physics',
		tone: 4,
		taught: 39,
		total: 41,
		lastTaught: {
			title: 'Past paper walkthrough — Paper 1 Q4–Q7',
			note: 'They are finally writing units. Q6 still catching them out.',
			date: '2026-09-17',
			period: 6
		},
		nextUp: { title: 'Paper 2 walkthrough' },
		runway: { date: '2026-10-09', lessonsRemaining: 14 }
	},
	{
		classId: 'cls-12d',
		currentTopic: 'Mechanics',
		classLabel: '12D/Ph',
		courseId: 'crs-a',
		courseName: 'A-level Physics (Year 12)',
		tone: 5,
		taught: 12,
		total: 61,
		lastTaught: { title: 'Projectile motion', note: null, date: '2026-09-15', period: 4 },
		nextUp: { title: 'Newton’s second law' },
		runway: { date: '2027-06-11', lessonsRemaining: 0 }
	}
];

/** Provisional tone swatches — light/dark background and ring, pending #67. */
export const TONES = [
	{ bg: 'oklch(0.93 0.05 145)', fg: 'oklch(0.35 0.09 145)', ring: 'oklch(0.72 0.11 145)' },
	{ bg: 'oklch(0.93 0.05 250)', fg: 'oklch(0.35 0.09 250)', ring: 'oklch(0.72 0.11 250)' },
	{ bg: 'oklch(0.93 0.05 25)', fg: 'oklch(0.35 0.09 25)', ring: 'oklch(0.72 0.11 25)' },
	{ bg: 'oklch(0.93 0.05 85)', fg: 'oklch(0.35 0.09 85)', ring: 'oklch(0.72 0.11 85)' },
	{ bg: 'oklch(0.93 0.05 310)', fg: 'oklch(0.35 0.09 310)', ring: 'oklch(0.72 0.11 310)' },
	{ bg: 'oklch(0.93 0.05 195)', fg: 'oklch(0.35 0.09 195)', ring: 'oklch(0.72 0.11 195)' },
	{ bg: 'oklch(0.93 0.05 15)', fg: 'oklch(0.35 0.09 15)', ring: 'oklch(0.72 0.11 15)' },
	{ bg: 'oklch(0.93 0.05 275)', fg: 'oklch(0.35 0.09 275)', ring: 'oklch(0.72 0.11 275)' }
];

export const COURSES = [
	{ id: 'crs-ks3', name: 'KS3 Science' },
	{ id: 'crs-ks4', name: 'AQA GCSE Physics' },
	{ id: 'crs-a', name: 'A-level Physics (Year 12)' }
];

/** The Class the detail variants render. */
export const SUBJECT = LANES[2];

export interface GridSlot {
	week: Week;
	day: number; // 1 = Mon
	period: number;
	classId: string;
	classLabel: string;
}

// [week, day, period, classIndex into LANES]
const SLOTS: [Week, number, number, number][] = [
	// 9A/Ph1 — the subject Class. A five-a-fortnight GCSE allocation with one double.
	['A', 1, 2, 2],
	['A', 3, 1, 2],
	['A', 4, 5, 2],
	['A', 4, 6, 2],
	['B', 2, 3, 2],
	['B', 5, 2, 2],
	// Everyone else — these render as unavailable on the subject's grid.
	['A', 1, 1, 0],
	['A', 1, 5, 5],
	['A', 1, 6, 5],
	['A', 2, 2, 1],
	['A', 2, 4, 4],
	['A', 3, 2, 0],
	['A', 3, 5, 3],
	['A', 4, 3, 3],
	['A', 5, 1, 4],
	['A', 5, 4, 3],
	['B', 1, 1, 0],
	['B', 1, 3, 3],
	['B', 2, 5, 5],
	['B', 2, 6, 5],
	['B', 3, 2, 0],
	['B', 3, 4, 1],
	['B', 4, 1, 4],
	['B', 4, 6, 1],
	['B', 5, 5, 3]
];

export const GRID: GridSlot[] = SLOTS.map(([week, day, period, i]) => ({
	week,
	day,
	period,
	classId: LANES[i].classId,
	classLabel: LANES[i].classLabel
}));

export function slotAt(week: Week, day: number, period: number): GridSlot | null {
	return GRID.find((s) => s.week === week && s.day === day && s.period === period) ?? null;
}

/** Slots that hold over a range rather than the whole year — the hard case the date affordance is for. */
export const DATED_SLOTS = [
	{
		id: 'ds-1',
		week: 'B' as Week,
		day: 5,
		period: 2,
		holdsFrom: '2027-01-05',
		holdsTo: null as string | null
	},
	{ id: 'ds-2', week: 'A' as Week, day: 2, period: 6, holdsFrom: null, holdsTo: '2026-12-18' }
];

export const ASSIGNED_TOPICS = [
	{ id: 'at-1', topicName: 'Energy', lessons: 8, taught: 8 },
	{ id: 'at-2', topicName: 'Electricity', lessons: 11, taught: 6 },
	{ id: 'at-3', topicName: 'Particle model of matter', lessons: 7, taught: 0 },
	{ id: 'at-4', topicName: 'Atomic structure', lessons: 9, taught: 0 },
	{ id: 'at-5', topicName: 'Forces', lessons: 9, taught: 0 }
];

export const COURSE_TOPICS = [
	{ id: 'tp-6', name: 'Waves' },
	{ id: 'tp-7', name: 'Magnetism and electromagnetism' },
	{ id: 'tp-8', name: 'Space physics' }
];

export const YEAR_START = '2026-09-01';

export const fmtLong = (iso: string) =>
	new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});

export const fmtShort = (iso: string) =>
	new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
