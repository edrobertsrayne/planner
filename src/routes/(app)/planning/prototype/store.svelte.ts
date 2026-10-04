// PROTOTYPE ONLY (issue #307): a fake Planning stream held in memory. Draft/Planned writes are
// local and lost on reload. Leaves with the prototype.
import { page } from '$app/state';
import { addDays, today, weekday } from '$lib/date';

export type Status = 'draft' | 'planned';
export type Occurrence = {
	classId: string;
	label: string;
	tone: number;
	date: string;
	period: number;
};
export type Lesson = {
	id: string;
	title: string;
	topicName: string | null;
	courseName: string | null;
	status: Status;
	tags: string[];
	// The soonest Scheduled occurrence for each Class that teaches the Lesson from today on.
	byClass: Record<string, Occurrence>;
};
export type Entry = Lesson & { occurrence: Occurrence | null };
export type Klass = { id: string; label: string; tone: number; course: string };

export const CLASSES: Klass[] = [
	{ id: 'c10x', label: '10X', tone: 0, course: 'GCSE Physics' },
	{ id: 'c10y', label: '10Y', tone: 4, course: 'GCSE Physics' },
	{ id: 'c11p', label: '11P', tone: 6, course: 'GCSE Physics' },
	{ id: 'c9a', label: '9A', tone: 7, course: 'KS3 Science' },
	{ id: 'c9c', label: '9C', tone: 1, course: 'KS3 Science' },
	{ id: 'c12p', label: '12P', tone: 2, course: 'A-level Physics' },
	{ id: 'c13p', label: '13P', tone: 5, course: 'A-level Physics' }
];

const TOPICS: Record<string, { name: string; titles: string[] }[]> = {
	'GCSE Physics': [
		{
			name: 'Energy',
			titles: [
				'Energy stores',
				'Energy transfers and systems',
				'Kinetic energy',
				'Gravitational potential energy',
				'Elastic potential energy and Hooke’s law',
				'Required practical: specific heat capacity of a metal block',
				'Power',
				'Efficiency, and why no real machine reaches 100 per cent',
				'Reducing unwanted energy transfers: insulation and lubrication',
				'National and global energy resources',
				'End-of-Topic assessment'
			]
		},
		{
			name: 'Electricity: circuits, mains supply and the National Grid',
			titles: [
				'Circuit symbols',
				'Current and charge',
				'Potential difference and resistance',
				'Required practical: resistance of a wire',
				'I–V characteristics of a resistor, a filament lamp and a diode',
				'Series circuits',
				'Parallel circuits',
				'Mains electricity',
				'Power and energy transfers in everyday appliances',
				'The National Grid'
			]
		}
	],
	'KS3 Science': [
		{
			name: 'Forces and motion',
			titles: [
				'What is a force?',
				'Balanced and unbalanced forces',
				'Speed',
				'Distance–time graphs',
				'Friction and drag',
				'Pressure in liquids and gases',
				'Moments',
				'Assessment'
			]
		},
		{
			name: 'Cells',
			titles: [
				'Using a microscope',
				'Animal and plant cells',
				'Specialised cells',
				'Diffusion',
				'Unicellular organisms'
			]
		}
	],
	'A-level Physics': [
		{
			name: 'Particles and radiation',
			titles: [
				'Constituents of the atom',
				'Stable and unstable nuclei',
				'Particles, antiparticles and photons',
				'Particle interactions and exchange particles',
				'Classification of particles: hadrons, leptons and the quark model',
				'Conservation laws in particle interactions',
				'Required practical: determination of g by a free-fall method'
			]
		},
		{
			name: 'Waves',
			titles: [
				'Progressive waves',
				'Longitudinal and transverse waves',
				'Superposition and stationary waves',
				'Interference and Young’s double-slit experiment',
				'Diffraction gratings',
				'Refraction at a plane surface and total internal reflection'
			]
		}
	]
};

const TAGS = ['Practical', 'Assessment', 'Homework set', 'Revision', 'Required practical'];

// Each Class's teaching pattern: (weekday 1–5, Period) pairs, and where in its Course it stands.
const PATTERN: Record<string, { slots: [number, number][]; start: number }> = {
	c10x: {
		slots: [
			[1, 2],
			[3, 4],
			[5, 1]
		],
		start: 2
	},
	c10y: {
		slots: [
			[2, 3],
			[4, 1],
			[5, 5]
		],
		start: 0
	},
	c11p: {
		slots: [
			[1, 5],
			[2, 1],
			[4, 4]
		],
		start: 12
	},
	c9a: {
		slots: [
			[1, 1],
			[4, 2]
		],
		start: 1
	},
	c9c: {
		slots: [
			[3, 2],
			[5, 3]
		],
		start: 0
	},
	c12p: {
		slots: [
			[1, 3],
			[2, 4],
			[3, 1],
			[5, 2]
		],
		start: 0
	},
	c13p: {
		slots: [
			[2, 2],
			[3, 5],
			[4, 3]
		],
		start: 6
	}
};

