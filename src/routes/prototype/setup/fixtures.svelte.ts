// PROTOTYPE — throwaway. Answers issue #23: what do the Class, timetable and
// Assign Topic screens look like? In-memory only, no database, no persistence.
// Delete this whole directory when #23 closes.
//
// Lifted wholesale from the #22 authoring prototype's fixtures — same Courses,
// Topics, Lessons and Classes, so the two mocks agree — then extended below the
// "the timetable" heading with Slots, which #22 had no need of.
//
// The state here is *mutable* on purpose: the load-bearing question is whether
// entering a fortnight's Slots in one sitting is miserable, and that cannot be
// judged against a read-only mock. Everything lives in Svelte $state below;
// reloading the page throws the lot away.
//
// "Today" is Tue 24 Nov 2026 — the same instant as the #6 prototype, so the two
// mocks can be flipped between without the dates disagreeing.

/* eslint-disable svelte/prefer-svelte-reactivity -- every Date here is local to a
   pure date function and never read reactively; SvelteDate would be noise. */

export const TODAY = '2026-11-24';

// ------------------------------------------------------------------ the model
//
// Course → Topics (unordered container) → Lessons (ordered).
// Class → one Course (fixed) → Assigned Topics (ordered, accumulated JIT).
// ADR-0009, ADR-0010.

export type Link = { id: string; url: string; label: string };

export type Lesson = {
	id: string;
	title: string;
	/** markdown; objectives and notes both live here */
	body: string;
	links: Link[];
	/** Planned Length in Periods, default 1 */
	length: number;
};

export type Topic = {
	id: string;
	courseId: string;
	/** a Topic carries a name and nothing else — position within a Course was struck by ADR-0010 */
	name: string;
	lessons: Lesson[];
};

export type Course = { id: string; name: string };

export type Klass = {
	id: string;
	label: string;
	courseId: string;
	tone: string;
	/** Assigned Topics, in this Class's teaching order — topic ids */
	assigned: string[];
	/** how many Lessons of the assigned sequence are already taught, as of TODAY */
	taught: number;
	/** dates the remaining Lessons currently land on, in order (fixture, not derived) */
	upcoming: string[];
};

let seq = 0;
const uid = (p: string) => `${p}${++seq}`;

const lesson = (title: string, extra: Partial<Lesson> = {}): Lesson => ({
	id: uid('l'),
	title,
	body: '',
	links: [],
	length: 1,
	...extra
});

const topic = (courseId: string, name: string, titles: string[]): Topic => ({
	id: uid('t'),
	courseId,
	name,
	lessons: titles.map((t) => lesson(t))
});

// ----------------------------------------------------------------- the content

/** $state so a Course added in a variant appears in the list without a reload */
export const COURSES: Course[] = $state([
	{ id: 'c8', name: 'Year 8 Science' },
	{ id: 'c9', name: 'Year 9 Physics' },
	{ id: 'c10', name: 'GCSE Physics Y10' },
	{ id: 'c11', name: 'GCSE Physics Y11' },
	{ id: 'c12', name: 'A-level Physics Y12' },
	{ id: 'c13', name: 'A-level Physics Y13' }
]);

export const courseById = (id: string) => COURSES.find((c) => c.id === id)!;

export function addCourse(name: string): Course {
	const c: Course = { id: uid('c'), name };
	COURSES.push(c);
	return c;
}

