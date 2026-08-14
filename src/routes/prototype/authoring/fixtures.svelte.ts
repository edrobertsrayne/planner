// PROTOTYPE — throwaway. Answers issue #22: what do the Course, Topic and Lesson
// authoring screens look like? In-memory only, no database, no persistence.
// Delete this whole directory when #22 closes.
//
// The state here is *mutable* on purpose: the load-bearing question is whether
// typing a Topic's worth of Lesson titles in one sitting feels fast, and that
// cannot be judged against a read-only mock. Everything lives in a Svelte $state
// store below; reloading the page throws the lot away.
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

export const COURSES: Course[] = [
	{ id: 'c8', name: 'Year 8 Science' },
	{ id: 'c9', name: 'Year 9 Physics' },
	{ id: 'c10', name: 'GCSE Physics Y10' },
	{ id: 'c11', name: 'GCSE Physics Y11' },
	{ id: 'c12', name: 'A-level Physics Y12' },
	{ id: 'c13', name: 'A-level Physics Y13' }
];

export const courseById = (id: string) => COURSES.find((c) => c.id === id)!;

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

export const CLASSES: Klass[] = [
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
];

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
