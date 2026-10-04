// PROTOTYPE ONLY (issue #310): a fake Agenda held in memory, built from the Planning prototype's
// Classes and Lessons. Ready ticks and Session notes are local and lost on reload. Leaves with the
// prototype.
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { addDays, today, weekday } from '$lib/date';
import { CLASSES, store as planning } from '../planning/prototype/store.svelte';
import { filterByTag, groupByDay, tagsIn } from '../agenda-days';

export type AgendaLesson = {
	id: string;
	title: string;
	topicName: string | null;
	courseName: string | null;
	tags: string[];
};
export type Row = {
	key: string;
	date: string;
	periodFrom: number;
	periodTo: number;
	classId: string;
	classLabel: string;
	tone: number;
	lesson: AgendaLesson | null;
};

// Each Class's week: (weekday 1–5, Period, Periods long) and where in its Course it stands.
const PATTERN: Record<string, { slots: [number, number, number][]; start: number }> = {
	c10x: {
		slots: [
			[1, 2, 1],
			[3, 4, 1],
			[5, 1, 1]
		],
		start: 0
	},
	c10y: {
		slots: [
			[2, 3, 1],
			[4, 1, 1],
			[5, 5, 1]
		],
		start: 0
	},
	c11p: {
		slots: [
			[1, 5, 1],
			[2, 1, 1],
			[4, 4, 1]
		],
		start: 9
	},
	c9a: {
		slots: [
			[1, 1, 1],
			[4, 2, 1]
		],
		start: 0
	},
	c9c: {
		slots: [
			[3, 2, 1],
			[5, 3, 1]
		],
		start: 0
	},
	// A double on Monday: one Continuation, two Periods.
	c12p: {
		slots: [
			[1, 3, 2],
			[2, 4, 1],
			[3, 1, 1],
			[5, 2, 1]
		],
		start: 0
	},
	c13p: {
		slots: [
			[2, 2, 1],
			[3, 5, 1],
			[4, 3, 1]
		],
		start: 4
	}
};

export const TODAY = today();
const FIRST = addDays(TODAY, -7);
const LAST = addDays(TODAY, 41);
export const LAST_TERM_CLOSES = LAST;

const byCourse: Record<string, AgendaLesson[]> = {};
for (const l of planning.lessons) {
	if (!l.courseName) continue;
	(byCourse[l.courseName] ??= []).push({
		id: l.id,
		title: l.title,
		topicName: l.topicName,
		courseName: l.courseName,
		tags: l.tags
	});
}

const rows: Row[] = [];
let slotCount = 0;
for (const c of CLASSES) {
	const p = PATTERN[c.id];
	const queue = byCourse[c.course] ?? [];
	let q = p.start;
	for (let date = FIRST; date <= LAST; date = addDays(date, 1)) {
		const wd = weekday(date);
		for (const [day, period, length] of p.slots) {
			if (day !== wd) continue;
			slotCount++;
			// Every so often an upcoming Slot has nothing placed: an Open Slot.
			const open = date >= TODAY && slotCount % 13 === 0;
			const lesson = open ? null : (queue[q++] ?? null);
			rows.push({
				key: `${c.id}-${date}-${period}`,
				date,
				periodFrom: period,
				periodTo: period + length - 1,
				classId: c.id,
				classLabel: c.label,
				tone: c.tone,
				lesson
			});
		}
	}
}
// A placed Standalone Lesson.
const tenY = CLASSES.find((c) => c.id === 'c10y')!;
const careers = rows.find((r) => r.classId === tenY.id && r.date > addDays(TODAY, 2));
if (careers)
	careers.lesson = {
		id: 'standalone-careers',
		title: 'Careers talk: working in engineering',
		topicName: null,
		courseName: null,
		tags: ['Off timetable']
	};
rows.sort((a, b) => a.date.localeCompare(b.date) || a.periodFrom - b.periodFrom);

// Readiness, keyed (Lesson, Class). The next few days are mostly ready.
const ready: Record<string, boolean> = $state({});
rows.forEach((r, i) => {
	if (r.lesson && r.date >= TODAY && r.date <= addDays(TODAY, 3) && i % 3 !== 0)
		ready[`${r.lesson.id}|${r.classId}`] = true;
});
export const isReady = (r: Row) => !!r.lesson && !!ready[`${r.lesson.id}|${r.classId}`];
export function setReady(r: Row, on: boolean) {
	if (r.lesson) ready[`${r.lesson.id}|${r.classId}`] = on;
}

// Session notes, keyed by row.
export const notes: Record<string, string> = $state({});

// The page's state lives in the URL, as on the real Agenda: `horizon`, `tag`, `past`, plus
// `session` (the open Session stub) and `day` (a variant's chosen day).
export const HORIZONS = [
	['7', 'This Week'],
	['14', 'Two Weeks'],
	['28', 'Four Weeks'],
	['all', 'All']
] as const;
export const horizonParam = () => page.url.searchParams.get('horizon') ?? '7';
export const tagParam = () => page.url.searchParams.get('tag');
export const pastParam = () => page.url.searchParams.get('past') === '1';
export const sessionParam = () => page.url.searchParams.get('session');

export function set(params: Record<string, string | null>) {
	const url = new URL(page.url);
	for (const [k, v] of Object.entries(params)) {
		if (v) url.searchParams.set(k, v);
		else url.searchParams.delete(k);
	}
	goto(url, { replaceState: true, noScroll: true, keepFocus: true });
}
export const openSession = (r: Row) => set({ session: r.key });

export function horizonEnd(h = horizonParam()) {
	return h === 'all' ? LAST : addDays(TODAY, Number(h) - 1);
}

// What the real load and page compute: the days ahead to the horizon, the look-back when on, both
// narrowed by the Tag.
export function view(h = horizonParam(), tag = tagParam(), past = pastParam()) {
	const end = horizonEnd(h);
	const ahead = rows.filter((r) => r.date >= TODAY && r.date <= end);
	const back = past ? rows.filter((r) => r.date < TODAY) : [];
	return {
		days: groupByDay(filterByTag(ahead, tag)),
		pastDays: groupByDay(filterByTag(back, tag)),
		tags: tagsIn([...back, ...ahead]),
		ahead,
		back
	};
}

export const rowByKey = (key: string | null) => rows.find((r) => r.key === key) ?? null;
export const tagCount = (list: Row[], tag: string) =>
	list.filter((r) => r.lesson?.tags.includes(tag)).length;
