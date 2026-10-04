// PROTOTYPE ONLY (issue #313): fake Classes, Timetables and Assigned Topics held in memory, built
// from the Planning and Agenda prototypes so the same Classes, Lessons and Sessions show
// everywhere. Every write is local and lost on reload. Leaves with the prototype.
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { addDays, weekday } from '$lib/date';
import { CLASSES, store as planning, type Klass } from '../../planning/prototype/store.svelte';
import { TODAY, view, type Row } from '../../prototype-agenda/store.svelte';

export { CLASSES, TODAY, type Klass, type Row };
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const PERIODS = [1, 2, 3, 4, 5, 6];
export const WEEKS = ['A', 'B'] as const;
export type Week = (typeof WEEKS)[number];

const rows = (() => {
	const v = view('all', null, true);
	return [...v.back, ...v.ahead];
})();

// ── Timetable ──────────────────────────────────────────────────────────────
// One Slot per (week, day, Period). Week A is the week the Agenda prototype teaches; Week B
// moves one Slot per Class, so the two weeks differ as a real fortnight does.
export type Slot = { classId: string; week: Week; day: number; period: number };
const slots: Slot[] = $state([]);
for (const c of CLASSES) {
	const seen = new Set<string>();
	for (const r of rows.filter((r) => r.classId === c.id)) {
		for (let p = r.periodFrom; p <= r.periodTo; p++) {
			const key = `${weekday(r.date)}-${p}`;
			if (seen.has(key)) continue;
			seen.add(key);
			slots.push({ classId: c.id, week: 'A', day: weekday(r.date), period: p });
			slots.push({ classId: c.id, week: 'B', day: weekday(r.date), period: p });
		}
	}
}
// Week B: each Class gives up its last Slot and takes Period 6 that day, if free.
for (const c of CLASSES) {
	const mine = slots.filter((s) => s.classId === c.id && s.week === 'B');
	const last = mine[mine.length - 1];
	if (!last) continue;
	const taken = slots.some((s) => s.week === 'B' && s.day === last.day && s.period === 6);
	if (!taken) last.period = 6;
}

export const slotAt = (week: Week, day: number, period: number) =>
	slots.find((s) => s.week === week && s.day === day && s.period === period) ?? null;
export const slotsOf = (classId: string, week?: Week) =>
	slots.filter((s) => s.classId === classId && (!week || s.week === week));
export function toggleSlot(classId: string, week: Week, day: number, period: number) {
	const at = slotAt(week, day, period);
	if (at && at.classId !== classId) return;
	if (at) slots.splice(slots.indexOf(at), 1);
	else slots.push({ classId, week, day, period });
}

// Slots that do not hold all year: one per Class with a dated Slot, fixed.
export const datedSlots: Record<
	string,
	{ week: Week; day: number; period: number; text: string }[]
> = {
	c10x: [{ week: 'B', day: 2, period: 5, text: `from ${addDays(TODAY, 18)}` }],
	c12p: [{ week: 'A', day: 4, period: 6, text: `until ${addDays(TODAY, 9)}` }]
};

// ── Assigned Topics ────────────────────────────────────────────────────────
const topicsByCourse: Record<string, string[]> = {};
for (const l of planning.lessons) {
	if (!l.courseName || !l.topicName) continue;
	const list = (topicsByCourse[l.courseName] ??= []);
	if (!list.includes(l.topicName)) list.push(l.topicName);
}
export const courseTopics = (c: Klass) => topicsByCourse[c.course] ?? [];

// Each Class has been given its first two or three Topics.
export const assigned: Record<string, string[]> = $state({});
CLASSES.forEach((c, i) => {
	assigned[c.id] = courseTopics(c).slice(0, 2 + (i % 2));
});

export function moveTopic(classId: string, index: number, delta: -1 | 1) {
	const list = assigned[classId];
	const j = index + delta;
	if (j < 0 || j >= list.length) return;
	[list[index], list[j]] = [list[j], list[index]];
}
export const unassignTopic = (classId: string, index: number) => assigned[classId].splice(index, 1);
export const assignTopic = (classId: string, name: string) => assigned[classId].push(name);

// ── Progress (the lane) ────────────────────────────────────────────────────
const NOTES = [
	'Ran out of time for the plenary. Start next Lesson with it.',
	'Good practical. Two groups did not finish the results table.',
	null,
	'Half the class were out on a trip.'
];

export type Lane = {
	taught: number;
	total: number;
	lastTaught: { row: Row; note: string | null } | null;
	nextUp: { title: string; topicName: string | null } | null;
	runway: string | null;
	remaining: number;
	upcoming: Row[];
};
export function lane(c: Klass): Lane {
	const i = CLASSES.indexOf(c);
	const mine = rows.filter((r) => r.classId === c.id);
	const past = mine.filter((r) => r.date < TODAY && r.lesson);
	const ahead = mine.filter((r) => r.date >= TODAY);
	const next = ahead.find((r) => r.lesson)?.lesson ?? null;
	const total = planning.lessons.filter(
		(l) => l.courseName === c.course && l.topicName && assigned[c.id].includes(l.topicName)
	).length;
	const taught = Math.round(total * (0.2 + (i % 5) * 0.15));
	const last = past[past.length - 1];
	return {
		taught,
		total,
		lastTaught: last ? { row: last, note: NOTES[i % NOTES.length] } : null,
		nextUp: next ? { title: next.title, topicName: next.topicName } : null,
		runway: i === 5 ? null : addDays(TODAY, 12 + i * 9),
		remaining: i % 3 === 1 ? 3 : 0,
		upcoming: ahead.slice(0, 5)
	};
}

// ── URL state ──────────────────────────────────────────────────────────────
// `class` opens the Class page; `on` is the "Timetable as at" date. `view` picks the variant.
export const classParam = () => page.url.searchParams.get('class');
export const onParam = () => page.url.searchParams.get('on') ?? TODAY;
export const classById = (id: string | null) => CLASSES.find((c) => c.id === id) ?? null;
export const labelOf = (id: string) => classById(id)?.label ?? id;

export function to(params: { class?: string | null; on?: string | null } = {}) {
	const url = new URL(page.url);
	url.searchParams.delete('class');
	url.searchParams.delete('on');
	for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
	return `${url.pathname}${url.search}`;
}
export const setOn = (date: string) =>
	goto(to({ class: classParam(), on: date }), { replaceState: true, noScroll: true });

// The Session page chosen in issue #311 lives on the Agenda prototype's URL.
export const sessionHref = (r: Row) => `/?panel=D&session=${r.key}`;

// "Timetable as at" stops: start of year, today, the dates this Class's Slots change.
export const YEAR_START = addDays(TODAY, -35);
export function stops(classId: string) {
	const dated = (datedSlots[classId] ?? []).map((d) => d.text.split(' ')[1]);
	return [...new Set([YEAR_START, TODAY, ...dated])].sort();
}