let seq = 0;
const lessons: Lesson[] = [];
const byCourse: Record<string, Lesson[]> = {};

for (const [course, topics] of Object.entries(TOPICS)) {
	byCourse[course] = [];
	for (const t of topics) {
		t.titles.forEach((title) => {
			const n = ++seq;
			const l: Lesson = {
				id: `l${n}`,
				title,
				topicName: t.name,
				courseName: course,
				status: n % 3 === 0 || n % 7 === 0 ? 'draft' : 'planned',
				tags: /practical/i.test(title)
					? ['Required practical']
					: /assessment/i.test(title)
						? ['Assessment']
						: n % 5 === 1
							? [TAGS[n % 3 === 0 ? 3 : 2]]
							: [],
				byClass: {}
			};
			lessons.push(l);
			byCourse[course].push(l);
		});
	}
}

// Walk each Class's Slots from today, six weeks out, handing it the next Lesson of its Course.
const start = today();
for (const c of CLASSES) {
	const p = PATTERN[c.id];
	const queue = byCourse[c.course].slice(p.start);
	let q = 0;
	for (let d = 0; d < 42 && q < queue.length; d++) {
		const date = addDays(start, d);
		const wd = weekday(date);
		for (const [day, period] of p.slots) {
			if (day !== wd || q >= queue.length) continue;
			const lesson = queue[q++];
			lesson.byClass[c.id] ??= { classId: c.id, label: c.label, tone: c.tone, date, period };
		}
	}
}

// Two Standalone Lessons, each placed on one Class.
const standalone = (title: string, classId: string, dayOffset: number, period: number): Lesson => {
	const c = CLASSES.find((k) => k.id === classId)!;
	return {
		id: `s${++seq}`,
		title,
		topicName: null,
		courseName: null,
		status: 'draft',
		tags: [],
		byClass: {
			[classId]: { classId, label: c.label, tone: c.tone, date: addDays(start, dayOffset), period }
		}
	};
};
lessons.push(standalone('Careers talk: working in engineering', 'c10y', 3, 3));
lessons.push(standalone('Cover: mock exam walkthrough', 'c13p', 9, 2));
// An unplaced Standalone Lesson: a line of text, with no occurrence.
lessons.push({ ...standalone('Science week quiz', 'c9a', 0, 1), byClass: {} });

export const store = $state({ lessons });

export function setStatus(id: string, status: Status) {
	const l = store.lessons.find((x) => x.id === id);
	if (l) l.status = status;
}

function soonest(l: Lesson, classId: string | null): Occurrence | null {
	const occ = Object.values(l.byClass).filter((o) => !classId || o.classId === classId);
	occ.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
	return occ[0] ?? null;
}

// The same order as `planningStream`: soonest occurrence, then Course, Topic, position; Lessons
// with no occurrence last. A Class filter drops Lessons that Class does not teach from today on.
export function stream(classId: string | null): Entry[] {
	const rows = store.lessons
		.map((l) => ({ ...l, occurrence: soonest(l, classId) }))
		.filter((e) => !classId || e.occurrence);
	return rows.sort((a, b) => {
		if (a.occurrence && b.occurrence)
			return (
				a.occurrence.date.localeCompare(b.occurrence.date) ||
				a.occurrence.period - b.occurrence.period
			);
		if (a.occurrence) return -1;
		if (b.occurrence) return 1;
		return 0;
	});
}

// The page's state lives in the URL: `class`, `lesson`, `variant`.
export const classParam = () => page.url.searchParams.get('class');
export const lessonParam = () => page.url.searchParams.get('lesson');

export function to(params: { class?: string | null; lesson?: string | null }) {
	const url = new URL(page.url);
	for (const [k, v] of Object.entries(params)) {
		if (v) url.searchParams.set(k, v);
		else url.searchParams.delete(k);
	}
	return `${url.pathname}${url.search}`;
}

// Days from today to an occurrence, for "in 3 days" style hints.
export function daysUntil(date: string) {
	return Math.round((Date.parse(date) - Date.parse(start)) / 86_400_000);
}

export const TODAY = start;