const TOPICS: Topic[] = [
	topic('c8', 'Health and Lifestyle', [
		'Nutrients and a balanced diet',
		'Testing foods for starch and sugar',
		'Digestion and enzymes',
		'Drugs, alcohol and the body',
		'Smoking and the lungs',
		'Breathing and gas exchange',
		'Health and lifestyle review',
		'Health and lifestyle assessment'
	]),
	topic('c8', 'The Periodic Table', [
		'Metals and non-metals',
		'Groups and periods',
		'Group 1: the alkali metals',
		'Reactions of the alkali metals',
		'Group 7: the halogens',
		'Displacement reactions',
		'Group 0: the noble gases',
		'Periodic table assessment'
	]),
	topic('c8', 'Electricity and Magnetism', [
		'Static electricity',
		'Building simple circuits',
		'Current and its measurement',
		'Potential difference',
		'Series and parallel',
		'Magnets and magnetic fields',
		'Electromagnets',
		'Electricity and magnetism assessment'
	]),
	topic('c9', 'Forces', [
		'What forces do',
		'Contact and non-contact forces',
		'Measuring forces with a newtonmeter',
		'Mass and weight',
		'Force diagrams',
		'Resultant forces',
		'Balanced and unbalanced',
		'Friction and drag',
		'Forces review',
		'Forces assessment'
	]),
	topic('c9', 'Energy', [
		'Energy stores',
		'Energy transfers',
		'Conservation of energy',
		'Sankey diagrams',
		'Energy in the home',
		'Energy resources',
		'Energy assessment'
	]),
	topic('c9', 'Sound and Light', []),
	topic('c9', 'Space', []),
	topic('c10', 'Particle Model', [
		'Density of solids and liquids',
		'Required practical: density',
		'Changes of state',
		'Internal energy',
		'Specific heat capacity',
		'Required practical: specific heat capacity',
		'Specific latent heat',
		'Particle motion in gases',
		'Particle model assessment'
	]),
	topic('c10', 'Atomic Structure', [
		'The history of the atom',
		'Isotopes',
		'Types of radiation',
		'Nuclear equations',
		'Half-life',
		'Radiation in medicine',
		'Atomic structure assessment'
	]),
	topic('c10', 'Electricity', []),
	topic('c11', 'Forces and Motion', [
		'Scalars and vectors',
		'Speed and velocity',
		'Distance–time graphs',
		'Acceleration',
		'Velocity–time graphs',
		"Newton's first law",
		"Newton's second law",
		'Required practical: acceleration',
		"Newton's third law",
		'Stopping distances',
		'Momentum',
		'Forces and motion assessment'
	]),
	topic('c11', 'Waves', [
		'Transverse and longitudinal',
		'The wave equation',
		'Required practical: waves in a ripple tank',
		'Reflection and refraction',
		'The electromagnetic spectrum',
		'Uses and dangers of EM waves',
		'Waves assessment'
	]),
	topic('c11', 'Revision: Paper 1', []),
	topic('c12', 'Mechanics', [
		'Scalars, vectors and resolving',
		'Moments and couples',
		'Centre of mass',
		'Equations of motion',
		'Projectile motion',
		'Free-body diagrams',
		'Work, energy and power',
		'Mechanics assessment'
	]),
	topic('c12', 'Materials', [
		"Hooke's law",
		'Required practical: Young modulus',
		'Stress, strain and the Young modulus',
		'Stress–strain graphs',
		'Materials assessment'
	]),
	topic('c12', 'Electricity', []),
	topic('c13', 'Further Mechanics', [
		'Circular motion',
		'Centripetal force',
		'Simple harmonic motion',
		'SHM graphs and equations',
		'Required practical: simple pendulum',
		'Resonance and damping',
		'Further mechanics assessment'
	]),
	topic('c13', 'Fields', ['Gravitational fields', "Kepler's laws", 'Electric fields']),
	topic('c13', 'Nuclear Physics', [])
];

// A few Lessons carry real detail, so the Lesson editor has something to show.
{
	const find = (name: string, title: string) =>
		TOPICS.find((t) => t.name === name)!.lessons.find((l) => l.title === title)!;

	const l1 = find('Forces', 'Mass and weight');
	l1.body = [
		'**Objectives**',
		'',
		'- Distinguish mass (kg, a property) from weight (N, a force)',
		'- Use W = mg with g = 10 N/kg',
		'- Explain why weight differs on the Moon',
		'',
		'Starter: the bathroom-scales-in-a-lift question. Most of them will say the',
		'mass changes — let that argument run for a few minutes before settling it.',
		'',
		'Newtonmeters are in the trolley, top drawer. The 0–10 N ones are knackered.'
	].join('\n');
	l1.links = [
		{
			id: uid('k'),
			url: 'https://greensroad-my.sharepoint.com/:p:/g/personal/x/AbC123',
			label: 'Slides — mass vs weight'
		},
		{
			id: uid('k'),
			url: 'https://greensroad-my.sharepoint.com/:w:/g/personal/x/DeF456',
			label: 'W = mg worksheet'
		}
	];

	const l2 = find('Forces', 'Forces assessment');
	l2.length = 2;
	l2.body = 'Past paper, 45 minutes, then go through it. Needs both periods.';

	const l3 = find('Forces and Motion', 'Required practical: acceleration');
	l3.length = 2;
	l3.body = 'Light gates and ramps — set up before P1, it eats fifteen minutes otherwise.';
	l3.links = [
		{
			id: uid('k'),
			url: 'https://greensroad-my.sharepoint.com/:x:/g/personal/x/GhI789',
			label: 'Results spreadsheet'
		}
	];
}

// ------------------------------------------------------------------- Classes

