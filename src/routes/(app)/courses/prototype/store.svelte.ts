// PROTOTYPE ONLY (issue #306): fake Courses, Topics and Lessons held in memory. Every write is
// local and lost on reload. Leaves with the prototype.
import { page } from '$app/state';

export type Lesson = {
	id: string;
	title: string;
	tags: string[];
	status: 'Draft' | 'Planned';
	length: 1 | 2;
};
export type Topic = { id: string; name: string; lessons: Lesson[] };
export type Course = { id: string; name: string; classes: string[]; topics: Topic[] };

let seq = 0;
const id = (p: string) => `${p}${++seq}`;

const TAGS = ['Practical', 'Assessment', 'Homework set', 'Revision', 'Required practical'];

function lessons(titles: string[]): Lesson[] {
	return titles.map((title, i) => ({
		id: id('l'),
		title,
		tags: i % 4 === 1 ? [TAGS[i % TAGS.length]] : i % 7 === 3 ? [TAGS[0], TAGS[4]] : [],
		status: i % 3 === 2 ? 'Draft' : 'Planned',
		length: i % 5 === 4 ? 2 : 1
	}));
}

function topic(name: string, titles: string[]): Topic {
	return { id: id('t'), name, lessons: lessons(titles) };
}

const ENERGY = [
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
	'Revision',
	'End-of-Topic assessment'
];
const ELECTRICITY = [
	'Circuit symbols',
	'Current and charge',
	'Potential difference and resistance',
	'Required practical: resistance of a wire',
	'I–V characteristics of a resistor, a filament lamp and a diode',
	'Series circuits',
	'Parallel circuits',
	'Mains electricity',
	'Power and energy transferred',
	'The National Grid',
	'Static electricity',
	'Revision',
	'Revision',
	'End-of-Topic assessment'
];
const SHORT = (n: number, stem: string) => Array.from({ length: n }, (_, i) => `${stem} ${i + 1}`);

export const store = $state<{ courses: Course[] }>({
	courses: [
		{
			id: id('c'),
			name: 'GCSE Combined Science: Physics',
			classes: ['10X', '10Y', '11P'],
			topics: [
				topic(
					'Energy: stores, transfers, efficiency and the conservation of energy in closed systems',
					ENERGY
				),
				topic('Electricity: circuits, potential difference, resistance and power', ELECTRICITY),
				topic('Particle model of matter', SHORT(7, 'Particle model')),
				topic(
					'Atomic structure, including radioactive decay, half-life and the uses and dangers of nuclear radiation',
					SHORT(10, 'Atomic structure')
				),
				topic('Forces', SHORT(16, 'Forces')),
				topic('Waves', SHORT(9, 'Waves')),
				topic('Magnetism and electromagnetism', SHORT(8, 'Magnetism'))
			]
		},
		{
			id: id('c'),
			name: 'Year 9 Science',
			classes: ['9A', '9C'],
			topics: [
				topic('Cells and organisation', SHORT(8, 'Cells')),
				topic('Chemical reactions and the reactivity series', SHORT(10, 'Reactions')),
				topic('Forces and motion', SHORT(9, 'Motion')),
				topic('Space', SHORT(5, 'Space'))
			]
		},
		{
			id: id('c'),
			name: 'A-level Physics',
			classes: ['12P', '13P'],
			topics: [
				topic('Measurements and their errors', SHORT(6, 'Measurements')),
				topic('Particles and radiation', SHORT(12, 'Particles')),
				topic(
					'Further mechanics and thermal physics: circular motion, simple harmonic motion and ideal gases',
					SHORT(18, 'Further mechanics')
				)
			]
		},
		{ id: id('c'), name: 'Year 7 Science', classes: [], topics: [] }
	]
});

// ── Lookups from the URL ───────────────────────────────────────────────────

export const current = {
	get course() {
		const c = page.url.searchParams.get('course');
		return store.courses.find((x) => x.id === c) ?? null;
	},
	get topic() {
		const t = page.url.searchParams.get('topic');
		return this.course?.topics.find((x) => x.id === t) ?? null;
	},
	get lesson() {
		const l = page.url.searchParams.get('lesson');
		return this.topic?.lessons.find((x) => x.id === l) ?? null;
	}
};

/** An address on this route that keeps the variant: `to({ course, topic })`. */
export function to(params: { course?: string; topic?: string; lesson?: string } = {}) {
	const url = new URL(page.url);
	for (const key of ['course', 'topic', 'lesson']) url.searchParams.delete(key);
	for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
	return `${url.pathname}${url.search}`;
}

export const lessonCount = (c: Course) => c.topics.reduce((n, t) => n + t.lessons.length, 0);
export const plannedCount = (c: Course) =>
	c.topics.reduce((n, t) => n + t.lessons.filter((l) => l.status === 'Planned').length, 0);

// ── Writes (local only) ────────────────────────────────────────────────────
export function addCourse(name: string) {
	store.courses.push({ id: id('c'), name, classes: [], topics: [] });
	return store.courses[store.courses.length - 1];
}
export function addTopic(course: Course, name: string) {
	course.topics.push({ id: id('t'), name, lessons: [] });
	return course.topics[course.topics.length - 1];
}
export function addLesson(topic: Topic, title: string) {
	topic.lessons.push({ id: id('l'), title, tags: [], status: 'Draft', length: 1 });
}
export function move<T>(list: T[], index: number, delta: -1 | 1) {
	const j = index + delta;
	if (j < 0 || j >= list.length) return;
	[list[index], list[j]] = [list[j], list[index]];
}
export function removeAt<T extends { id: string }>(list: T[], itemId: string) {
	const i = list.findIndex((x) => x.id === itemId);
	if (i >= 0) list.splice(i, 1);
}