/** $state so a Class created in a variant shows up everywhere without a reload */
export const CLASSES: Klass[] = $state([
	{
		id: '8D',
		label: '8D/Sc3',
		courseId: 'c8',
		tone: 'stone',
		assigned: [],
		taught: 14,
		upcoming: []
	},
	{
		id: '9B',
		label: '9B/Sc1',
		courseId: 'c9',
		tone: 'emerald',
		assigned: [],
		taught: 13,
		upcoming: []
	},
	{
		id: '10A',
		label: '10A/Sc2',
		courseId: 'c10',
		tone: 'sky',
		assigned: [],
		taught: 11,
		upcoming: []
	},
	{
		id: '11C',
		label: '11C/Sc1',
		courseId: 'c11',
		tone: 'violet',
		assigned: [],
		taught: 16,
		upcoming: []
	},
	{
		id: '12A',
		label: '12A/Ph1',
		courseId: 'c12',
		tone: 'amber',
		assigned: [],
		taught: 10,
		upcoming: []
	},
	{
		id: '13A',
		label: '13A/Ph1',
		courseId: 'c13',
		tone: 'rose',
		assigned: [],
		taught: 8,
		upcoming: []
	}
]);

// Wire up Assigned Topics by name, now the ids exist.
{
	const t = (courseId: string, name: string) =>
		TOPICS.find((x) => x.courseId === courseId && x.name === name)!.id;
	CLASSES[0].assigned = [t('c8', 'Health and Lifestyle'), t('c8', 'The Periodic Table')];
	CLASSES[1].assigned = [t('c9', 'Forces'), t('c9', 'Energy')];
	CLASSES[2].assigned = [t('c10', 'Particle Model'), t('c10', 'Atomic Structure')];
	CLASSES[3].assigned = [t('c11', 'Forces and Motion'), t('c11', 'Waves')];
	CLASSES[4].assigned = [t('c12', 'Mechanics'), t('c12', 'Materials')];
	CLASSES[5].assigned = [t('c13', 'Further Mechanics'), t('c13', 'Fields')];
}

export const classById = (id: string) => CLASSES.find((c) => c.id === id)!;

// ----------------------------------------------------------- the mutable store
//
// One shared $state tree so every variant edits the same content — flipping
// between variants mid-sentence keeps whatever was typed, which is exactly the
// comparison worth making.

export const store = $state({ topics: TOPICS });

export const topicsOf = (courseId: string) => store.topics.filter((t) => t.courseId === courseId);
export const topicById = (id: string) => store.topics.find((t) => t.id === id)!;

export function addTopic(courseId: string, name: string): Topic {
	const t: Topic = { id: uid('t'), courseId, name, lessons: [] };
	store.topics.push(t);
	return t;
}

export function addLesson(topicId: string, title: string, at?: number): Lesson {
	const t = topicById(topicId);
	const l = lesson(title);
	if (at === undefined) t.lessons.push(l);
	else t.lessons.splice(at, 0, l);
	return l;
}

export function removeLesson(topicId: string, lessonId: string) {
	const t = topicById(topicId);
	t.lessons = t.lessons.filter((l) => l.id !== lessonId);
}

export function moveLesson(topicId: string, from: number, to: number) {
	const t = topicById(topicId);
	if (to < 0 || to >= t.lessons.length) return;
	const [l] = t.lessons.splice(from, 1);
	t.lessons.splice(to, 0, l);
}

/** Move a Lesson to the end of another Topic. */
export function reparentLesson(fromTopicId: string, lessonId: string, toTopicId: string) {
	const from = topicById(fromTopicId);
	const i = from.lessons.findIndex((l) => l.id === lessonId);
	if (i < 0) return;
	const [l] = from.lessons.splice(i, 1);
	topicById(toTopicId).lessons.push(l);
}

export function addLink(l: Lesson, url: string, label: string) {
	l.links.push({ id: uid('k'), url, label });
}

// ------------------------------------------------ "editing content moves dates"
//
// ADR-0007 + ADR-0010: the schedule is derived, so adding a Lesson to a
// half-taught Topic shifts the rest of that Class's year right. The real engine
// lays Lessons onto Available Slots; here a crude stand-in walks weekdays,
// skipping weekends, at the Class's rough slots-per-week. Good enough to make
// the *consequence* visible, which is what the mock is for.

const SLOTS_PER_WEEK: Record<string, number> = {
	'8D': 3,
	'9B': 4,
	'10A': 5,
	'11C': 5,
	'12A': 6,
	'13A': 5
};

function addDays(iso: string, n: number): string {
	const d = new Date(iso + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string): string {
	return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
}

/** Which Classes teach this Topic, and where each is up to in it. */
export function classesTeaching(topicId: string) {
	return CLASSES.filter((c) => c.assigned.includes(topicId)).map((c) => {
		const before = c.assigned
			.slice(0, c.assigned.indexOf(topicId))
			.reduce((n, id) => n + topicById(id).lessons.length, 0);
		const here = topicById(topicId).lessons.length;
		const doneHere = Math.min(here, Math.max(0, c.taught - before));
		return {
			cls: c,
			doneHere,
			here,
			started: c.taught > before,
			finished: c.taught >= before + here
		};
	});
}

/** The date the Class's last currently-planned Lesson lands on. */
export function lastPlannedDate(classId: string): string {
	const c = classById(classId);
	const total = c.assigned.reduce((n, id) => n + topicById(id).lessons.length, 0);
	const remaining = Math.max(0, total - c.taught);
	const perWeek = SLOTS_PER_WEEK[classId] ?? 4;
	let date = TODAY;
	let placed = 0;
	// walk forward, `perWeek` teaching days a week, skipping weekends
	let i = 0;
	while (placed < remaining && i < 2000) {
		i++;
		date = addDays(date, 1);
		const wd = new Date(date + 'T00:00:00Z').getUTCDay();
		if (wd === 0 || wd === 6) continue;
		if (perWeek >= 5 || (i * perWeek) % 5 < perWeek) placed++;
	}
	return date;
}

// ================================================================ the timetable
//
// Everything below this line is new for #23; everything above came from #22.
//
// A Slot is (Week, Day, Period) → Class, holding over an optional date range
// (ADR-0006). The teacher can only be in one room at a time, so a position
// carries at most one Class *on any given date* — which is why replacing a Slot
// mid-year has to end one and start another rather than colliding with it.

export const YEAR_START = '2026-09-03';

export const WEEKS = ['A', 'B'] as const;
export type Week = (typeof WEEKS)[number];

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
export const PERIODS = [1, 2, 3, 4, 5, 6] as const;

export type Slot = {
	id: string;
	classId: string;
	week: Week;
	/** 0 = Mon … 4 = Fri */
	day: number;
	/** 1 … 6 */
	period: number;
	/** the Slot holds from this date (inclusive) */
	from: string;
	/** …until this one (inclusive), or forever */
	to: string | null;
};

/**
 * The fortnight, as it stands: 44 of the 60 positions taught, which is about
 * what a real timetable looks like. Rows are P1…P6.
 */
const GRID: Record<Week, (string | null)[][]> = {
	A: [
		['9B', '9B', '10A', null, '11C', '12A'], // Mon
		['8D', '12A', '12A', '11C', '10A', null], // Tue
		['13A', '13A', '8D', '9B', null, '11C'], // Wed
		['10A', '11C', null, '12A', '13A', '9B'], // Thu
		['8D', '10A', '13A', '11C', '12A', null] // Fri
	],
	B: [
		['10A', '9B', '11C', null, '12A', '12A'],
		['13A', '8D', '9B', '10A', '11C', null],
		['11C', '12A', '13A', null, '8D', '10A'],
		['9B', '10A', '11C', '13A', null, '12A'],
		['12A', '11C', '8D', '9B', '10A', null]
	]
};

export const SLOTS: Slot[] = $state(
	WEEKS.flatMap((week) =>
		GRID[week].flatMap((day, d) =>
			day.flatMap((classId, p) =>
				classId
					? [
							{
								id: uid('s'),
								classId,
								week,
								day: d,
								period: p + 1,
								from: YEAR_START,
								// 13A go on study leave in May: a Slot that ends, seeded so
								// every variant has one dated Slot to render on day one
								to: classId === '13A' ? '2027-05-14' : null
							}
						]
					: []
			)
		)
	)
);

export function addSlot(classId: string, week: Week, day: number, period: number, from: string) {
	SLOTS.push({ id: uid('s'), classId, week, day, period, from, to: null });
}

/** Does this Slot hold on the given date? */
export const holds = (s: Slot, on: string) => s.from <= on && (s.to === null || s.to >= on);

/** The Slot at a position on a date, if any. */
export const slotAt = (week: Week, day: number, period: number, on: string) =>
	SLOTS.find((s) => s.week === week && s.day === day && s.period === period && holds(s, on));

/** Every Slot at a position, dead ones included, oldest first. */
export const historyAt = (week: Week, day: number, period: number) =>
	SLOTS.filter((s) => s.week === week && s.day === day && s.period === period).sort((a, b) =>
		a.from < b.from ? -1 : 1
	);

export const slotsOf = (classId: string, on: string) =>
	SLOTS.filter((s) => s.classId === classId && holds(s, on));

/** Every Slot a Class has ever had, live or ended. */
export const allSlotsOf = (classId: string) => SLOTS.filter((s) => s.classId === classId);

/**
 * Put a Class in a position from a date. Whatever held there is *ended* the day
 * before rather than deleted — that is the whole of "mid-year change", and it
 * is also why a naive unique index on (week, day, period) is wrong.
 */
export function takeSlot(week: Week, day: number, period: number, classId: string, from: string) {
	const held = slotAt(week, day, period, from);
	if (held) {
		if (held.classId === classId) return;
		endSlot(held, from);
	}
	addSlot(classId, week, day, period, from);
}

/** End a Slot the day before `from`, or drop it outright if it never held. */
export function endSlot(s: Slot, from: string) {
	if (s.from >= from) SLOTS.splice(SLOTS.indexOf(s), 1);
	else s.to = addDays(from, -1);
}

export function clearSlot(week: Week, day: number, period: number, on: string) {
	const held = slotAt(week, day, period, on);
	if (held) endSlot(held, on);
}

// -------------------------------------------------------------- Classes, mutably

const TONES = ['stone', 'emerald', 'sky', 'violet', 'amber', 'rose', 'teal', 'fuchsia'];

/** Tailwind can only see class names it can read, so tones are spelled out. */
export const TONE: Record<string, { chip: string; cell: string; dot: string }> = {
	stone: {
		chip: 'bg-stone-100 text-stone-800 ring-stone-300',
		cell: 'bg-stone-100 text-stone-900 ring-stone-300',
		dot: 'bg-stone-400'
	},
	emerald: {
		chip: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
		cell: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
		dot: 'bg-emerald-500'
	},
	sky: {
		chip: 'bg-sky-100 text-sky-900 ring-sky-300',
		cell: 'bg-sky-100 text-sky-900 ring-sky-300',
		dot: 'bg-sky-500'
	},
	violet: {
		chip: 'bg-violet-100 text-violet-900 ring-violet-300',
		cell: 'bg-violet-100 text-violet-900 ring-violet-300',
		dot: 'bg-violet-500'
	},
	amber: {
		chip: 'bg-amber-100 text-amber-900 ring-amber-300',
		cell: 'bg-amber-100 text-amber-900 ring-amber-300',
		dot: 'bg-amber-500'
	},
	rose: {
		chip: 'bg-rose-100 text-rose-900 ring-rose-300',
		cell: 'bg-rose-100 text-rose-900 ring-rose-300',
		dot: 'bg-rose-500'
	},
	teal: {
		chip: 'bg-teal-100 text-teal-900 ring-teal-300',
		cell: 'bg-teal-100 text-teal-900 ring-teal-300',
		dot: 'bg-teal-500'
	},
	fuchsia: {
		chip: 'bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-300',
		cell: 'bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-300',
		dot: 'bg-fuchsia-500'
	}
};

export function addClass(label: string, courseId: string): Klass {
	const k: Klass = {
		id: uid('k'),
		label,
		courseId,
		tone: TONES[CLASSES.length % TONES.length],
		assigned: [],
		taught: 0,
		upcoming: []
	};
	CLASSES.push(k);
	return k;
}

export function removeClass(id: string) {
	const i = CLASSES.findIndex((c) => c.id === id);
	if (i >= 0) CLASSES.splice(i, 1);
	for (const s of allSlotsOf(id)) SLOTS.splice(SLOTS.indexOf(s), 1);
}

// ------------------------------------------------------------- Assigned Topics
//
// ADR-0010: one at a time, in the order reached, from the Class's Course only.
// Reorder and unassign are free, and nothing forbids assigning the same Topic
// twice.

export function assignTopic(classId: string, topicId: string) {
	classById(classId).assigned.push(topicId);
}

export function unassignTopic(classId: string, at: number) {
	classById(classId).assigned.splice(at, 1);
}

export function moveAssigned(classId: string, from: number, to: number) {
	const a = classById(classId).assigned;
	if (to < 0 || to >= a.length) return;
	const [id] = a.splice(from, 1);
	a.splice(to, 0, id);
}

/** Lessons still to teach in the Class's assigned sequence, as of TODAY. */
export function runway(classId: string) {
	const c = classById(classId);
	const total = c.assigned.reduce((n, id) => n + topicById(id).lessons.length, 0);
	return { total, left: Math.max(0, total - c.taught), taught: c.taught };
}

/** Every other Class drawing on the same Course that already has this Topic. */
export const alsoAssigned = (topicId: string, exceptClassId: string) =>
	CLASSES.filter((c) => c.id !== exceptClassId && c.assigned.includes(topicId));

export const fmtLong = (iso: string) =>
	new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
